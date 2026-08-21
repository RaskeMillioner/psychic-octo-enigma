import type { ThemePreference } from '../types';

/**
 * Mirrors the stored preference so the bootstrap in index.html can stamp the
 * theme before the first paint. Settings are the truth, but they live in
 * IndexedDB and are read asynchronously — long enough for a light-mode user to
 * see a black flash on every launch. The store rewrites this on load.
 */
export const THEME_KEY = 'cellarbook-theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match device' },
];

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** The colour behind the status bar, so it follows the theme on the phone. */
const THEME_COLOR = { dark: '#16110f', light: '#f7f2ee' } as const;

/**
 * Which of the two themes is actually on. Exported for testing: everything else
 * here touches the document, and this is the part with a decision in it.
 */
export const resolveTheme = (
  preference: ThemePreference,
  prefersLight: boolean,
): 'dark' | 'light' => {
  if (preference === 'system') return prefersLight ? 'light' : 'dark';
  return preference;
};

const prefersLight = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches;

/** Stamps the theme on the document, updates the status bar, and caches the choice. */
export const applyTheme = (preference: ThemePreference): 'dark' | 'light' => {
  const theme = resolveTheme(preference, prefersLight());
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Private browsing can refuse storage; the theme still applies for this session.
  }
  return theme;
};

/**
 * Calls back when the device crosses between light and dark, so "match device"
 * follows the evening rather than waiting for the next launch. Returns an
 * unsubscribe function.
 */
export const watchSystemTheme = (onChange: () => void): (() => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(LIGHT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
