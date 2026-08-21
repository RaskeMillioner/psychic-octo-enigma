import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CellarReview } from './enrichment';
import type { CellarWine, DiaryEntry, Settings, StoredPhoto } from '../types';

const DB_NAME = 'cellarbook';
const DB_VERSION = 1;

interface CellarDB extends DBSchema {
  wines: {
    key: string;
    value: CellarWine;
    indexes: { byProducer: string; byUpdatedAt: string };
  };
  diary: {
    key: string;
    value: DiaryEntry;
    indexes: { byDrunkOn: string; byCellarWineId: string };
  };
  photos: { key: string; value: StoredPhoto };
  settings: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<CellarDB>> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<CellarDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const wines = db.createObjectStore('wines', { keyPath: 'id' });
        wines.createIndex('byProducer', 'producer');
        wines.createIndex('byUpdatedAt', 'updatedAt');

        const diary = db.createObjectStore('diary', { keyPath: 'id' });
        diary.createIndex('byDrunkOn', 'drunkOn');
        diary.createIndex('byCellarWineId', 'cellarWineId');

        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
};

export const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ cellar */

export const listCellar = async (): Promise<CellarWine[]> => (await getDb()).getAll('wines');

export const getCellarWine = async (id: string) => (await getDb()).get('wines', id);

export const putCellarWine = async (wine: CellarWine): Promise<CellarWine> => {
  const record = { ...wine, updatedAt: now() };
  await (await getDb()).put('wines', record);
  return record;
};

