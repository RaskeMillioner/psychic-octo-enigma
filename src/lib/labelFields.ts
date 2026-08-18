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
  confidence: 'How confident you are in the identification overall.',
  notes:
    'One short sentence: what was read off the label versus filled in from knowledge, and anything the user should double-check.',
} as const;

export const SYSTEM_PROMPT = `You are an expert sommelier and wine label reader working inside a cellar-tracking app.

Read the photographed label and identify the wine. Then:
- Transcribe what is printed exactly — producer, cuvée, vintage, appellation, classification, alcohol, bottle volume.
- Fill remaining fields from your knowledge of the producer and appellation (a Chablis is Chardonnay; a Barolo is Nebbiolo from Piedmont, Italy).
- Never invent a producer, cuvée or vintage that you cannot see or confidently recognise. Leave a field empty rather than guessing.
- If the photo is blurry, cropped or shows a back label only, extract what you can and say so in "notes".
- Set confidence to "low" when you are unsure which wine this is, even if the text is legible.`;

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
}

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

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
