import type { CellarWine } from '../types.ts';

/**
 * Where a bottle stands against its drinking window. One bound is enough to
 * place it; with neither, the honest answer is that we do not know — which is
 * a different thing from "ready", and the reason this exists rather than a
 * boolean.
 */
export type WindowStatus = 'ready' | 'young' | 'past' | 'unknown';

type Windowed = Pick<CellarWine, 'drinkFrom' | 'drinkTo'>;

export const windowStatus = (wine: Windowed, year: number): WindowStatus => {
  const { drinkFrom, drinkTo } = wine;
  if (drinkFrom === null && drinkTo === null) return 'unknown';
  if (drinkFrom !== null && year < drinkFrom) return 'young';
  if (drinkTo !== null && year > drinkTo) return 'past';
  return 'ready';
};

export const WINDOW_FILTERS: { key: WindowStatus | ''; label: string }[] = [
  { key: '', label: 'Any readiness' },
  { key: 'ready', label: 'Ready now' },
  { key: 'young', label: 'Too young' },
  { key: 'past', label: 'Past its window' },
  { key: 'unknown', label: 'No window' },
];

/** Short note for a wine card, e.g. "Ready now" or "From 2030". */
export const windowLabel = (wine: Windowed, year: number): string => {
  switch (windowStatus(wine, year)) {
    case 'ready':
      return wine.drinkTo ? `Ready now, until ${wine.drinkTo}` : 'Ready now';
    case 'young':
      return `From ${wine.drinkFrom}`;
    case 'past':
      return `Past its window (${wine.drinkTo})`;
    default:
      return '';
  }
};
