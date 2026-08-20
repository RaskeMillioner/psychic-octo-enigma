import { WINE_TYPES } from '../types.ts';
import { blobToBase64 } from './image.ts';
import {
  FIELD_ORIGINS,
  FIELD_DESCRIPTIONS as D,
  PROVENANCE_KEYS,
  toProvenance,
  normaliseConfidence,
  SYSTEM_PROMPT,
  toFacts,
  USER_PROMPT,
  type LabelReading,
} from './labelFields.ts';
import type { ScanModel, ScanResult } from './scanTypes.ts';

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
    fields: {
      type: 'OBJECT',
      description: D.fields,
      properties: Object.fromEntries(
        PROVENANCE_KEYS.map((key) => [key, { type: 'STRING', enum: [...FIELD_ORIGINS] }]),
      ),
      required: [...PROVENANCE_KEYS],
    },
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
    'fields',
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
    'fields',
  ],
};

export type GeminiModel = ScanModel;

/** Models the user's own key can call, so nobody has to guess a model name. */
export const listGeminiModels = async (apiKey: string): Promise<GeminiModel[]> => {
  const response = await fetch(`${BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) throw new Error(describeError(await readError(response), 'the model list'));
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

/**
 * Ids that exist on the models list but are wrong for scanning a label: preview
 * and experimental builds routinely carry no free-tier quota (a 429 the moment
 * you call them), and the rest are not text-out vision models at all.
 */
const UNSUITABLE = /(preview|experimental|[-.]exp\b|thinking|live|image|audio|tts|embedding|imagen|veo|learnlm|gemma)/i;

/**
 * Higher is better. Concrete versioned ids beat `-latest` aliases: an alias
 * resolves to whichever model Google currently points it at, which may be one
 * with no free-tier allowance — and the failure then reads as a rate limit on a
 * model the account's dashboard never mentions.
 */
const modelScore = (id: string): number => {
  const version = id.match(/(\d+)(?:[.-](\d+))?/);
  const rank = version ? Number(version[1]) * 10 + Number(version[2] ?? 0) : 0;
  return /-latest$/.test(id) ? rank : rank + 1000;
};

/**
 * Chooses a model to scan with from whatever the key can actually reach.
 * Exported for testing: which id this returns decides whether a scan works at
 * all, and the wrong pick fails with a quota error that looks like throttling.
 */
export const selectScanModel = (models: GeminiModel[], exclude: string[] = []): string | null => {
  const usable = models.filter(
    (model) => !exclude.includes(model.id) && !UNSUITABLE.test(model.id),
  );
  const flash = usable.filter((model) => model.id.includes('flash'));
  const pool = flash.length ? flash : usable;
  const best = [...pool].sort(
    (a, b) =>
      modelScore(b.id) - modelScore(a.id) ||
      a.id.length - b.id.length ||
      a.id.localeCompare(b.id),
  )[0];
  return best?.id ?? null;
};

interface GeminiError {
  status: number;
  /** Google's own explanation — the part that says whether a 429 will ever clear. */
  message: string;
  /** Seconds Google asked us to wait, when it said so. */
  retryDelay: string;
  /** True when the quota is structurally zero rather than momentarily spent. */
  exhausted: boolean;
}

/** Exported for tests: how a 429 is worded decides what the user does next. */
export const readError = async (response: Response): Promise<GeminiError> => {
  let message = '';
  let retryDelay = '';
  let raw = '';
  try {
    raw = await response.text();
    const body = JSON.parse(raw) as {
      error?: { message?: string; details?: { retryDelay?: string }[] };
    };
    message = body.error?.message ?? '';
    for (const detail of body.error?.details ?? []) {
      if (typeof detail?.retryDelay === 'string') retryDelay = detail.retryDelay;
    }
  } catch {
    message = raw.slice(0, 300);
  }
  return {
    status: response.status,
    message,
    retryDelay,
    // Google words a zero free-tier allowance as a limit of 0 rather than a
    // wait, and a genuine rate limit comes with a retryDelay. A 429 with
    // neither is the "no allowance for this key or region" case, which no
    // amount of waiting fixes.
    exhausted:
      /limit:?\s*0\b/i.test(message) ||
      /"?quota_?limit_?value"?\s*[:=]\s*"?0\b/i.test(raw) ||
      (response.status === 429 && !retryDelay),
  };
};

export const describeError = (error: GeminiError, model: string): string => {
  const detail = error.message ? ` ${error.message}` : '';
  switch (error.status) {
    case 400:
      return `Google rejected the request for ${model}.${detail}`;
    case 401:
    case 403:
      return `That Google API key was rejected.${detail}`;
    case 404:
      return `${model} is not available to your key.${detail}`;
    case 429:
      if (error.exhausted) {
        return `No quota for ${model}, and Google gave no retry time — so this is not a wait. Usually the free tier does not cover your key's project or region; Google excludes some regions, the EEA, UK and Switzerland among them. Attach billing in AI Studio, or switch provider in Settings.${detail}`;
      }
      return `Gemini rate-limited ${model}; retry in ${error.retryDelay}. The free tier allows only a few scans a minute.${detail}`;
    default:
      return `Gemini returned an error (${error.status}) for ${model}.${detail}`;
  }
};

/**
 * Grounding with Google Search alongside a response schema is supported from
 * Gemini 3 on; older models reject the combination, which `scanWithGemini`
 * recovers from by retrying without the tool.
 */
