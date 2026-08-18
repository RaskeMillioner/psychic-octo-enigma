import type { WineFacts } from '../types';
import type { LabelReading } from './labelFields.ts';

export interface ScanResult {
  facts: WineFacts;
  confidence: LabelReading['confidence'];
  notes: string;
  isWineLabel: boolean;
}
