import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { WINE_TYPES } from '../types';
import { blobToBase64 } from './image';
import {
  normaliseConfidence,
  SYSTEM_PROMPT,
  toFacts,
  toProvenance,
  toWindow,
  USER_PROMPT,
  type LabelReading,
} from './labelFields.ts';
import { LabelSchema } from './labelSchema';
import { RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT, toReceipt, type Receipt, type ReceiptReading } from './receiptFields.ts';
import { ReceiptSchema } from './receiptSchema';
import { supportsFilteredSearch } from './claudeModels.ts';
import type { ScanResult } from './scanTypes.ts';

interface Reading<T> {
  parsed: T;
  /** True when the model was able to search the web for this photo. */
  searched: boolean;
  /** Why a requested web lookup did not happen; unset when it did. */
  lookupIssue?: string;
}

/**
 * How the web lookup is attached to a request. `filtered` runs the search from
 * inside code execution so results are filtered before they reach the model,
 * which costs fewer tokens; `basic` is the plain search tool every model that
 * can search at all accepts.
 */
type SearchMode = 'filtered' | 'basic' | 'off';

const searchTools = (mode: SearchMode) =>
  mode === 'off'
    ? {}
    : {
        tools: [
          {
            type: mode === 'filtered' ? ('web_search_20260209' as const) : ('web_search_20250305' as const),
            name: 'web_search' as const,
            max_uses: 5,
          },
        ],
      };

/**
 * One photo, one structured answer. Labels and receipts differ only in the
 * prompt and the schema; the model fallback, the web-search retry and the
 * paused-turn resume are the same problem either way and are solved here once.
 */
const readWithClaude = async <T>(
  photo: Blob,
  apiKey: string,
  model: string,
  webLookup: boolean,
  system: string,
  user: string,
  schema: Parameters<typeof zodOutputFormat>[0],
): Promise<Reading<T>> => {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to scan photos.');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const data = await blobToBase64(photo);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
        { type: 'text', text: user },
      ],
    },
  ];

  const scanModel = model || 'claude-opus-5';
  let mode: SearchMode = 'off';

  const ask = () =>
    client.messages.parse({
      model: scanModel,
      max_tokens: 16000,
      system,
      messages,
      ...searchTools(mode),
      output_config: { format: zodOutputFormat(schema) },
    });

  // Ask for the most the model can do, then step down. A 400 on a request
  // carrying the search tool says it was rejected, not why — the account, the
  // model and the tool's own code-execution half are all reachable causes — so
  // the steps are worth taking rather than guessing between them, and what the
  // API actually said is worth keeping for the case where nothing works.
  const ladder: SearchMode[] = !webLookup
    ? ['off']
    : supportsFilteredSearch(scanModel)
      ? ['filtered', 'basic', 'off']
      : ['basic', 'off'];
  let response: Awaited<ReturnType<typeof ask>> | undefined;
  let rejection = '';

  for (const [index, candidate] of ladder.entries()) {
    mode = candidate;
    try {
      response = await ask();
      break;
    } catch (error) {
      const recoverable =
        index < ladder.length - 1 && error instanceof Anthropic.APIError && error.status === 400;
      if (!recoverable) throw new Error(describeApiError(error));
      if (!rejection) rejection = error.message;
    }
  }
  if (!response) throw new Error('Scanning failed.');

  const lookupIssue =
    mode === 'off' && webLookup
      ? `The web lookup didn’t run, so this scan read the label only. The API rejected it: ${rejection}`
      : undefined;

  // A server-tool turn can stop to run the search and needs to be resumed.
  for (let resumed = 0; response.stop_reason === 'pause_turn' && resumed < 4; resumed += 1) {
    messages.push({ role: 'assistant', content: response.content });
    try {
      response = await ask();
    } catch (error) {
      throw new Error(describeApiError(error));
    }
  }

  if (response.stop_reason === 'pause_turn') {
    throw new Error(
      'The model kept stopping to search and never finished reading the photo. Turn the web lookup off in Settings and scan again.',
    );
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to describe this image. Try a clearer photo of the label.');
  }

  const parsed = response.parsed_output as T | null;
  if (!parsed) {
    throw new Error("Couldn't read anything usable from that photo. Try again in better light.");
  }

  return { parsed, searched: mode !== 'off', lookupIssue };
};

/** Reads a label with Claude, using structured outputs so the reply is typed. */
export const scanWithClaude = async (
  photo: Blob,
  apiKey: string,
  model: string,
  webLookup: boolean,
): Promise<ScanResult> => {
  const { parsed, searched, lookupIssue } = await readWithClaude<LabelReading>(
    photo,
    apiKey,
    model,
    webLookup,
    SYSTEM_PROMPT,
    USER_PROMPT,
    LabelSchema,
  );

  return {
    facts: toFacts(parsed, WINE_TYPES),
    confidence: normaliseConfidence(parsed.confidence),
    notes: parsed.notes,
    isWineLabel: parsed.isWineLabel,
    provenance: toProvenance(parsed.fields),
    window: toWindow(parsed),
    searched,
    lookupIssue,
  };
};

/** Reads a merchant's receipt with Claude: the same call, a different schema. */
export const scanReceiptWithClaude = async (
  photo: Blob,
  apiKey: string,
  model: string,
  webLookup: boolean,
): Promise<Receipt> => {
  const { parsed } = await readWithClaude<ReceiptReading>(
    photo,
    apiKey,
    model,
    webLookup,
    RECEIPT_SYSTEM_PROMPT,
    RECEIPT_USER_PROMPT,
    ReceiptSchema,
  );
  return toReceipt(parsed);
};

const describeApiError = (error: unknown): string => {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'That API key was rejected. Check it in Settings.';
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'This API key is not allowed to use the model. Check your Anthropic account.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate limited by the API. Wait a moment and scan again.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Anthropic API. Check your connection and try again.';
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 400 && /credit|balance/i.test(error.message)) {
      return 'Your Anthropic account is out of credit. Top up, or switch to Gemini in Settings.';
    }
    return `The API returned an error (${error.status ?? 'unknown'}). ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Scanning failed.';
};
