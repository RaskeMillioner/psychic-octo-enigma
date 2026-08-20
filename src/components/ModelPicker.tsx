import { useEffect, useState, type ReactNode } from 'react';
import type { ScanModel } from '../lib/scanTypes';
import { Banner, Field, Spinner } from './ui';

interface Props {
  /** Currently configured model id. */
  value: string;
  onChange: (id: string) => void;
  /** The saved key, used to populate the list without being asked. */
  savedKey: string;
  /** The key being typed, which is what the button can act on. */
  draftKey: string;
  load: (apiKey: string) => Promise<ScanModel[]>;
  /** Rendered beside the load button, so the controls share one row. */
  extra?: ReactNode;
}

/**
 * A model dropdown filled from the user's own key, so nobody has to know which
 * model ids exist. Shared by both providers: the only difference is which
 * listing call is passed in.
 */
export const ModelPicker = ({ value, onChange, savedKey, draftKey, load, extra }: Props) => {
  const [models, setModels] = useState<ScanModel[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // The dropdown is only useful once it has options, so fetch them as soon as
  // there is a saved key to ask with. Nobody asked for this one, so a failure
  // stays quiet — the button below reports properly.
  useEffect(() => {
    if (!savedKey) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    load(savedKey)
      .then((available) => {
        if (!cancelled) setModels(available);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [savedKey, load]);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const available = await load(draftKey.trim());
      setModels(available);
      if (available.length === 0) setError('That key returned no usable models.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load models.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Field
        label="Model"
        hint={
          models.length
            ? `${models.length} models your key can use. Pick one your provider's rate-limit page lists, if scans fail on quota.`
            : 'Save your key, then load the models it can use.'
        }
      >
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose automatically</option>
          {/* Whatever is configured stays selectable even before the list loads. */}
          {value && models.every((model) => model.id !== value) ? (
            <option value={value}>{value}</option>
          ) : null}
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label === model.id ? model.id : `${model.label} — ${model.id}`}
            </option>
          ))}
        </select>
      </Field>

      <div className="row">
        <button
          type="button"
          className="btn btn-sm"
          disabled={loading || !draftKey.trim()}
          onClick={() => void refresh()}
        >
          {loading ? <Spinner /> : null}
          {models.length ? 'Refresh models' : 'Load models'}
        </button>
        {extra}
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}
    </>
  );
};
