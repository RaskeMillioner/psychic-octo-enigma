import { windowStatus } from './drinkWindow.ts';
import { placeLabel } from './format.ts';
import type { CellarWine, DiaryEntry, WineFacts } from '../types';

export interface Slice {
  label: string;
  value: number;
  /** Secondary figure shown next to the value, e.g. the bottle count behind an average. */
  detail?: string;
}

const OTHER = 'Other';

/**
 * Sums `weight` per key and returns the biggest slices, folding the tail into
 * "Other" so no chart ever grows an unbounded number of categories.
 */
const rank = (
  entries: [string, number][],
  limit: number,
  { fold = true }: { fold?: boolean } = {},
): Slice[] => {
  const totals = new Map<string, number>();
  for (const [key, weight] of entries) {
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + weight);
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (sorted.length <= limit) return sorted.map(([label, value]) => ({ label, value }));

  const head = sorted.slice(0, fold ? limit - 1 : limit);
  const result: Slice[] = head.map(([label, value]) => ({ label, value }));
  if (fold) {
    const tail = sorted.slice(limit - 1);
    result.push({
      label: OTHER,
      value: tail.reduce((sum, [, value]) => sum + value, 0),
      detail: `${tail.length} more`,
    });
  }
  return result;
};

const grapeEntries = <T extends WineFacts>(items: T[], weight: (item: T) => number) =>
  items.flatMap((item) => item.grapes.map((grape) => [grape, weight(item)] as [string, number]));

/* ------------------------------------------------------------------ cellar */

export interface CellarStats {
  bottles: number;
  wines: number;
  countries: number;
  value: number | null;
  currency: string;
  valueCoverage: number;
  /** True when bottles were bought in more than one currency — see `value`. */
  mixedCurrency: boolean;
  byCountry: Slice[];
  byType: Slice[];
  byRegion: Slice[];
  byGrape: Slice[];
  byProducer: Slice[];
  byVintage: Slice[];
  readyNow: number;
}

export const cellarStats = (wines: CellarWine[], fallbackCurrency: string): CellarStats => {
  const stocked = wines.filter((wine) => wine.quantity > 0);
  const bottles = stocked.reduce((sum, wine) => sum + wine.quantity, 0);
  const qty = (wine: CellarWine) => wine.quantity;

  // Totalled per currency and reported in the one most of the money is in:
  // adding kroner to euros gives a number that means nothing, and quietly
  // labelling the sum with whichever wine happened to come first is worse than
  // saying the cellar is mixed.
  const priced = stocked.filter((wine) => wine.purchasePrice !== null);
  const totals = new Map<string, { value: number; bottles: number }>();
  for (const wine of priced) {
    const key = wine.currency || fallbackCurrency;
    const running = totals.get(key) ?? { value: 0, bottles: 0 };
    running.value += (wine.purchasePrice ?? 0) * wine.quantity;
    running.bottles += wine.quantity;
    totals.set(key, running);
  }
  const [currency, dominant] = [...totals.entries()].sort(
    (a, b) => b[1].value - a[1].value || a[0].localeCompare(b[0]),
  )[0] ?? [fallbackCurrency, { value: 0, bottles: 0 }];
  const value = dominant.value;
  const pricedBottles = dominant.bottles;

  const thisYear = new Date().getFullYear();
  // A wine with no window recorded is not evidence of readiness, so it is not
  // counted here — the cellar view draws the same distinction.
  const readyNow = stocked
    .filter((wine) => windowStatus(wine, thisYear) === 'ready')
    .reduce((sum, wine) => sum + wine.quantity, 0);

  const vintages = new Map<string, number>();
  for (const wine of stocked) {
    const key = wine.vintage ? String(wine.vintage) : 'NV';
    vintages.set(key, (vintages.get(key) ?? 0) + wine.quantity);
  }
  const byVintage = [...vintages.entries()]
    .sort((a, b) => (a[0] === 'NV' ? 1 : b[0] === 'NV' ? -1 : Number(a[0]) - Number(b[0])))
    .map(([label, value_]) => ({ label, value: value_ }));

  return {
    bottles,
    wines: stocked.length,
    countries: new Set(stocked.map((wine) => wine.country).filter(Boolean)).size,
    value: pricedBottles ? value : null,
    currency,
    valueCoverage: bottles ? pricedBottles / bottles : 0,
    mixedCurrency: totals.size > 1,
    byCountry: rank(stocked.map((wine) => [wine.country, qty(wine)]), 8),
    byType: rank(stocked.map((wine) => [wine.wineType || 'Unspecified', qty(wine)]), 8, {
      fold: false,
    }),
    byRegion: rank(stocked.map((wine) => [wine.region, qty(wine)]), 8),
    byGrape: rank(grapeEntries(stocked, qty), 8),
    byProducer: rank(stocked.map((wine) => [wine.producer, qty(wine)]), 8),
    byVintage,
    readyNow,
  };
};

