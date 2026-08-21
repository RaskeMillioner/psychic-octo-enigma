import type { CellarWine, WineFacts } from '../types';
import { normalize } from './appellation.ts';

/**
 * The parts of a wine that decide whether two bottles are the same thing.
 * A different vintage is a different wine, and so is a different bottle size —
 * a magnum of the 2016 does not belong on the same line as a 750 of it.
 */
type Identity = Pick<WineFacts, 'producer' | 'name' | 'vintage' | 'sizeMl'>;

const key = (wine: Identity): string =>
  [
    normalize(wine.producer),
    normalize(wine.name),
    wine.vintage === null ? 'nv' : String(wine.vintage),
    String(wine.sizeMl),
  ].join('|');

/**
 * The cellar entry that holds the same wine, or null. Producer and cuvée are
 * compared through the same normalisation the appellation pack uses, so
 * "Château Léoville-Barton" finds "Chateau Leoville Barton".
 *
 * A wine with neither producer nor cuvée carries no identity to match on, and
 * never counts as a duplicate — otherwise two barely-filled scans would merge.
 */
export const findDuplicate = (facts: Identity, wines: CellarWine[]): CellarWine | null => {
  if (!normalize(facts.producer) && !normalize(facts.name)) return null;
  const wanted = key(facts);
  return wines.find((wine) => key(wine) === wanted) ?? null;
};

/** Fields that a top-up may fill in, but never overwrite. */
const FILLABLE = [
  'country',
  'region',
  'appellation',
  'classification',
  'storageLocation',
  'purchasedFrom',
] as const;

const NUMERIC = ['abv', 'drinkFrom', 'drinkTo', 'purchasePrice'] as const;

/**
 * Folds a newly scanned bottle into the entry already held: the quantities add
 * up, and anything the existing record left blank is filled from the new one.
 * What the record already says is kept — the price and date of the original
 * purchase are facts about that purchase, and a later delivery does not revise
 * them.
 */
export const mergeIntoCellar = (
  existing: CellarWine,
  incoming: Omit<CellarWine, 'id' | 'createdAt' | 'updatedAt'>,
): CellarWine => {
  const merged: CellarWine = { ...existing, quantity: existing.quantity + incoming.quantity };

  for (const field of FILLABLE) {
    if (!merged[field].trim() && incoming[field].trim()) merged[field] = incoming[field];
  }
  if (!merged.wineType && incoming.wineType) merged.wineType = incoming.wineType;
  for (const field of NUMERIC) {
    if (merged[field] === null && incoming[field] !== null) merged[field] = incoming[field];
  }
  if (merged.grapes.length === 0 && incoming.grapes.length > 0) merged.grapes = [...incoming.grapes];
  if (!merged.purchaseDate && incoming.purchaseDate) merged.purchaseDate = incoming.purchaseDate;
  if (!merged.photoId && incoming.photoId) merged.photoId = incoming.photoId;
  if (incoming.notes.trim() && !merged.notes.includes(incoming.notes.trim())) {
    merged.notes = merged.notes.trim() ? `${merged.notes.trim()}\n${incoming.notes.trim()}` : incoming.notes.trim();
  }
  return merged;
};
