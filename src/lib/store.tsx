import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CellarReview } from './enrichment';
import type { CellarWine, DiaryEntry, Settings } from '../types';
import { applyTheme, watchSystemTheme } from './theme.ts';
import {
  getReview,
  getSettings,
  listCellar,
  listDiary,
  saveSettings as persistSettings,
} from './db';

interface DataStore {
  wines: CellarWine[];
  diary: DiaryEntry[];
  settings: Settings;
  /** The written verdict from the last enrichment import. */
  review: CellarReview | null;
  loading: boolean;
  /** Re-reads everything from IndexedDB. Call after any mutation. */
  reload: () => Promise<void>;
  updateSettings: (next: Settings) => Promise<void>;
}

const DataContext = createContext<DataStore | null>(null);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [wines, setWines] = useState<CellarWine[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(() => ({
    scanProvider: 'claude',
    apiKey: '',
    claudeModel: 'claude-opus-5',
    geminiApiKey: '',
    geminiModel: '',
    webLookup: true,
    currency: 'EUR',
    theme: 'dark',
  }));
  const [review, setReview] = useState<CellarReview | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [nextWines, nextDiary, nextSettings, nextReview] = await Promise.all([
      listCellar(),
      listDiary(),
      getSettings(),
      getReview(),
    ]);
    setWines(nextWines);
    setDiary(nextDiary);
    setSettings(nextSettings);
    setReview(nextReview);
    setLoading(false);
  }, []);

  const updateSettings = useCallback(async (next: Settings) => {
    await persistSettings(next);
    setSettings(next);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // The theme is applied here rather than at each call site, so it follows the
  // stored preference however it changed — the switch in Settings, a reload, or
  // an import — and "match device" keeps following the device while it is on.
  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [settings.theme]);

  const value = useMemo<DataStore>(
    () => ({ wines, diary, settings, review, loading, reload, updateSettings }),
    [wines, diary, settings, review, loading, reload, updateSettings],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataStore => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside <DataProvider>');
  return context;
};
