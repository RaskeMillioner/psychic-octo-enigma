import { z } from 'zod';
import { WINE_TYPES } from '../types';
import { CONFIDENCE_LEVELS, FIELD_DESCRIPTIONS as D, FIELD_ORIGINS } from './labelFields.ts';

const origin = z.enum(FIELD_ORIGINS);

/** The Claude structured-output schema. Field meanings live in labelFields.ts. */
export const LabelSchema = z.object({
  isWineLabel: z.boolean().describe(D.isWineLabel),
  producer: z.string().describe(D.producer),
  name: z.string().describe(D.name),
  country: z.string().describe(D.country),
  region: z.string().describe(D.region),
  appellation: z.string().describe(D.appellation),
  grapes: z.array(z.string()).describe(D.grapes),
  vintage: z.string().describe(D.vintage),
  classification: z.string().describe(D.classification),
  wineType: z.enum([...WINE_TYPES, 'Unknown']).describe(D.wineType),
  abv: z.string().describe(D.abv),
  sizeMl: z.string().describe(D.sizeMl),
  confidence: z.enum(CONFIDENCE_LEVELS).describe(D.confidence),
  notes: z.string().describe(D.notes),
  fields: z
    .object({
      producer: origin,
      name: origin,
      country: origin,
      region: origin,
      appellation: origin,
      grapes: origin,
      vintage: origin,
      classification: origin,
      wineType: origin,
      abv: origin,
      sizeMl: origin,
    })
    .describe(D.fields),
});
