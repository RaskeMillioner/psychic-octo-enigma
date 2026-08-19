import { BOTTLE_SIZES, type DiaryEntry, type WineFacts } from '../types.ts';

/** Headline for a wine: cuvée if it has one, otherwise appellation or producer. */
export const wineTitle = (wine: WineFacts): string =>
  wine.name || wine.appellation || wine.producer || 'Untitled wine';

export const vintageLabel = (vintage: number | null): string => (vintage ? String(vintage) : 'NV');

export const sizeLabel = (ml: number): string => {
  const known = BOTTLE_SIZES.find((size) => size.ml === ml);
  if (known) return known.label.replace(/^[^(]+\(|\)$/g, '');
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)} L` : `${ml} ml`;
};

/** "Chablis · Burgundy, France" — the one-line origin summary used on cards. */
export const originLine = (wine: WineFacts): string =>
  [wine.appellation || wine.region, wine.region && wine.appellation ? wine.region : '', wine.country]
    .filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(' · ');

/**
 * Where a bottle was drunk, as one line. The venue's country is left off the
 * short form, which is what cards and lists want.
 */
export const placeLabel = (
  entry: Pick<DiaryEntry, 'setting' | 'place' | 'venue' | 'city' | 'venueCountry'>,
  { full = false }: { full?: boolean } = {},
): string => {
  if (entry.setting !== 'venue') return entry.place.trim();
  const parts = full
    ? [entry.venue, entry.city, entry.venueCountry]
    : [entry.venue, entry.city];
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
};

export const formatMoney = (amount: number | null, currency: string): string => {
  if (amount === null || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export const formatDate = (iso: string): string => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const monthLabel = (iso: string): string => {
  const date = new Date(`${iso.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
};

export const todayIso = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export const parseGrapes = (input: string): string[] =>
  input
    .split(',')
    .map((grape) => grape.trim())
    .filter(Boolean);
