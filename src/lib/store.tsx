import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CellarWine, DiaryEntry, Settings } from '../types';
import {
  getSettings,
  listCellar,
  listDiary,
  saveSettings as persistSettings,
} from './db';

interface DataStore {
  wines: CellarWine[];
  diary: DiaryEntry[];
  settings: Settings;
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
  }));
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [nextWines, nextDiary, nextSettings] = await Promise.all([
      listCellar(),
      listDiary(),
      getSettings(),
    ]);
    setWines(nextWines);
    setDiary(nextDiary);
    setSettings(nextSettings);
    setLoading(false);
  }, []);

  const updateSettings = useCallback(async (next: Settings) => {
    await persistSettings(next);
    setSettings(next);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<DataStore>(
    () => ({ wines, diary, settings, loading, reload, updateSettings }),
    [wines, diary, settings, loading, reload, updateSettings],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataStore => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside <DataProvider>');
  return context;
};
