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

/** One line per bottle, so a review can judge the collection, not a subset. */
export interface CollectionEntry {
  producer: string;
  name: string;
  vintage: number | null;
  country: string;
  region: string;
  grapes: string[];
  wineType: string;
  /** Bottles held — depth matters to a review. Cellar entries only. */
  quantity?: number;
  /** For bottles already drunk: what you thought of it. */
  rating?: number | null;
  drunkOn?: string;
}

/** A model's written verdict on the collection. */
export interface CellarReview {
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: { wine: string; why: string }[];
  /** When it was imported, not when it was written. */
  savedAt?: string;
}

export interface EnrichmentFile {
  format: 'cellarbook-enrichment';
  version: 1;
  exportedAt: string;
  instructions: string;
  wines: EnrichmentRecord[];
  cellar: CollectionEntry[];
  drunk: CollectionEntry[];
  review?: CellarReview;
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
  'This file describes a personal wine cellar. It asks for two things: missing metadata filled in, and a written review of the collection.',
  '',
  'PART 1 — fill the gaps in "wines".',
  'For each entry, search the web for that exact producer, cuvée and vintage, and fill in ONLY the fields that are currently empty: country, region, appellation, classification, grapes, wineType, abv.',
  '- Never change producer, name, vintage, id or kind. They identify the wine.',
  '- Never change a field that already has a value.',
  '- Leave a field empty rather than guessing. An empty field is better than a wrong one.',
  '- wineType must be one of: ' + WINE_TYPES.join(', ') + '.',
  '- grapes is an array of variety names. abv is a number like 13.5, or null.',
  '',
  'PART 2 — add a "review" object judging the collection.',
  'Read "cellar" (bottles held, with quantities) and "drunk" (bottles already drunk, with ratings) as a whole — not just the entries in "wines" — and write:',
  '  "summary": two or three sentences on what kind of cellar this is and what it is for.',
  '  "strengths": 2-5 short points on what it does well — depth, coherence, quality, ageing potential.',
  '  "gaps": 2-5 short points on what is thin or missing: styles, regions, price bands, drinking windows, anything unbalanced.',
  '  "suggestions": 3-6 objects of {"wine": "...", "why": "..."} naming specific producers or bottles worth buying next. Use the ratings in "drunk" to infer taste. Say plainly why each one addresses a gap or extends something already enjoyed.',
  'Be candid rather than flattering — an honest weakness is more useful than praise. Name real, findable wines.',
  '',
  'HOW TO DELIVER IT — this part matters.',
  'Create a downloadable file named "cellarbook-filled.json" containing the complete JSON object: the same shape as this file, with "wines" filled in and "review" added.',
  'Do NOT paste the JSON into the chat. It is imported by an app, not read by a person, and a chat message cannot be imported. The file is the deliverable; a short sentence saying what you found is welcome, the JSON itself is not.',
  'Keep every key from this file, including "format", "version" and each wine\'s "id" — the import matches on them.',
  'If you genuinely cannot produce a file, then print the raw JSON alone, with no commentary and no markdown fence, so it can be copied in one go.',
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

const COLLECTION_LIMIT = 400;

const toCollectionEntry = (wine: WineFacts): CollectionEntry => ({
  producer: wine.producer,
  name: wine.name,
  vintage: wine.vintage,
  country: wine.country,
  region: wine.region,
  grapes: [...wine.grapes],
  wineType: wine.wineType,
});

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
    // The whole collection, so the review judges the cellar rather than the
    // handful of entries that happen to be missing a field. Prices, purchase
    // details, storage, notes and photos stay on the device.
    cellar: wines
      .filter((wine) => wine.quantity > 0)
      .slice(0, COLLECTION_LIMIT)
      .map((wine) => ({ ...toCollectionEntry(wine), quantity: wine.quantity })),
    drunk: diary
      .slice(0, COLLECTION_LIMIT)
      .map((entry) => ({
        ...toCollectionEntry(entry),
        rating: entry.rating,
        drunkOn: entry.drunkOn,
      })),
  };
};

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const textList = (value: unknown, max = 6): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => text(item, 400))
        .filter(Boolean)
        .slice(0, max)
    : [];

/**
 * Keeps a review renderable: a pasted reply is unvalidated text, so lengths are
 * capped and anything that is not the expected shape is dropped rather than
 * rendered.
 */
export const sanitiseReview = (raw: unknown): CellarReview | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const review: CellarReview = {
    summary: text(source.summary, 1500),
    strengths: textList(source.strengths),
    gaps: textList(source.gaps),
    suggestions: Array.isArray(source.suggestions)
      ? source.suggestions
          .map((item) => {
            const entry = (item ?? {}) as Record<string, unknown>;
            return { wine: text(entry.wine, 200), why: text(entry.why, 400) };
          })
          .filter((entry) => entry.wine)
          .slice(0, 8)
      : [],
  };
  const empty =
    !review.summary &&
    review.strengths.length === 0 &&
    review.gaps.length === 0 &&
    review.suggestions.length === 0;
  return empty ? null : review;
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
  /** The written verdict, when the reply included one. */
  review: CellarReview | null;
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
    review: sanitiseReview((parsed as { review?: unknown }).review),
  };
};
