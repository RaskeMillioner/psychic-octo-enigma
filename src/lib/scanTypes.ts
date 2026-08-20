import type { WineFacts } from '../types';
import type { LabelReading, Provenance } from './labelFields.ts';

/** One entry in a provider's model dropdown. */
export interface ScanModel {
  id: string;
  label: string;
}

export interface ScanResult {
  facts: WineFacts;
  confidence: LabelReading['confidence'];
  notes: string;
  isWineLabel: boolean;
  /** Where each field's value came from, for the notes under the form fields. */
  provenance: Provenance;
  /** True when the model was able to search the web for this bottle. */
  searched: boolean;
  /** True when a web lookup was asked for but the provider refused the quota. */
  lookupRefused?: boolean;
}
