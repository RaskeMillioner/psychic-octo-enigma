import { z } from 'zod';
import { WINE_TYPES, type WineFacts, type WineType } from '../types';

/**
 * Everything comes back as a string or an enum rather than a nullable number:
 * it keeps the schema strict-friendly and lets the model say "unknown" with an
 * empty string instead of guessing a value.
 */
export const LabelSchema = z.object({
  isWineLabel: z.boolean().describe('False if the photo does not show a wine bottle or label.'),
  producer: z.string().describe('Producer, domaine, château or winery. Empty if unreadable.'),
  name: z
    .string()
    .describe('Cuvée or bottling name as printed, e.g. "Clos Saint-Jacques". Empty if none.'),
  country: z.string().describe('Country of origin in English, e.g. "France".'),
  region: z.string().describe('Wine region, e.g. "Burgundy", "Piedmont", "Rioja".'),
  appellation: z
    .string()
    .describe('Appellation or sub-region, e.g. "Gevrey-Chambertin 1er Cru", "Barolo".'),
  grapes: z
    .array(z.string())
    .describe(
      'Grape varieties. If the label omits them but the appellation implies them (Chablis = Chardonnay), list the standard varieties. Empty array if genuinely unknown.',
    ),
  vintage: z.string().describe('Four-digit vintage year, "NV" for non-vintage, or "" if unclear.'),
  classification: z
    .string()
    .describe('Quality classification, e.g. "Grand Cru", "DOCG", "Riserva", "Gran Reserva".'),
  wineType: z.enum([...WINE_TYPES, 'Unknown']).describe('Style of the wine.'),
  abv: z.string().describe('Alcohol by volume as a number without the % sign, e.g. "13.5".'),
  sizeMl: z.string().describe('Bottle volume in millilitres, e.g. "750". Default to "750".'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('How confident you are in the identification overall.'),
  notes: z
    .string()
    .describe(
      'One short sentence: what was read off the label versus filled in from knowledge, and anything the user should double-check.',
    ),
});

export type LabelReading = z.infer<typeof LabelSchema>;

const toNumber = (value: string): number | null => {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const toFacts = (reading: LabelReading): WineFacts => ({
  name: reading.name.trim(),
  producer: reading.producer.trim(),
  country: reading.country.trim(),
  region: reading.region.trim(),
  appellation: reading.appellation.trim(),
  grapes: reading.grapes.map((grape) => grape.trim()).filter(Boolean),
  vintage: /^\d{4}$/.test(reading.vintage.trim()) ? Number(reading.vintage.trim()) : null,
  classification: reading.classification.trim(),
  wineType: reading.wineType === 'Unknown' ? '' : (reading.wineType as WineType),
  abv: toNumber(reading.abv),
  sizeMl: toNumber(reading.sizeMl) ?? 750,
});

