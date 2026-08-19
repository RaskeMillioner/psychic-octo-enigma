import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appellationPatch, findAppellation } from '../lib/appellation';
import type { Provenance, ProvenanceKey } from '../lib/labelFields';
import { resolvePhotoBlob, type PhotoRef } from '../lib/photos';
import { PROVIDER_LABELS, providerKey, resolveProvider, scanLabel, type ScanOutcome } from '../lib/scan';
import { useData } from '../lib/store';
import type { WineFacts } from '../types';
import { SparkleIcon } from './icons';
import { PhotoPicker } from './Photo';
import { Banner, Spinner } from './ui';

interface Props {
  photo: PhotoRef;
  onPhotoChange: (ref: PhotoRef) => void;
  /** Receives the metadata read off the label, and where each field came from. */
  onFacts: (facts: WineFacts, provenance: Provenance) => void;
}

/**
 * Label photo + "read the label" action. Capturing a photo starts the scan
 * automatically when a key is configured; everything stays editable.
 */
export const LabelScanner = ({ photo, onPhotoChange, onFacts }: Props) => {
  const { settings, updateSettings } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ScanOutcome | null>(null);

  const provider = resolveProvider(settings);
  const hasKey = Boolean(providerKey(settings, provider));

  const run = async (blob: Blob | null) => {
    const source = blob ?? (await resolvePhotoBlob(photo));
    if (!source) {
      setError('Take or choose a label photo first.');
      return;
    }
    setBusy(true);
    setError('');
    setCopied(false);
    setResult(null);
    try {
      const scan = await scanLabel(source, settings);

      // Gemini corrects a stale model id for us — remember what actually worked.
      if (scan.usedModel && scan.usedModel !== settings.geminiModel) {
        await updateSettings({ ...settings, geminiModel: scan.usedModel });
      }

      // Anything the model left blank that the appellation implies.
      const match = findAppellation(scan.facts.appellation);
      const patch = match ? appellationPatch(scan.facts, match) : {};
      const facts = { ...scan.facts, ...patch };

      // Fields the reference list supplied are inferred, not read or found.
      const provenance: Provenance = { ...scan.provenance };
      for (const key of Object.keys(patch) as ProvenanceKey[]) provenance[key] = 'knowledge';

      setResult(scan);
      onFacts(facts, provenance);
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
          if (hasKey) void run(blob);
        }}
      />

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy || !photo}
        onClick={() => void run(null)}
      >
        {busy ? <Spinner /> : <SparkleIcon />}
        {busy ? `Reading the label with ${provider === 'gemini' ? 'Gemini' : 'Claude'}…` : 'Read label & fill in details'}
      </button>

      {!hasKey ? (
        <Banner>
          Label scanning needs a key for {PROVIDER_LABELS[provider]}. Add one in{' '}
          <Link to="/settings">Settings</Link> — Gemini has a free tier — or fill the fields in by
          hand. Typing the appellation fills the region and grapes on its own.
        </Banner>
      ) : null}

      {error ? (
        <Banner tone="error">
          {error}
          {navigator.clipboard ? (
            <div style={{ marginTop: 9 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(error).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                {copied ? 'Copied' : 'Copy details'}
              </button>
            </div>
          ) : null}
        </Banner>
      ) : null}

      {result ? (
        <Banner tone={result.confidence === 'low' || !result.isWineLabel ? 'info' : 'success'}>
          {!result.isWineLabel
            ? "That doesn't look like a wine label — check the fields below carefully."
            : `Identified with ${result.confidence} confidence${
                result.usedModel ? ` by ${result.usedModel}` : ''
              }${result.searched ? ', with a web lookup' : ''}. ${result.notes}`}
        </Banner>
      ) : null}
    </div>
  );
};
