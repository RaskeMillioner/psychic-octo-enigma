/** Shared domain types for the cellar and the diary. */

export const WINE_TYPES = [
  'Red',
  'White',
  'Rosé',
  'Sparkling',
  'Orange',
  'Dessert',
  'Fortified',
] as const;
export type WineType = (typeof WINE_TYPES)[number];

export const BOTTLE_SIZES = [
  { label: 'Piccolo (187 ml)', ml: 187 },
  { label: 'Half (375 ml)', ml: 375 },
  { label: 'Bottle (750 ml)', ml: 750 },
  { label: 'Magnum (1.5 L)', ml: 1500 },
  { label: 'Double Magnum (3 L)', ml: 3000 },
  { label: 'Jeroboam (5 L)', ml: 5000 },
  { label: 'Imperial (6 L)', ml: 6000 },
] as const;

/** Metadata describing the wine itself — shared by cellar entries and diary entries. */
export interface WineFacts {
  /** Cuvée / bottling name, e.g. "Clos du Mesnil" or "Barolo Cannubi". */
  name: string;
  producer: string;
  country: string;
  region: string;
  /** Appellation or sub-region, e.g. "Gevrey-Chambertin 1er Cru". */
  appellation: string;
  /** Grape varieties. Empty when unknown. */
  grapes: string[];
  /** Null for non-vintage bottlings. */
  vintage: number | null;
  /** e.g. "Grand Cru", "DOCG", "Riserva", "VDP.Grosse Lage". */
  classification: string;
  wineType: WineType | '';
  /** Alcohol by volume in percent. */
  abv: number | null;
  /** Bottle size in millilitres. */
  sizeMl: number;
}

export interface CellarWine extends WineFacts {
  id: string;
  quantity: number;
  /** Price paid per bottle. */
  purchasePrice: number | null;
  currency: string;
  purchaseDate: string;
  purchasedFrom: string;
  /** Suggested drinking window. */
  drinkFrom: number | null;
  drinkTo: number | null;
  /** Where the bottles physically sit, e.g. "Rack 3, bin B". */
  storageLocation: string;
  notes: string;
  photoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntry extends WineFacts {
  id: string;
  /** Set when the bottle came out of the cellar. */
  cellarWineId: string | null;
  /** ISO date (YYYY-MM-DD) the bottle was drunk. */
  drunkOn: string;
  /** Where it was drunk, e.g. "Home" or "Noma, Copenhagen". */
  place: string;
  occasion: string;
  companions: string;
  /** 1–5, or null when not rated. */
  rating: number | null;
  tastingNote: string;
  /** Price paid per bottle, carried over from the cellar entry when available. */
  price: number | null;
  currency: string;
  photoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPhoto {
  id: string;
  blob: Blob;
  createdAt: string;
}

/** Which vision model reads label photos. */
export type ScanProvider = 'claude' | 'gemini';

export interface Settings {
  /** Which provider label scanning uses. */
  scanProvider: ScanProvider;
  /** Anthropic API key, kept on this device only. Empty disables Claude scanning. */
  apiKey: string;
  claudeModel: string;
  /** Google AI Studio key — Gemini has a no-cost free tier. */
  geminiApiKey: string;
  geminiModel: string;
  /** Default currency for new purchases. */
  currency: string;
}

export const emptyWineFacts = (): WineFacts => ({
  name: '',
  producer: '',
  country: '',
  region: '',
  appellation: '',
  grapes: [],
  vintage: null,
  classification: '',
  wineType: '',
  abv: null,
  sizeMl: 750,
});

export const pickWineFacts = (source: WineFacts): WineFacts => ({
  name: source.name,
  producer: source.producer,
  country: source.country,
  region: source.region,
  appellation: source.appellation,
  grapes: [...source.grapes],
  vintage: source.vintage,
  classification: source.classification,
  wineType: source.wineType,
  abv: source.abv,
  sizeMl: source.sizeMl,
});
