import type { WineFacts, WineType } from '../types';

/**
 * One description per field, shared by both providers' schemas so the two
 * cannot drift apart.
 */
export const FIELD_DESCRIPTIONS = {
  isWineLabel: 'False if the photo does not show a wine bottle or label.',
  producer: 'Producer, domaine, château or winery. Empty if unreadable.',
  name: 'Cuvée or bottling name as printed, e.g. "Clos Saint-Jacques". Empty if none.',
  country: 'Country of origin in English, e.g. "France".',
  region: 'Wine region, e.g. "Burgundy", "Piedmont", "Rioja".',
  appellation: 'Appellation or sub-region, e.g. "Gevrey-Chambertin 1er Cru", "Barolo".',
  grapes:
    'Grape varieties. If the label omits them but the appellation implies them (Chablis = Chardonnay), list the standard varieties. Empty array if genuinely unknown.',
  vintage: 'Four-digit vintage year, "NV" for non-vintage, or "" if unclear.',
  classification: 'Quality classification, e.g. "Grand Cru", "DOCG", "Riserva", "Gran Reserva".',
  wineType: 'Style of the wine.',
  abv: 'Alcohol by volume as a number without the % sign, e.g. "13.5".',
  sizeMl: 'Bottle volume in millilitres, e.g. "750". Default to "750".',
  drinkFrom:
    'First year this wine is worth opening, as four digits. Use the producer\'s own advice where you can find it, otherwise the usual maturity for this appellation and vintage. Empty if you have no basis for it.',
  drinkTo:
    'Last year this wine is likely to be at its best, as four digits. Empty if you have no basis for it.',
  confidence: 'How confident you are in the identification overall.',
  fields:
    'Where each field came from, one entry per field. "label" = read directly off the photographed label. "web" = found by searching online for this producer and cuvée. "knowledge" = not stated anywhere but implied by the appellation or producer (Chablis means Chardonnay). "guess" = your best attempt but genuinely uncertain, so the user must check it. "none" = you left the field empty. Be honest: mark "guess" rather than "knowledge" whenever you are unsure.',
  notes:
    'One short sentence: what was read off the label versus filled in from knowledge, and anything the user should double-check.',
} as const;

export const SYSTEM_PROMPT = `You are an expert sommelier and wine label reader working inside a cellar-tracking app.

Read the photographed label and identify the wine. Then:
- Transcribe what is printed exactly — producer, cuvée, vintage, appellation, classification, alcohol, bottle volume.
- Then SEARCH THE WEB for this exact wine — producer, cuvée and vintage — and use what you find to complete and correct the fields the label does not state: the grape blend, the appellation and region, the classification, the alcohol. Prefer the producer's own site, then a merchant or reference site that names the wine exactly. Search for the specific vintage where the blend varies by year.
- Only where searching finds nothing, fall back to what the appellation implies (a Chablis is Chardonnay; a Barolo is Nebbiolo from Piedmont, Italy).
- Never invent a producer, cuvée or vintage that you cannot see or confidently recognise. Leave a field empty rather than guessing.
- If the photo is blurry, cropped or shows a back label only, extract what you can and say so in "notes".
- Set confidence to "low" when you are unsure which wine this is, even if the text is legible.
- Fill in "fields" honestly for every field: where its value came from, and "guess" whenever you are not sure. The user reviews the low-confidence ones, so an overconfident mark costs them more than an honest doubt.`;

export const USER_PROMPT = 'Identify this wine from its label.';

/**
 * Everything is a string or an enum rather than a nullable number: it keeps the
 * schema strict-friendly on both providers and lets the model say "unknown"
 * with an empty string instead of guessing a value.
 */
export interface LabelReading {
  isWineLabel: boolean;
  producer: string;
  name: string;
  country: string;
  region: string;
  appellation: string;
  grapes: string[];
  vintage: string;
  classification: string;
  wineType: string;
  abv: string;
  sizeMl: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  fields?: Record<string, string>;
  drinkFrom?: string;
  drinkTo?: string;
}

/** The drinking window, which lives on the cellar record rather than on WineFacts. */
export interface DrinkWindow {
  drinkFrom: number | null;
  drinkTo: number | null;
}

const year = (value: unknown): number | null => {
  const text = String(value ?? '').trim();
  return /^\d{4}$/.test(text) ? Number(text) : null;
};

export const toWindow = (reading: LabelReading): DrinkWindow => ({
  drinkFrom: year(reading.drinkFrom),
  drinkTo: year(reading.drinkTo),
});

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

/** Where a single field's value came from, which is also how sure we are of it. */
export const FIELD_ORIGINS = ['label', 'web', 'knowledge', 'guess', 'none'] as const;
export type FieldOrigin = (typeof FIELD_ORIGINS)[number];

/** The metadata fields a model fills in, and so the ones it reports an origin for. */
export const PROVENANCE_KEYS = [
  'producer',
  'name',
  'country',
  'region',
  'appellation',
  'grapes',
  'vintage',
  'classification',
  'wineType',
  'abv',
  'sizeMl',
] as const;
export type ProvenanceKey = (typeof PROVENANCE_KEYS)[number];

export type Provenance = Partial<Record<ProvenanceKey, FieldOrigin>>;

/** Note shown under a field, and whether it should be flagged for review. */
export const ORIGIN_LABELS: Record<FieldOrigin, { note: string; low: boolean }> = {
  label: { note: 'From the label · high confidence', low: false },
  web: { note: 'Found online · high confidence', low: false },
  knowledge: { note: 'Inferred, not stated · medium confidence', low: false },
  guess: { note: 'Uncertain · low confidence — please check', low: true },
  none: { note: '', low: false },
};

/**
 * Drops the notes for fields the user has just edited: once a value is theirs,
 * where the model got its own value is no longer true of what is on screen.
 */
export const forgetTouched = (provenance: Provenance, patch: object): Provenance => {
  const next = { ...provenance };
  for (const key of Object.keys(patch)) delete next[key as ProvenanceKey];
  return next;
};

/** Keeps only the origins the model actually reported, discarding anything odd. */
export const toProvenance = (raw: unknown): Provenance => {
  const source = (raw ?? {}) as Record<string, unknown>;
  const provenance: Provenance = {};
  for (const key of PROVENANCE_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && (FIELD_ORIGINS as readonly string[]).includes(value)) {
      if (value !== 'none') provenance[key] = value as FieldOrigin;
    }
  }
  return provenance;
};

const toNumber = (value: string): number | null => {
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Normalises a model's reading into the app's own wine metadata shape. */
export const toFacts = (reading: LabelReading, wineTypes: readonly string[]): WineFacts => {
  const vintage = text(reading.vintage);
  const wineType = text(reading.wineType);
  return {
    name: text(reading.name),
    producer: text(reading.producer),
    country: text(reading.country),
    region: text(reading.region),
    appellation: text(reading.appellation),
    grapes: Array.isArray(reading.grapes) ? reading.grapes.map(text).filter(Boolean) : [],
    vintage: /^\d{4}$/.test(vintage) ? Number(vintage) : null,
    classification: text(reading.classification),
    wineType: wineTypes.includes(wineType) ? (wineType as WineType) : '',
    abv: toNumber(reading.abv),
    sizeMl: toNumber(reading.sizeMl) ?? 750,
  };
};

export const normaliseConfidence = (value: unknown): LabelReading['confidence'] =>
  value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
