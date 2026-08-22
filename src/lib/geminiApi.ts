import type { ScanModel } from './scanTypes.ts';

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiModel = ScanModel;

export interface GeminiError {
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

/** Models the user's own key can call, so nobody has to guess a model name. */
export const listGeminiModels = async (apiKey: string): Promise<GeminiModel[]> => {
  const response = await fetch(
    `${GEMINI_BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
  );
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
