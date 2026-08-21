import { WINE_TYPES, type WineType } from '../types.ts';
import { CONFIDENCE_LEVELS } from './labelFields.ts';

/**
 * One description per field, shared by both providers' receipt schemas the same
 * way `labelFields.ts` shares the label ones.
 */
export const RECEIPT_DESCRIPTIONS = {
  isReceipt: 'False if the photo is not a receipt, invoice or order confirmation.',
  merchant: 'The shop, importer or restaurant that issued the receipt, as printed.',
  purchaseDate: 'Date on the receipt as YYYY-MM-DD. Empty if not printed or unreadable.',
  currency:
    'Three-letter currency code for the prices, e.g. "EUR", "NOK", "GBP". Infer it from the currency symbol or the country of the merchant.',
  notes: 'One short sentence: what was hard to read, and anything the user should check.',
  lines: 'One entry per wine bought. Leave the array empty if the photo shows no wine lines.',
  lineText: 'The line exactly as printed on the receipt, so the user can compare.',
  producer:
    'Producer, domaine, château or winery, expanded to its full name — "Ch. Margaux" is "Château Margaux".',
  name: 'Cuvée or bottling name. Empty if the line names only the producer or the appellation.',
  vintage: 'Four-digit vintage year, "NV" for non-vintage, or "" if the line does not say.',
  quantity: 'Number of bottles of this wine on the line, as digits. Default "1".',
  unitPrice:
    'Price for ONE bottle, as a plain number with a dot for decimals and no currency symbol. If the line shows only a line total, divide it by the quantity. Empty if no price is printed.',
  sizeMl:
    'Bottle volume in millilitres. "750" unless the line says otherwise ("magnum" is 1500, "37,5 cl" is 375).',
  country: 'Country of origin in English.',
  region: 'Wine region, e.g. "Burgundy", "Piedmont".',
  appellation: 'Appellation or sub-region, e.g. "Gevrey-Chambertin 1er Cru", "Barolo".',
  grapes: 'Grape varieties. Empty array if unknown.',
  wineType: 'Style of the wine.',
  confidence: 'How confident you are that you identified this line correctly.',
} as const;

export const RECEIPT_SYSTEM_PROMPT = `You are an expert sommelier reading a wine merchant's receipt inside a cellar-tracking app.

The user photographed a receipt, invoice or order confirmation and wants every bottle on it added to their cellar. For each line:
- Read the printed text, the quantity and the price exactly as they appear.
- Merchant receipts abbreviate brutally: "CH MARGAUX 15", "GEVREY 1C LAVAUX 2019 MAG", "POL ROGER BRUT NV". Expand the shorthand into the real producer, cuvée and vintage. A two-digit year at the end of a line is almost always the vintage ("15" is 2015).
- SEARCH THE WEB for the wine you think the line names, to confirm the producer and cuvée and to fill in the region, appellation, grapes and style. Search the specific vintage where it matters.
- Prices: work out the price of ONE bottle. Receipts show quantity, unit price and line total in any arrangement, and sometimes only the total — divide it by the quantity when that is all there is.
- Skip anything that is not wine in a bottle: delivery and shipping, glassware, corkscrews, bags, deposits, discounts, tasting fees, subtotals, VAT and the grand total. They are not cellar entries.
- Set a line's confidence to "low" whenever you are unsure which wine it is or what the price was. The user checks every line before anything is saved, and an honest doubt costs them far less than a confident mistake.
- If the photo is cropped, creased or partly illegible, read what you can and say so in "notes". Never invent a line that is not printed.`;

export const RECEIPT_USER_PROMPT = 'Read this receipt and list every wine on it.';

/** As with labels, everything comes back as a string so "unknown" is expressible. */
export interface ReceiptLineReading {
  lineText: string;
  producer: string;
  name: string;
  vintage: string;
  quantity: string;
  unitPrice: string;
  sizeMl: string;
  country: string;
  region: string;
  appellation: string;
  grapes: string[];
  wineType: string;
  confidence: string;
}

export interface ReceiptReading {
  isReceipt: boolean;
  merchant: string;
  purchaseDate: string;
  currency: string;
  notes: string;
  lines: ReceiptLineReading[];
}

