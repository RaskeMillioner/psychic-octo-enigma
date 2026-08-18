import { WINE_TYPES } from '../types';
import { blobToBase64 } from './image';
import {
  FIELD_DESCRIPTIONS as D,
  normaliseConfidence,
  SYSTEM_PROMPT,
  toFacts,
  USER_PROMPT,
  type LabelReading,
} from './labelFields.ts';
import type { ScanResult } from './scanTypes.ts';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Gemini takes an OpenAPI-subset schema with upper-case type names. Same fields
 * as the Claude schema, expressed in Google's dialect.
 */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isWineLabel: { type: 'BOOLEAN', description: D.isWineLabel },
    producer: { type: 'STRING', description: D.producer },
    name: { type: 'STRING', description: D.name },
    country: { type: 'STRING', description: D.country },
    region: { type: 'STRING', description: D.region },
    appellation: { type: 'STRING', description: D.appellation },
    grapes: { type: 'ARRAY', items: { type: 'STRING' }, description: D.grapes },
    vintage: { type: 'STRING', description: D.vintage },
    classification: { type: 'STRING', description: D.classification },
    wineType: { type: 'STRING', enum: [...WINE_TYPES, 'Unknown'], description: D.wineType },
    abv: { type: 'STRING', description: D.abv },
    sizeMl: { type: 'STRING', description: D.sizeMl },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'], description: D.confidence },
    notes: { type: 'STRING', description: D.notes },
  },
  required: [
    'isWineLabel',
    'producer',
    'name',
    'country',
    'region',
    'appellation',
    'grapes',
    'vintage',
    'classification',
    'wineType',
    'abv',
    'sizeMl',
    'confidence',
    'notes',
  ],
  propertyOrdering: [
    'isWineLabel',
    'producer',
    'name',
    'country',
    'region',
    'appellation',
    'grapes',
    'vintage',
    'classification',
    'wineType',
    'abv',
    'sizeMl',
    'confidence',
    'notes',
  ],
};

export interface GeminiModel {
  /** Bare id, e.g. "gemini-2.5-flash". */
  id: string;
  label: string;
}

/** Models the user's own key can call, so nobody has to guess a model name. */
export const listGeminiModels = async (apiKey: string): Promise<GeminiModel[]> => {
  const response = await fetch(`${BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) throw new Error(await describeHttpError(response));
  const body = (await response.json()) as {
    models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  };
  return (body.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => ({
      id: (model.name ?? '').replace(/^models\//, ''),
      label: model.displayName || (model.name ?? '').replace(/^models\//, ''),
    }))
    .filter((model) => model.id.startsWith('gemini'))
    .sort((a, b) => a.id.localeCompare(b.id));
};

/** Picks a sensible free-tier default from whatever the key can actually reach. */
const pickFallbackModel = (models: GeminiModel[]): string | null => {
  const flash = models.filter(
    (model) => model.id.includes('flash') && !model.id.includes('image') && !model.id.includes('tts'),
  );
  // Newest first — model ids sort lexically close enough for "2.5" < "3.5".
  const preferred = [...flash].sort((a, b) => b.id.localeCompare(a.id))[0];
  return preferred?.id ?? models[0]?.id ?? null;
};

const describeHttpError = async (response: Response): Promise<string> => {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? '';
  } catch {
    detail = '';
  }
  switch (response.status) {
    case 400:
      return `Google rejected the request${detail ? `: ${detail}` : '.'}`;
    case 401:
    case 403:
      return 'That Google API key was rejected. Check it in Settings.';
    case 404:
      return `That Gemini model is not available to your key${detail ? `: ${detail}` : '.'}`;
    case 429:
      return 'Gemini free-tier limit reached. Wait a little and scan again.';
    default:
      return `Gemini returned an error (${response.status})${detail ? `: ${detail}` : '.'}`;
  }
};

const requestBody = (data: string) => ({
  systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  contents: [
    {
      role: 'user',
      parts: [{ inlineData: { mimeType: 'image/jpeg', data } }, { text: USER_PROMPT }],
    },
  ],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 4096,
  },
});

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
  promptFeedback?: { blockReason?: string };
}

const callGemini = async (model: string, apiKey: string, data: string) => {
  const response = await fetch(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody(data)),
    },
  );
  return response;
};

export interface GeminiScanOutcome extends ScanResult {
  /** The model that actually answered — may differ if the configured one was gone. */
  usedModel: string;
}

/** Reads a label with Gemini, which has a no-cost free tier. */
export const scanWithGemini = async (
  photo: Blob,
  apiKey: string,
  model: string,
): Promise<GeminiScanOutcome> => {
  if (!apiKey) throw new Error('Add your Google AI Studio key in Settings to scan labels.');

  const data = await blobToBase64(photo);

  let usedModel = model.trim() || 'gemini-flash-latest';
  let response: Response;
  try {
    response = await callGemini(usedModel, apiKey, data);
  } catch {
    throw new Error('Could not reach the Gemini API. Check your connection and try again.');
  }

  // A missing or renamed model is the one failure we can fix without the user:
  // ask the key which models it has and retry once with the best free one.
  if (response.status === 404) {
    const models = await listGeminiModels(apiKey).catch(() => [] as GeminiModel[]);
    const fallback = pickFallbackModel(models);
    if (!fallback || fallback === usedModel) throw new Error(await describeHttpError(response));
    usedModel = fallback;
    response = await callGemini(usedModel, apiKey, data);
  }

  if (!response.ok) throw new Error(await describeHttpError(response));

  const body = (await response.json()) as GeminiResponse;

  if (body.promptFeedback?.blockReason) {
    throw new Error('Gemini blocked that image. Try a clearer photo of the label.');
  }

  const candidate = body.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini ran out of room before finishing. Try again.');
  }
  if (candidate?.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason)) {
    throw new Error(`Gemini stopped early (${candidate.finishReason}). Try a different photo.`);
  }

  const raw = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  let reading: LabelReading;
  try {
    reading = JSON.parse(raw) as LabelReading;
  } catch {
    throw new Error("Couldn't read anything usable from that photo. Try again in better light.");
  }

  return {
    facts: toFacts(reading, WINE_TYPES),
    confidence: normaliseConfidence(reading.confidence),
    notes: typeof reading.notes === 'string' ? reading.notes : '',
    isWineLabel: reading.isWineLabel !== false,
    usedModel,
  };
};
