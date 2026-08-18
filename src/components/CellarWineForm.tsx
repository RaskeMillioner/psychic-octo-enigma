import { useState, type FormEvent } from 'react';
import type { PhotoRef } from '../lib/photos';
import type { CellarWine, WineFacts } from '../types';
import { emptyWineFacts } from '../types';
import { LabelScanner } from './LabelScanner';
import { Banner, Field, Spinner } from './ui';
import { WineFactsFields } from './WineFactsFields';

export type CellarFormValues = WineFacts &
  Pick<
    CellarWine,
    | 'quantity'
    | 'purchasePrice'
    | 'currency'
    | 'purchaseDate'
    | 'purchasedFrom'
    | 'drinkFrom'
    | 'drinkTo'
    | 'storageLocation'
    | 'notes'
  >;

export const blankCellarValues = (currency: string): CellarFormValues => ({
  ...emptyWineFacts(),
  quantity: 1,
  purchasePrice: null,
  currency,
  purchaseDate: '',
  purchasedFrom: '',
  drinkFrom: null,
  drinkTo: null,
  storageLocation: '',
  notes: '',
});

const year = (value: string): number | null => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits ? Number(digits) : null;
};

interface Props {
  initial: CellarFormValues;
  initialPhoto: PhotoRef;
  submitLabel: string;
  onSubmit: (values: CellarFormValues, photo: PhotoRef) => Promise<void>;
}

export const CellarWineForm = ({ initial, initialPhoto, submitLabel, onSubmit }: Props) => {
  const [values, setValues] = useState<CellarFormValues>(initial);
  const [photo, setPhoto] = useState<PhotoRef>(initialPhoto);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const patch = (next: Partial<CellarFormValues>) =>
    setValues((current) => ({ ...current, ...next }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.producer.trim() && !values.name.trim()) {
      setError('Give the wine at least a producer or a name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(values, photo);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save.');
      setSaving(false);
    }
  };

  return (
    <form className="stack" style={{ gap: 22 }} onSubmit={handleSubmit}>
      <LabelScanner
        photo={photo}
        onPhotoChange={setPhoto}
        onFacts={(facts) =>
          setValues((current) => ({
            ...current,
            ...facts,
            // Keep a size the user already chose if the label didn't state one.
            sizeMl: facts.sizeMl || current.sizeMl,
          }))
        }
      />

      <section>
        <h2 className="section-title">Wine</h2>
        <WineFactsFields value={values} onChange={patch} />
      </section>

      <section>
        <h2 className="section-title">In your cellar</h2>
        <div className="stack">
          <div className="grid-2">
            <Field label="Quantity">
              <input
                inputMode="numeric"
                value={values.quantity}
                onChange={(event) =>
                  patch({ quantity: Math.max(0, Number(event.target.value.replace(/\D/g, '')) || 0) })
                }
              />
            </Field>
            <Field label="Storage location">
              <input
                value={values.storageLocation}
                placeholder="Rack 3, bin B"
                onChange={(event) => patch({ storageLocation: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid-2">
            <Field label="Price per bottle">
              <input
                inputMode="decimal"
                value={values.purchasePrice ?? ''}
                placeholder="45"
                onChange={(event) => {
                  const parsed = Number.parseFloat(event.target.value.replace(',', '.'));
                  patch({ purchasePrice: Number.isFinite(parsed) ? parsed : null });
                }}
              />
            </Field>
            <Field label="Currency">
              <input
                value={values.currency}
                maxLength={3}
                onChange={(event) => patch({ currency: event.target.value.toUpperCase() })}
              />
            </Field>
          </div>

          <div className="grid-2">
            <Field label="Purchased on">
              <input
                type="date"
                value={values.purchaseDate}
                onChange={(event) => patch({ purchaseDate: event.target.value })}
              />
            </Field>
            <Field label="Purchased from">
              <input
                value={values.purchasedFrom}
                placeholder="Merchant"
                onChange={(event) => patch({ purchasedFrom: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid-2">
            <Field label="Drink from">
              <input
                inputMode="numeric"
                maxLength={4}
                value={values.drinkFrom ?? ''}
                placeholder="2026"
                onChange={(event) => patch({ drinkFrom: year(event.target.value) })}
              />
            </Field>
            <Field label="Drink until">
              <input
                inputMode="numeric"
                maxLength={4}
                value={values.drinkTo ?? ''}
                placeholder="2040"
                onChange={(event) => patch({ drinkTo: year(event.target.value) })}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={values.notes}
              placeholder="Anything worth remembering about these bottles"
              onChange={(event) => patch({ notes: event.target.value })}
            />
          </Field>
        </div>
      </section>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
        {saving ? <Spinner /> : null}
        {submitLabel}
      </button>
    </form>
  );
};
