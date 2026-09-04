import type { WineFacts } from '../types';
import type { DrinkWindow, LabelReading, Provenance } from './labelFields.ts';

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
  /** Suggested drinking window, for the cellar form to apply. */
  window?: DrinkWindow;
  /** True when the model was able to search the web for this bottle. */
  searched: boolean;
  /**
   * Set when a web lookup was asked for and did not happen: one sentence
   * saying why, in the provider's own words where it gave any. Left unset
   * when the lookup ran, or when none was asked for.
   */
  lookupIssue?: string;
}
