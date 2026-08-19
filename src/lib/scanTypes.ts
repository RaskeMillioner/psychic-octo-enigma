import type { WineFacts } from '../types';
import type { LabelReading, Provenance } from './labelFields.ts';

export interface ScanResult {
  facts: WineFacts;
  confidence: LabelReading['confidence'];
  notes: string;
  isWineLabel: boolean;
  /** Where each field's value came from, for the notes under the form fields. */
  provenance: Provenance;
  /** True when the model was able to search the web for this bottle. */
  searched: boolean;
}