/** A receipt line after normalisation, ready for the review list. */
export interface ReceiptLine {
  lineText: string;
  producer: string;
  name: string;
  vintage: number | null;
  quantity: number;
  unitPrice: number | null;
  sizeMl: number;
  country: string;
  region: string;
  appellation: string;
  grapes: string[];
  wineType: WineType | '';
  confidence: 'high' | 'medium' | 'low';
}

export interface Receipt {
  isReceipt: boolean;
  merchant: string;
  purchaseDate: string;
  currency: string;
  notes: string;
  lines: ReceiptLine[];
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const number = (value: unknown): number | null => {
  // "1 245,50" and "1,245.50" both mean the same thing; strip the grouping and
  // settle on a dot before parsing.
  const cleaned = text(value).replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  const normalised =
    /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalises a model's reading of a receipt into the app's own shape. */
export const toReceipt = (reading: ReceiptReading): Receipt => {
  const lines = Array.isArray(reading.lines) ? reading.lines : [];
  const currency = text(reading.currency).toUpperCase().slice(0, 3);
  return {
    isReceipt: reading.isReceipt !== false,
    merchant: text(reading.merchant),
    purchaseDate: ISO_DATE.test(text(reading.purchaseDate)) ? text(reading.purchaseDate) : '',
    currency,
    notes: text(reading.notes),
    lines: lines.map((line) => {
      const vintage = text(line.vintage);
      const wineType = text(line.wineType);
      const confidence = text(line.confidence);
      const quantity = number(line.quantity);
      return {
        lineText: text(line.lineText),
        producer: text(line.producer),
        name: text(line.name),
        vintage: /^\d{4}$/.test(vintage) ? Number(vintage) : null,
        // A receipt line is at least one bottle: a quantity the model could not
        // read is not a reason to add nothing.
        quantity: quantity && quantity > 0 ? Math.round(quantity) : 1,
        unitPrice: number(line.unitPrice),
        sizeMl: number(line.sizeMl) ?? 750,
        country: text(line.country),
        region: text(line.region),
        appellation: text(line.appellation),
        grapes: Array.isArray(line.grapes) ? line.grapes.map(text).filter(Boolean) : [],
        wineType: (WINE_TYPES as readonly string[]).includes(wineType) ? (wineType as WineType) : '',
        confidence:
          confidence === 'high' || confidence === 'medium' || confidence === 'low'
            ? confidence
            : 'low',
      };
    }),
  };
};

const D = RECEIPT_DESCRIPTIONS;

const LINE_PROPERTIES = {
  lineText: { type: 'STRING', description: D.lineText },
  producer: { type: 'STRING', description: D.producer },
  name: { type: 'STRING', description: D.name },
  vintage: { type: 'STRING', description: D.vintage },
  quantity: { type: 'STRING', description: D.quantity },
  unitPrice: { type: 'STRING', description: D.unitPrice },
  sizeMl: { type: 'STRING', description: D.sizeMl },
  country: { type: 'STRING', description: D.country },
  region: { type: 'STRING', description: D.region },
  appellation: { type: 'STRING', description: D.appellation },
  grapes: { type: 'ARRAY', items: { type: 'STRING' }, description: D.grapes },
  wineType: { type: 'STRING', enum: [...WINE_TYPES, 'Unknown'], description: D.wineType },
  confidence: { type: 'STRING', enum: [...CONFIDENCE_LEVELS], description: D.confidence },
};

/** The Gemini (OpenAPI-subset) schema for a receipt. */
export const RECEIPT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isReceipt: { type: 'BOOLEAN', description: D.isReceipt },
    merchant: { type: 'STRING', description: D.merchant },
    purchaseDate: { type: 'STRING', description: D.purchaseDate },
    currency: { type: 'STRING', description: D.currency },
    notes: { type: 'STRING', description: D.notes },
    lines: {
      type: 'ARRAY',
      description: D.lines,
      items: {
        type: 'OBJECT',
        properties: LINE_PROPERTIES,
        required: Object.keys(LINE_PROPERTIES),
        propertyOrdering: Object.keys(LINE_PROPERTIES),
      },
    },
  },
  required: ['isReceipt', 'merchant', 'purchaseDate', 'currency', 'notes', 'lines'],
  propertyOrdering: ['isReceipt', 'merchant', 'purchaseDate', 'currency', 'notes', 'lines'],
};
