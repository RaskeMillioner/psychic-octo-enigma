import type { ScanProvider, Settings } from '../types';
import type { ScanResult } from './scanTypes.ts';

export type { ScanResult } from './scanTypes.ts';

export const PROVIDER_LABELS: Record<ScanProvider, string> = {
  claude: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
};

export const providerKey = (settings: Settings, provider: ScanProvider): string =>
  provider === 'claude' ? settings.apiKey : settings.geminiApiKey;

/**
 * The provider a scan will actually use: the chosen one, unless it has no key
 * and the other does — so a user with only one key configured never sees a
 * "missing key" message for a provider they are not using.
 */
export const resolveProvider = (settings: Settings): ScanProvider => {
  const chosen = settings.scanProvider;
  if (providerKey(settings, chosen)) return chosen;
  const other: ScanProvider = chosen === 'claude' ? 'gemini' : 'claude';
  return providerKey(settings, other) ? other : chosen;
};

export interface ScanOutcome extends ScanResult {
  provider: ScanProvider;
  /** Set when Gemini answered on a different model than the configured one. */
  usedModel?: string;
}

/**
 * Turns a photographed label into pre-filled wine metadata. Provider code is
 * loaded on demand, so neither SDK is in the initial download.
 */
export const scanLabel = async (photo: Blob, settings: Settings): Promise<ScanOutcome> => {
  const provider = resolveProvider(settings);

  if (provider === 'gemini') {
    const { scanWithGemini } = await import('./scanGemini.ts');
    const outcome = await scanWithGemini(
      photo,
      settings.geminiApiKey,
      settings.geminiModel,
      settings.webLookup,
    );
    return { ...outcome, provider };
  }

  const { scanWithClaude } = await import('./scanClaude.ts');
  const result = await scanWithClaude(
    photo,
    settings.apiKey,
    settings.claudeModel,
    settings.webLookup,
  );
  return { ...result, provider };
};
