import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolvePhotoBlob, type PhotoRef } from '../lib/photos';
import { scanLabel, type ScanResult } from '../lib/scan';
import { useData } from '../lib/store';
import type { WineFacts } from '../types';
import { SparkleIcon } from './icons';
import { PhotoPicker } from './Photo';
import { Banner, Spinner } from './ui';

interface Props {
  photo: PhotoRef;
  onPhotoChange: (ref: PhotoRef) => void;
  /** Receives the metadata read off the label, to merge into the form. */
  onFacts: (facts: WineFacts) => void;
}

/**
 * Label photo + "read the label" action. Capturing a photo starts the scan
 * automatically when an API key is configured; everything stays editable.
 */
export const LabelScanner = ({ photo, onPhotoChange, onFacts }: Props) => {
  const { settings } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);

  const run = async (blob: Blob | null) => {
    const source = blob ?? (await resolvePhotoBlob(photo));
    if (!source) {
      setError('Take or choose a label photo first.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const scan = await scanLabel(source, settings.apiKey);
      setResult(scan);
      onFacts(scan.facts);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Scanning failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <PhotoPicker
        label="Label photo"
        value={photo}
        onChange={(ref) => {
          onPhotoChange(ref);
          setResult(null);
          setError('');
        }}
        onCapture={(blob) => {
          if (settings.apiKey) void run(blob);
        }}
      />

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy || !photo}
        onClick={() => void run(null)}
      >
        {busy ? <Spinner /> : <SparkleIcon />}
        {busy ? 'Reading the label…' : 'Read label & fill in details'}
      </button>

      {!settings.apiKey ? (
        <Banner>
          Label scanning needs an Anthropic API key. Add one in <Link to="/settings">Settings</Link>,
          or fill the fields in by hand.
        </Banner>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      {result ? (
        <Banner tone={result.confidence === 'low' || !result.isWineLabel ? 'info' : 'success'}>
          {!result.isWineLabel
            ? "That doesn't look like a wine label — check the fields below carefully."
            : `Identified with ${result.confidence} confidence. ${result.notes}`}
        </Banner>
      ) : null}
    </div>
  );
};
