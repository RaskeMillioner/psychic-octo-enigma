import type { ScanModel } from './scanTypes.ts';

const BASE = 'https://api.anthropic.com/v1';

interface ModelInfo {
  id: string;
  display_name?: string;
  capabilities?: { image_input?: { supported?: boolean } } | null;
}

const describe = async (response: Response): Promise<string> => {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ? ` ${body.error.message}` : '';
  } catch {
    detail = '';
  }
  switch (response.status) {
    case 401:
    case 403:
      return `That Anthropic API key was rejected.${detail}`;
    case 429:
      return `Rate limited while listing models — try again shortly.${detail}`;
    default:
      return `Anthropic returned an error (${response.status}) listing models.${detail}`;
  }
};

/**
 * Models the key can call, newest first (the API's own order), narrowed to the
 * ones that accept images — a model that cannot take a photo cannot read a
 * label. Models that do not report their capabilities are kept rather than
 * guessed away.
 */
export const listClaudeModels = async (apiKey: string): Promise<ScanModel[]> => {
  const response = await fetch(`${BASE}/models?limit=100`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Without this the API refuses calls made straight from a browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (!response.ok) throw new Error(await describe(response));

  const body = (await response.json()) as { data?: ModelInfo[] };
  return (body.data ?? [])
    .filter((model) => model.capabilities?.image_input?.supported !== false)
    .map((model) => ({ id: model.id, label: model.display_name || model.id }));
};
