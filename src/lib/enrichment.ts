import type { CellarWine, DiaryEntry, WineFacts, WineType } from '../types.ts';
import { WINE_TYPES } from '../types.ts';

/**
 * A round trip through a chat app: export the wines with gaps, let a model with
 * web access fill them in, import the answer back.
 *
 * Deliberately not the same file as a backup. Backups carry photos as data URLs
 * (megabytes, and none of a model's business) plus quantities, prices and dates
 * that must never come back changed. This carries only the metadata that
 * describes the wine itself, so the merge can be blanks-only and the numbers
 * that matter cannot be rewritten.
 */

/** The identifying half of a wine — everything a lookup could reasonably fill. */
export interface EnrichmentRecord {
  id: string;
  kind: 'cellar' | 'diary';
  producer: string;
  name: string;
  vintage: number | null;
  country: string;
  region: string;
  appellation: string;
  classification: string;
  grapes: string[];
  wineType: string;
  abv: number | null;
  sizeMl: number;
}

export interface EnrichmentFile {
  format: 'cellarbook-enrichment';
  version: 1;
  exportedAt: string;
  instructions: string;
  wines: EnrichmentRecord[];
}

/** Fields a lookup may fill. Producer, name and vintage identify the wine. */
const FILLABLE = [
  'country',
  'region',
  'appellation',
  'classification',
  'grapes',
  'wineType',
  'abv',
] as const;
type Fillable = (typeof FILLABLE)[number];

export const INSTRUCTIONS = [
  'This file lists wines from a personal cellar app. Some fields are missing.',
  '',
  'For each wine, search the web for that exact producer, cuvée and vintage, and fill in ONLY the fields that are currently empty: country, region, appellation, classification, grapes, wineType, abv.',
  '',
  'Rules:',
  '- Never change producer, name, vintage, id or kind. They identify the wine.',
  '- Never change a field that already has a value.',
  '- Leave a field empty rather than guessing. An empty field is better than a wrong one.',
  '- wineType must be one of: ' + WINE_TYPES.join(', ') + '.',
  '- grapes is an array of variety names. abv is a number like 13.5, or null.',
  '- Reply with the complete JSON object in the same shape, and nothing else — no commentary, no markdown fence.',
].join('\n');

const isBlank = (record: EnrichmentRecord, field: Fillable): boolean => {
  const value = record[field];
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return false;
  return !String(value ?? '').trim();
};

const toRecord = (wine: WineFacts & { id: string }, kind: 'cellar' | 'diary'): EnrichmentRecord => ({
  id: wine.id,
  kind,
  producer: wine.producer,
  name: wine.name,
  vintage: wine.vintage,
  country: wine.country,
  region: wine.region,
  appellation: wine.appellation,
  classification: wine.classification,
  grapes: [...wine.grapes],
  wineType: wine.wineType,
  abv: wine.abv,
  sizeMl: wine.sizeMl,
});

/** True when a lookup has something to add. */
export const hasGaps = (record: EnrichmentRecord): boolean =>
  FILLABLE.some((field) => isBlank(record, field));

export interface BuildOptions {
  /** Keeps the reply inside what a chat can answer in one go. */
  limit?: number;
}

export const buildEnrichment = (
  wines: CellarWine[],
  diary: DiaryEntry[],
  { limit = 50 }: BuildOptions = {},
): EnrichmentFile => {
  const records = [
    ...wines.map((wine) => toRecord(wine, 'cellar')),
    ...diary.map((entry) => toRecord(entry, 'diary')),
  ].filter(hasGaps);

  return {
    format: 'cellarbook-enrichment',
    version: 1,
    exportedAt: new Date().toISOString(),
    instructions: INSTRUCTIONS,
    wines: records.slice(0, limit),
  };
};

export interface MergeReport {
  /** Records to write back, already merged. */
  wines: CellarWine[];
  diary: DiaryEntry[];
  /** How many individual fields were filled. */
  filled: number;
  /** Records whose id is not in this cellar. */
  unknown: number;
  /** Values the reply changed that were already set, and so were ignored. */
  ignored: number;
}

const cleanString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const cleanGrapes = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];

const cleanAbv = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : null;
};

const cleanType = (value: unknown): WineType | '' => {
  const text = cleanString(value);
  return (WINE_TYPES as readonly string[]).includes(text) ? (text as WineType) : '';
};

/**
 * Applies a reply to the cellar, filling blanks only. Anything already set is
 * kept, unknown ids are skipped, and no field outside the wine's own metadata
 * is touched — so a mangled or over-helpful reply cannot cost quantities,
 * prices, photos or tasting notes.
 */
export const mergeEnrichment = (
  file: unknown,
  wines: CellarWine[],
  diary: DiaryEntry[],
): MergeReport => {
  const parsed = file as Partial<EnrichmentFile>;
  if (!parsed || parsed.format !== 'cellarbook-enrichment' || !Array.isArray(parsed.wines)) {
    throw new Error('That is not a CellarBook enrichment file.');
  }

  const cellarById = new Map(wines.map((wine) => [wine.id, wine]));
  const diaryById = new Map(diary.map((entry) => [entry.id, entry]));
  const updatedWines = new Map<string, CellarWine>();
  const updatedDiary = new Map<string, DiaryEntry>();
  let filled = 0;
  let unknown = 0;
  let ignored = 0;

  for (const raw of parsed.wines) {
    const record = raw as Partial<EnrichmentRecord>;
    const id = cleanString(record.id);
    const existing = cellarById.get(id) ?? diaryById.get(id);
    if (!id || !existing) {
      unknown += 1;
      continue;
    }

    const patch: Partial<WineFacts> = {};
    const take = <K extends keyof WineFacts>(key: K, value: WineFacts[K], blank: boolean) => {
      if (!blank) {
        // The reply offered something for a field that already has a value.
        if (value !== undefined && String(value) !== String(existing[key])) ignored += 1;
        return;
      }
      if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) return;
      patch[key] = value;
      filled += 1;
    };

    take('country', cleanString(record.country), !existing.country.trim());
    take('region', cleanString(record.region), !existing.region.trim());
    take('appellation', cleanString(record.appellation), !existing.appellation.trim());
    take('classification', cleanString(record.classification), !existing.classification.trim());
    take('grapes', cleanGrapes(record.grapes), existing.grapes.length === 0);
    take('wineType', cleanType(record.wineType), !existing.wineType);
    take('abv', cleanAbv(record.abv), existing.abv === null);

    if (Object.keys(patch).length === 0) continue;

    if (cellarById.has(id)) {
      updatedWines.set(id, { ...(existing as CellarWine), ...patch });
    } else {
      updatedDiary.set(id, { ...(existing as DiaryEntry), ...patch });
    }
  }

  return {
    wines: [...updatedWines.values()],
    diary: [...updatedDiary.values()],
    filled,
    unknown,
    ignored,
  };
};
