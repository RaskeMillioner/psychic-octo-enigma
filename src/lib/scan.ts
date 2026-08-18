import type { LabelReading } from './labelSchema';
import type { WineFacts } from '../types';
import { blobToBase64 } from './image';

const SYSTEM_PROMPT = `You are an expert sommelier and wine label reader working inside a cellar-tracking app.

Read the photographed label and identify the wine. Then:
- Transcribe what is printed exactly — producer, cuvée, vintage, appellation, classification, alcohol, bottle volume.
- Fill remaining fields from your knowledge of the producer and appellation (a Chablis is Chardonnay; a Barolo is Nebbiolo from Piedmont, Italy).
- Never invent a producer, cuvée or vintage that you cannot see or confidently recognise. Leave a field empty rather than guessing.
- If the photo is blurry, cropped or shows a back label only, extract what you can and say so in "notes".
- Set confidence to "low" when you are unsure which wine this is, even if the text is legible.`;

type AnthropicModule = typeof import('@anthropic-ai/sdk');

/**
 * The SDK is only needed when a label is actually scanned, so it is kept out of
 * the initial bundle — the cellar and diary load without it.
 */
let sdkPromise: Promise<
  [
    AnthropicModule,
    typeof import('@anthropic-ai/sdk/helpers/zod'),
    typeof import('./labelSchema'),
  ]
> | null = null;

const loadSdk = () => {
  sdkPromise ??= Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod'),
    import('./labelSchema'),
  ]);
  return sdkPromise;
};

export interface ScanResult {
  facts: WineFacts;
  confidence: LabelReading['confidence'];
  notes: string;
  isWineLabel: boolean;
}

/** Turns a photographed label into pre-filled wine metadata. */
export const scanLabel = async (photo: Blob, apiKey: string): Promise<ScanResult> => {
  if (!apiKey) {
    throw new Error('Add your Anthropic API key in Settings to scan labels.');
  }

  const [sdk, zodHelpers, schema] = await loadSdk();
  const client = new sdk.default({ apiKey, dangerouslyAllowBrowser: true });
  const data = await blobToBase64(photo);

  let response;
  try {
    response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
            { type: 'text', text: 'Identify this wine from its label.' },
          ],
        },
      ],
      output_config: { format: zodHelpers.zodOutputFormat(schema.LabelSchema) },
    });
  } catch (error) {
    throw new Error(describeApiError(error, sdk));
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to describe this image. Try a clearer photo of the label.');
  }

  const reading = response.parsed_output;
  if (!reading) {
    throw new Error("Couldn't read anything usable from that photo. Try again in better light.");
  }

  return {
    facts: schema.toFacts(reading),
    confidence: reading.confidence,
    notes: reading.notes,
    isWineLabel: reading.isWineLabel,
  };
};

const describeApiError = (error: unknown, sdk: AnthropicModule): string => {
  const { default: Anthropic } = sdk;
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
    return `The API returned an error (${error.status ?? 'unknown'}). ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Scanning failed.';
};