/* ------------------------------------------------------------------- diary */

export interface DiaryStats {
  bottles: number;
  thisYear: number;
  rated: number;
  averageRating: number | null;
  producers: number;
  spend: number | null;
  currency: string;
  perMonth: Slice[];
  byCountry: Slice[];
  byType: Slice[];
  byGrape: Slice[];
  byProducer: Slice[];
  byPlace: Slice[];
  /** Bottles consumed out rather than at home. */
  atVenue: number;
  ratingSpread: Slice[];
  ratingByCountry: Slice[];
  ratingByType: Slice[];
}

const monthKey = (iso: string) => iso.slice(0, 7);

const shortMonth = (key: string) => {
  const date = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
};

/** Averages ratings per key, keeping only keys with enough bottles to mean anything. */
const averageBy = (
  entries: DiaryEntry[],
  key: (entry: DiaryEntry) => string,
  minimum = 2,
): Slice[] => {
  const buckets = new Map<string, number[]>();
  for (const entry of entries) {
    if (entry.rating === null) continue;
    const bucketKey = key(entry);
    if (!bucketKey) continue;
    const bucket = buckets.get(bucketKey);
    if (bucket) bucket.push(entry.rating);
    else buckets.set(bucketKey, [entry.rating]);
  }
  return [...buckets.entries()]
    .filter(([, ratings]) => ratings.length >= minimum)
    .map(([label, ratings]) => ({
      label,
      value: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
      detail: `${ratings.length} btl`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
};

export const diaryStats = (diary: DiaryEntry[], fallbackCurrency: string): DiaryStats => {
  const thisYear = String(new Date().getFullYear());
  const rated = diary.filter((entry) => entry.rating !== null);
  const priced = diary.filter((entry) => entry.price !== null);

  // Twelve months ending with the current one, so quiet months stay visible.
  // Counted in one pass rather than a filter of the whole diary per month.
  const counts = new Map<string, number>();
  for (const entry of diary) {
    const key = monthKey(entry.drunkOn);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const months: Slice[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      label: shortMonth(key),
      value: counts.get(key) ?? 0,
      detail: String(date.getFullYear()),
    });
  }

  const ratingSpread = [1, 2, 3, 4, 5].map((star) => ({
    label: '★'.repeat(star),
    value: rated.filter((entry) => entry.rating === star).length,
  }));

  return {
    bottles: diary.length,
    thisYear: diary.filter((entry) => entry.drunkOn.startsWith(thisYear)).length,
    rated: rated.length,
    averageRating: rated.length
      ? rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length
      : null,
    producers: new Set(diary.map((entry) => entry.producer).filter(Boolean)).size,
    spend: priced.length ? priced.reduce((sum, entry) => sum + (entry.price ?? 0), 0) : null,
    currency: priced[0]?.currency || fallbackCurrency,
    perMonth: months,
    byCountry: rank(diary.map((entry) => [entry.country, 1]), 8),
    byType: rank(diary.map((entry) => [entry.wineType || 'Unspecified', 1]), 8, { fold: false }),
    byGrape: rank(grapeEntries(diary, () => 1), 8),
    byProducer: rank(diary.map((entry) => [entry.producer, 1]), 8),
    byPlace: rank(diary.map((entry) => [placeLabel(entry), 1]), 6),
    atVenue: diary.filter((entry) => entry.setting === 'venue').length,
    ratingSpread,
    ratingByCountry: averageBy(diary, (entry) => entry.country),
    ratingByType: averageBy(diary, (entry) => entry.wineType),
  };
};
