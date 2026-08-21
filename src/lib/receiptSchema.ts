import { z } from 'zod';
import { WINE_TYPES } from '../types';
import { CONFIDENCE_LEVELS } from './labelFields.ts';
import { RECEIPT_DESCRIPTIONS as D } from './receiptFields.ts';

/** The Claude structured-output schema. Field meanings live in receiptFields.ts. */
export const ReceiptSchema = z.object({
  isReceipt: z.boolean().describe(D.isReceipt),
  merchant: z.string().describe(D.merchant),
  purchaseDate: z.string().describe(D.purchaseDate),
  currency: z.string().describe(D.currency),
  notes: z.string().describe(D.notes),
  lines: z
    .array(
      z.object({
        lineText: z.string().describe(D.lineText),
        producer: z.string().describe(D.producer),
        name: z.string().describe(D.name),
        vintage: z.string().describe(D.vintage),
        quantity: z.string().describe(D.quantity),
        unitPrice: z.string().describe(D.unitPrice),
        sizeMl: z.string().describe(D.sizeMl),
        country: z.string().describe(D.country),
        region: z.string().describe(D.region),
        appellation: z.string().describe(D.appellation),
        grapes: z.array(z.string()).describe(D.grapes),
        wineType: z.enum([...WINE_TYPES, 'Unknown']).describe(D.wineType),
        confidence: z.enum(CONFIDENCE_LEVELS).describe(D.confidence),
      }),
    )
    .describe(D.lines),
});