const requestBody = (data: string, disableThinking: boolean, webLookup: boolean) => ({
  systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  ...(webLookup ? { tools: [{ googleSearch: {} }] } : {}),
  contents: [
    {
      role: 'user',
      parts: [{ inlineData: { mimeType: 'image/jpeg', data } }, { text: USER_PROMPT }],
    },
  ],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    // Flash models reason by default and spend maxOutputTokens doing it, which
    // can exhaust the budget before any JSON is written. Turn it off for what is
    // an extraction task, and leave room even so.
    ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    maxOutputTokens: 8192,
  },
});

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
  promptFeedback?: { blockReason?: string };
}

const callGemini = (
  model: string,
  apiKey: string,
  data: string,
  disableThinking: boolean,
  webLookup: boolean,
) =>
  fetch(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody(data, disableThinking, webLookup)),
    },
  );

/**
 * Grounded answers sometimes arrive with prose or a code fence wrapped around
 * the JSON, so take the outermost object rather than insisting on a clean body.
 */
export const parseJsonLoosely = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object in the response');
    return JSON.parse(raw.slice(start, end + 1));
  }
};

export interface GeminiScanOutcome extends ScanResult {
  /** The model that actually answered — may differ from the configured one. */
  usedModel: string;
}

/** Reads a label with Gemini, which has a no-cost free tier. */
/**
 * Set once a grounded request has been refused. Asking again costs a request
 * from a daily allowance that is small enough to matter, so the rest of the
 * session reads labels without searching until the app is reloaded.
 */
let groundingRefused = false;

export const scanWithGemini = async (
  photo: Blob,
  apiKey: string,
  model: string,
  webLookup: boolean,
): Promise<GeminiScanOutcome> => {
  if (!apiKey) throw new Error('Add your Google AI Studio key in Settings to scan labels.');

  const data = await blobToBase64(photo);
  const tried: string[] = [];
  let searching = webLookup && !groundingRefused;

  const call = async (candidate: string, disableThinking = true) => {
    if (!tried.includes(candidate)) tried.push(candidate);
    try {
      return await callGemini(candidate, apiKey, data, disableThinking, searching);
    } catch {
      throw new Error('Could not reach the Gemini API. Check your connection and try again.');
    }
  };

  let usedModel = model.trim();
  if (!usedModel) {
    const models = await listGeminiModels(apiKey).catch(() => [] as GeminiModel[]);
    usedModel = selectScanModel(models) ?? 'gemini-flash-latest';
  }
  let response = await call(usedModel);

  // Grounding with Google Search is quota'd separately from ordinary requests —
  // and that quota is not the one the rate-limit page shows. If a grounded call
  // is refused, the label itself is still readable, so drop the search and try
  // again before blaming the model.
  let lookupRefused = false;
  if (searching && (response.status === 429 || response.status === 403)) {
    searching = false;
    lookupRefused = true;
    groundingRefused = true;
    response = await call(usedModel);
  }

  // A model that is missing, or that carries no free quota, is worth stepping
  // past once: ask the key what it can reach and try the best remaining option.
  if (response.status === 404 || response.status === 429) {
    const first = await readError(response);
    const models = await listGeminiModels(apiKey).catch(() => [] as GeminiModel[]);
    const alternative = selectScanModel(models, tried);

    if (!alternative) throw new Error(describeError(first, usedModel));

    const previous = usedModel;
    usedModel = alternative;
    response = await call(alternative);

    if (!response.ok) {
      const second = await readError(response);
      // Two models failing the same way is one problem, not two: say it once,
      // naming both, rather than repeating a paragraph.
      const sameCause = second.status === first.status && second.exhausted === first.exhausted;
      throw new Error(
        sameCause
          ? describeError(second, `${previous} or ${alternative}`)
          : `${describeError(first, previous)} Also tried ${alternative}: ${describeError(second, alternative)}`,
      );
    }
  }

  // Two 400s are worth recovering from rather than reporting: a model that
  // refuses a zero thinking budget, and one too old to combine search grounding
  // with a response schema.
  if (response.status === 400) {
    const rejected = await readError(response);
    if (searching && /tool|search|grounding|schema/i.test(rejected.message)) {
      searching = false;
      response = await call(usedModel);
    } else if (/thinking/i.test(rejected.message)) {
      response = await call(usedModel, false);
    } else {
      throw new Error(describeError(rejected, usedModel));
    }
  }

  if (!response.ok) throw new Error(describeError(await readError(response), usedModel));

  const body = (await response.json()) as GeminiResponse;

  if (body.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked that image (${body.promptFeedback.blockReason}). Try a clearer photo of the label.`,
    );
  }

  const candidate = body.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(
      `${usedModel} used its whole output budget before answering. Pick a different model in Settings.`,
    );
  }
  if (
    candidate?.finishReason &&
    !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason)
  ) {
    throw new Error(`Gemini stopped early (${candidate.finishReason}). Try a different photo.`);
  }

  const raw = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  let reading: LabelReading;
  try {
    reading = parseJsonLoosely(raw) as LabelReading;
  } catch {
    throw new Error("Couldn't read anything usable from that photo. Try again in better light.");
  }

  return {
    facts: toFacts(reading, WINE_TYPES),
    confidence: normaliseConfidence(reading.confidence),
    notes: typeof reading.notes === 'string' ? reading.notes : '',
    isWineLabel: reading.isWineLabel !== false,
    provenance: toProvenance(reading.fields),
    searched: searching,
    lookupRefused,
    usedModel,
  };
};