export const createCellarWine = async (
  wine: Omit<CellarWine, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<CellarWine> => {
  const record: CellarWine = { ...wine, id: newId(), createdAt: now(), updatedAt: now() };
  await (await getDb()).put('wines', record);
  return record;
};

/** Deletes the cellar entry and its photo. Diary entries keep their own copy. */
export const deleteCellarWine = async (id: string) => {
  const db = await getDb();
  const wine = await db.get('wines', id);
  if (wine?.photoId) await db.delete('photos', wine.photoId);
  await db.delete('wines', id);
};

/* ------------------------------------------------------------------- diary */

/**
 * Entries written before venues existed have no setting, venue, city or
 * country. Rather than migrate the store — a risky thing to run against a
 * cellar that is already someone's only copy — the defaults are applied as
 * records are read, and written back the next time an entry is saved.
 */
type StoredDiaryEntry = Omit<DiaryEntry, 'setting' | 'venue' | 'city' | 'venueCountry'> &
  Partial<Pick<DiaryEntry, 'setting' | 'venue' | 'city' | 'venueCountry'>>;

const withVenueDefaults = (entry: StoredDiaryEntry): DiaryEntry => ({
  ...entry,
  setting: entry.setting ?? 'private',
  venue: entry.venue ?? '',
  city: entry.city ?? '',
  venueCountry: entry.venueCountry ?? '',
});

export const listDiary = async (): Promise<DiaryEntry[]> =>
  (await (await getDb()).getAll('diary')).map(withVenueDefaults);

export const getDiaryEntry = async (id: string) => {
  const entry = await (await getDb()).get('diary', id);
  return entry ? withVenueDefaults(entry) : entry;
};

export const putDiaryEntry = async (entry: DiaryEntry): Promise<DiaryEntry> => {
  const record = { ...entry, updatedAt: now() };
  await (await getDb()).put('diary', record);
  return record;
};

export const createDiaryEntry = async (
  entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DiaryEntry> => {
  const record: DiaryEntry = { ...entry, id: newId(), createdAt: now(), updatedAt: now() };
  await (await getDb()).put('diary', record);
  return record;
};

export const deleteDiaryEntry = async (id: string) => {
  const db = await getDb();
  const entry = await db.get('diary', id);
  if (entry?.photoId) await db.delete('photos', entry.photoId);
  await db.delete('diary', id);
};

/**
 * Records a bottle as consumed: writes the diary entry and decrements the cellar
 * quantity in a single transaction so the two can never drift apart.
 * The cellar entry is kept at quantity 0 rather than deleted, so the wine can
 * be restocked and its history stays intact.
 */
export const consumeFromCellar = async (
  cellarWineId: string,
  entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'cellarWineId'>,
): Promise<DiaryEntry> => {
  const db = await getDb();
  const tx = db.transaction(['wines', 'diary'], 'readwrite');
  const wines = tx.objectStore('wines');
  const wine = await wines.get(cellarWineId);
  if (!wine) throw new Error('That wine is no longer in your cellar.');
  if (wine.quantity < 1) throw new Error('No bottles left of that wine.');

  const record: DiaryEntry = {
    ...entry,
    cellarWineId,
    id: newId(),
    createdAt: now(),
    updatedAt: now(),
  };
  await wines.put({ ...wine, quantity: wine.quantity - 1, updatedAt: now() });
  await tx.objectStore('diary').put(record);
  await tx.done;
  return record;
};

/* ------------------------------------------------------------------ photos */

export const savePhoto = async (blob: Blob): Promise<string> => {
  const photo: StoredPhoto = { id: newId(), blob, createdAt: now() };
  await (await getDb()).put('photos', photo);
  return photo.id;
};

export const getPhoto = async (id: string): Promise<Blob | null> => {
  const photo = await (await getDb()).get('photos', id);
  return photo?.blob ?? null;
};

export const deletePhoto = async (id: string) => (await getDb()).delete('photos', id);

/** Duplicates a photo so cellar and diary records own their blobs independently. */
export const copyPhoto = async (id: string | null): Promise<string | null> => {
  if (!id) return null;
  const blob = await getPhoto(id);
  return blob ? savePhoto(blob) : null;
};

/* ---------------------------------------------------------------- settings */

const DEFAULT_SETTINGS: Settings = {
  scanProvider: 'claude',
  apiKey: '',
  claudeModel: 'claude-opus-5',
  geminiApiKey: '',
  // An alias rather than a pinned version: if it is not available to the key,
  // the scanner asks the API which models are and corrects itself.
  // Empty means "resolve from the model list on first use" — see scanGemini.
  geminiModel: '',
  webLookup: true,
  currency: 'EUR',
};

export const getSettings = async (): Promise<Settings> => {
  const stored = (await (await getDb()).get('settings', 'app')) as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
};

export const saveSettings = async (settings: Settings) => {
  await (await getDb()).put('settings', settings, 'app');
};

/* ------------------------------------------------------------ cellar review */

/** The written verdict from the last enrichment import, if there was one. */
export const getReview = async (): Promise<CellarReview | null> =>
  ((await (await getDb()).get('settings', 'review')) as CellarReview | undefined) ?? null;

export const saveReview = async (review: CellarReview) => {
  await (await getDb()).put('settings', { ...review, savedAt: now() }, 'review');
};

export const clearReview = async () => {
  await (await getDb()).delete('settings', 'review');
};

/* ------------------------------------------------------------ backup / IO */

export interface Backup {
  format: 'cellarbook-backup';
  version: 1;
  exportedAt: string;
  wines: CellarWine[];
  diary: DiaryEntry[];
  /** Photo id -> data URL. */
  photos: Record<string, string>;
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const exportBackup = async (): Promise<Backup> => {
  const db = await getDb();
  const [wines, diary, photos] = await Promise.all([
    db.getAll('wines'),
    db.getAll('diary'),
    db.getAll('photos'),
  ]);
  const encoded: Record<string, string> = {};
  for (const photo of photos) encoded[photo.id] = await blobToDataUrl(photo.blob);
  return {
    format: 'cellarbook-backup',
    version: 1,
    exportedAt: now(),
    wines,
    diary,
    photos: encoded,
  };
};

/** Merges a backup into the current database, overwriting records with the same id. */
export const importBackup = async (backup: Backup) => {
  if (backup?.format !== 'cellarbook-backup') throw new Error('Not a CellarBook backup file.');
  const db = await getDb();
  const tx = db.transaction(['wines', 'diary', 'photos'], 'readwrite');
  for (const wine of backup.wines ?? []) await tx.objectStore('wines').put(wine);
  for (const entry of backup.diary ?? []) {
    await tx.objectStore('diary').put(withVenueDefaults(entry));
  }
  for (const [id, dataUrl] of Object.entries(backup.photos ?? {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await tx.objectStore('photos').put({ id, blob, createdAt: now() });
  }
  await tx.done;
  return { wines: backup.wines?.length ?? 0, diary: backup.diary?.length ?? 0 };
};

export const clearAllData = async () => {
  const db = await getDb();
  // The review describes wines that are about to stop existing.
  await db.delete('settings', 'review');
  const tx = db.transaction(['wines', 'diary', 'photos'], 'readwrite');
  await tx.objectStore('wines').clear();
  await tx.objectStore('diary').clear();
  await tx.objectStore('photos').clear();
  await tx.done;
};
