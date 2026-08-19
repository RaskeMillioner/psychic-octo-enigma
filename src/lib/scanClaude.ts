import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { WINE_TYPES } from '../types';
import { blobToBase64 } from './image';
import {
  normaliseConfidence,
  SYSTEM_PROMPT,
  toFacts,
  toProvenance,
  USER_PROMPT,
} from './labelFields.ts';
import { LabelSchema } from './labelSchema';
import type { ScanResult } from './scanTypes.ts';

/** Reads a label with Claude, using structured outputs so the reply is typed. */
export const scanWithClaude = async (
  photo: Blob,
  apiKey: string,
  model: string,
  webLookup: boolean,
): Promise<ScanResult> => {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to scan labels.');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const data = await blobToBase64(photo);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
        { type: 'text', text: USER_PROMPT },
      ],
    },
  ];

  let searching = webLookup;

  const ask = () =>
    client.messages.parse({
      model: model || 'claude-opus-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages,
      ...(searching
        ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] }
        : {}),
      output_config: { format: zodOutputFormat(LabelSchema) },
    });

  let response;
  try {
    response = await ask();
  } catch (error) {
    // Web search is not available on every model or account; the scan itself
    // still works without it.
    if (searching && error instanceof Anthropic.APIError && error.status === 400) {
      searching = false;
      try {
        response = await ask();
      } catch (retryError) {
        throw new Error(describeApiError(retryError));
      }
    } else {
      throw new Error(describeApiError(error));
    }
  }

  // A server-tool turn can stop to run the search and needs to be resumed.
  for (let resumed = 0; response.stop_reason === 'pause_turn' && resumed < 4; resumed += 1) {
    messages.push({ role: 'assistant', content: response.content });
    try {
      response = await ask();
    } catch (error) {
      throw new Error(describeApiError(error));
    }
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to describe this image. Try a clearer photo of the label.');
  }

  const reading = response.parsed_output;
  if (!reading) {
    throw new Error("Couldn't read anything usable from that photo. Try again in better light.");
  }

  return {
    facts: toFacts(reading, WINE_TYPES),
    confidence: normaliseConfidence(reading.confidence),
    notes: reading.notes,
    isWineLabel: reading.isWineLabel,
    provenance: toProvenance(reading.fields),
    searched: searching,
  };
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
