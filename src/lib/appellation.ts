import { APPELLATIONS, type Appellation } from '../data/appellations.ts';
import type { WineFacts } from '../types';

/** Lowercase, drop accents and punctuation, so "Rías Baixas" matches "rias baixas". */
export const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`.,()]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Quality wordings that appear alongside an appellation on the label. They are
 * stripped before matching, and the one that matched is offered as the
 * classification.
 */
const CLASSIFICATIONS: [RegExp, string][] = [
  // Most specific first: the first pattern to match wins, and every wording
  // below is a substring of the one above it — a premier grand cru classé that
  // met "grand cru classe" first would be filed a tier too low.
  [/\b(1er|premier) grand cru classe\b/, 'Premier Grand Cru Classé'],
  [/\bgrand cru classe\b/, 'Grand Cru Classé'],
  [/\b(1er|premier) cru\b/, 'Premier Cru'],
  [/\bgrand cru\b/, 'Grand Cru'],
  [/\bgran reserva\b/, 'Gran Reserva'],
  [/\breserva\b/, 'Reserva'],
  [/\briserva\b/, 'Riserva'],
  [/\bcrianza\b/, 'Crianza'],
  [/\bsuperiore\b/, 'Superiore'],
  [/\bclassico\b/, 'Classico'],
  [/\bkabinett\b/, 'Kabinett'],
  [/\bspatlese\b/, 'Spätlese'],
  [/\bauslese\b/, 'Auslese'],
  [/\bbeerenauslese\b/, 'Beerenauslese'],
  [/\btrockenbeerenauslese\b/, 'Trockenbeerenauslese'],
  [/\beiswein\b/, 'Eiswein'],
  [/\bgrosses gewachs\b/, 'Grosses Gewächs'],
];

/** Words that carry no matching signal but often sit in the appellation field. */
const NOISE = /\b(aoc|aop|ac|doc|docg|doca|do|dop|igt|igp|ava|pdo|vdp|controlee|controlata|denominazione|appellation|origine|protegee)\b/g;

interface Index {
  byName: Map<string, Appellation>;
  /** Longest first, so "Saint-Émilion Grand Cru" wins over "Saint-Émilion". */
  ordered: { key: string; entry: Appellation }[];
}

let index: Index | null = null;

const buildIndex = (): Index => {
  const byName = new Map<string, Appellation>();
  const ordered: { key: string; entry: Appellation }[] = [];

  for (const entry of APPELLATIONS) {
    for (const label of [entry.name, ...(entry.aliases ?? [])]) {
      const key = normalize(label);
      if (!byName.has(key)) byName.set(key, entry);
      ordered.push({ key, entry });
    }
  }
  ordered.sort((a, b) => b.key.length - a.key.length);
  return { byName, ordered };
};

const getIndex = () => (index ??= buildIndex());

export interface AppellationMatch {
  entry: Appellation;
  /** Classification read off the input text, e.g. "Premier Cru". */
  classification: string;
}

/**
 * Resolves free text from the appellation field to a known appellation.
 * Handles "Gevrey-Chambertin 1er Cru Les Cazetiers" as well as "chablis".
 */
export const findAppellation = (input: string): AppellationMatch | null => {
  const normalized = normalize(input);
  if (!normalized) return null;

  let classification = '';
  for (const [pattern, label] of CLASSIFICATIONS) {
    if (pattern.test(normalized)) {
      classification = label;
      break;
    }
  }

  const { byName, ordered } = getIndex();

  const exact = byName.get(normalized);
  if (exact) return { entry: exact, classification };

  // Strip the quality wording and appellation boilerplate, then try again.
  let stripped = normalized.replace(NOISE, ' ');
  for (const [pattern] of CLASSIFICATIONS) stripped = stripped.replace(pattern, ' ');
  stripped = stripped.replace(/\s+/g, ' ').trim();

  const afterStrip = byName.get(stripped);
  if (afterStrip) return { entry: afterStrip, classification };

  // Fall back to the longest known name contained in the text.
  for (const { key, entry } of ordered) {
    if (key.length < 4) continue;
    const boundary = new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (boundary.test(stripped) || boundary.test(normalized)) {
      return { entry, classification };
    }
  }

  return null;
};

/** Appellation names offered as autocomplete, best prefix matches first. */
export const suggestAppellations = (query: string, limit = 8): string[] => {
  const normalized = normalize(query);
  if (normalized.length < 2) return [];
  const starts: string[] = [];
  const contains: string[] = [];

  for (const entry of APPELLATIONS) {
    const key = normalize(entry.name);
    if (key.startsWith(normalized)) starts.push(entry.name);
    else if (key.includes(normalized)) contains.push(entry.name);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
};

/**
 * The fields a match can contribute. Only ever fills blanks — anything the user
 * or the label scan already provided is left exactly as it is.
 */
export const appellationPatch = (
  facts: Pick<WineFacts, 'country' | 'region' | 'grapes' | 'wineType' | 'classification'>,
  match: AppellationMatch,
): Partial<WineFacts> => {
  const patch: Partial<WineFacts> = {};
  if (!facts.country.trim()) patch.country = match.entry.country;
  if (!facts.region.trim()) patch.region = match.entry.region;
  if (facts.grapes.length === 0) patch.grapes = [...match.entry.grapes];
  if (!facts.wineType && match.entry.wineType) patch.wineType = match.entry.wineType;
  if (!facts.classification.trim()) {
    const classification = match.classification || match.entry.classification || '';
    if (classification) patch.classification = classification;
  }
  return patch;
};

/** Human-readable summary of what a patch filled in, for the hint under the field. */
export const describePatch = (patch: Partial<WineFacts>): string => {
  const labels: string[] = [];
  if (patch.country) labels.push('country');
  if (patch.region) labels.push('region');
  if (patch.grapes) labels.push('grapes');
  if (patch.wineType) labels.push('style');
  if (patch.classification) labels.push('classification');
  if (labels.length === 0) return '';
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Filled ${list} from the reference list — edit if this bottle differs.`;
};
