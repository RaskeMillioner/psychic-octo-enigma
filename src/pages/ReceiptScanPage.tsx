import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhotoPicker } from '../components/Photo';
import { Screen } from '../components/Screen';
import { Banner, Field, NumberInput, Spinner } from '../components/ui';
import { ReceiptIcon, SparkleIcon } from '../components/icons';
import { appellationPatch, findAppellation } from '../lib/appellation';
import { createCellarWine, putCellarWine } from '../lib/db';
import { findDuplicate, mergeIntoCellar } from '../lib/duplicates';
import { formatMoney, sizeLabel } from '../lib/format';
import { resolvePhotoBlob, commitPhoto, type PhotoRef } from '../lib/photos';
import type { ReceiptLine } from '../lib/receiptFields';
import { PROVIDER_LABELS, providerKey, resolveProvider, scanReceipt } from '../lib/scan';
import { useData } from '../lib/store';
import type { CellarWine } from '../types';

/** A scanned line plus the two things the user decides about it. */
interface Row extends ReceiptLine {
  keep: boolean;
}

const digits = (value: string): number => Number(value.replace(/\D/g, '')) || 0;

/**
 * Photographs a merchant's receipt and puts every bottle on it into the cellar
 * in one go. Nothing is written until the list has been read through: some
 * lines will be misread, and the list is where that gets caught.
 */
export const ReceiptScanPage = () => {
  const { settings, wines, reload } = useData();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<PhotoRef>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [scanned, setScanned] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [currency, setCurrency] = useState(settings.currency);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState('');

  const provider = resolveProvider(settings);
  const hasKey = Boolean(providerKey(settings, provider));

  const run = async (blob: Blob | null) => {
    const source = blob ?? (await resolvePhotoBlob(photo));
    if (!source) {
      setError('Take or choose a photo of the receipt first.');
      return;
    }
    setBusy(true);
    setError('');
    setSummary('');
    try {
      const receipt = await scanReceipt(source, settings);
      setScanned(true);
      setMerchant(receipt.merchant);
      setPurchaseDate(receipt.purchaseDate);
      if (receipt.currency) setCurrency(receipt.currency);
      setNotes(
        receipt.isReceipt
          ? receipt.notes
          : `That doesn't look like a receipt. ${receipt.notes}`.trim(),
      );
      setRows(receipt.lines.map((line) => ({ ...line, keep: true })));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Scanning failed.');
    } finally {
      setBusy(false);
    }
  };

  const patchRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  const kept = rows.filter((row) => row.keep);
  const bottles = kept.reduce((total, row) => total + row.quantity, 0);
  const total = kept.reduce((sum, row) => sum + (row.unitPrice ?? 0) * row.quantity, 0);

  const addToCellar = async () => {
    setSaving(true);
    setError('');
    try {
      // The receipt photo belongs to the whole delivery, so it is stored once
      // and shared: it is not a label photo of any one of these wines.
      const photoId = await commitPhoto(photo, null);
      let created = 0;
      let toppedUp = 0;
      // Held locally as well as in the store: two lines of the same wine on one
      // receipt must land on one entry, and `wines` does not change mid-loop.
      let held: CellarWine[] = [...wines];

      for (const row of kept) {
        const facts = {
          name: row.name,
          producer: row.producer,
          country: row.country,
          region: row.region,
          appellation: row.appellation,
          grapes: row.grapes,
          vintage: row.vintage,
          classification: '',
          wineType: row.wineType,
          abv: null,
          sizeMl: row.sizeMl,
        };
        const match = findAppellation(facts.appellation);
        const draft = {
          ...facts,
          ...(match ? appellationPatch(facts, match) : {}),
          quantity: row.quantity,
          purchasePrice: row.unitPrice,
          currency,
          purchaseDate,
          purchasedFrom: merchant,
          drinkFrom: null,
          drinkTo: null,
          storageLocation: '',
          notes: '',
          photoId,
        };

        const existing = findDuplicate(draft, held);
        if (existing) {
          const merged = await putCellarWine(mergeIntoCellar(existing, draft));
          held = held.map((wine) => (wine.id === merged.id ? merged : wine));
          toppedUp += 1;
        } else {
          held = [...held, await createCellarWine(draft)];
          created += 1;
        }
      }

      await reload();
      setSummary(
        `Added ${bottles} ${bottles === 1 ? 'bottle' : 'bottles'} — ${created} new ${
          created === 1 ? 'entry' : 'entries'
        }${toppedUp ? `, ${toppedUp} topped up` : ''}.`,
      );
      setRows([]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add these wines.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Scan a receipt" back>
      <div className="stack" style={{ gap: 22 }}>
        <PhotoPicker
          label="Receipt photo"
          value={photo}
          onChange={(ref) => {
            setPhoto(ref);
            setScanned(false);
            setRows([]);
            setError('');
            setSummary('');
          }}
          onCapture={(blob) => {
            if (hasKey) void run(blob);
          }}
        />

        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy || !photo || !hasKey}
          onClick={() => void run(null)}
        >
          {busy ? <Spinner /> : <SparkleIcon />}
          {busy ? 'Reading the receipt…' : 'Read the receipt'}
        </button>

        {!hasKey ? (
          <Banner>
            Reading a receipt needs a key for {PROVIDER_LABELS[provider]}. Add one in{' '}
            <Link to="/settings">Settings</Link> — Gemini has a free tier.
          </Banner>
        ) : null}

        {error ? <Banner tone="error">{error}</Banner> : null}
        {summary ? (
          <Banner tone="success">
            {summary}{' '}
            <button type="button" className="btn btn-sm" onClick={() => navigate('/cellar')}>
              Back to the cellar
            </button>
          </Banner>
        ) : null}

        {scanned && rows.length === 0 && !summary ? (
          <Banner>No wine lines were found on that photo. {notes}</Banner>
        ) : null}

        {rows.length > 0 ? (
          <>
            {notes ? <Banner>{notes}</Banner> : null}

            <section>
              <h2 className="section-title">The receipt</h2>
              <div className="stack">
                <Field label="Merchant" hint="Recorded on every bottle added below">
                  <input
                    value={merchant}
                    placeholder="Wine merchant"
                    onChange={(event) => setMerchant(event.target.value)}
                  />
                </Field>
                <div className="grid-2">
                  <Field label="Purchased on">
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(event) => setPurchaseDate(event.target.value)}
                    />
                  </Field>
                  <Field label="Currency">
                    <input
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))}
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section>
              <h2 className="section-title">
                {rows.length === 1 ? '1 wine' : `${rows.length} wines`} on this receipt
              </h2>
              <div className="stack" style={{ gap: 12 }}>
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className={`card stack receipt-line${row.keep ? '' : ' receipt-line-skipped'}`}
                  >
                    <label className="row receipt-keep">
                      <input
                        type="checkbox"
                        checked={row.keep}
                        onChange={(event) => patchRow(index, { keep: event.target.checked })}
                      />
                      <span>{row.keep ? 'Add this wine' : 'Skipped'}</span>
                    </label>

                    <div className="tiny faint receipt-raw">
                      {row.lineText}
                      {/* Only worth saying when it is not an ordinary bottle. */}
                      {row.sizeMl !== 750 ? `${row.lineText ? ' · ' : ''}${sizeLabel(row.sizeMl)}` : ''}
                    </div>

                    <Field
                      label="Producer"
                      tone={row.confidence === 'low' ? 'warn' : undefined}
                      hint={row.confidence === 'low' ? 'Read with low confidence — check it' : undefined}
                    >
                      <input
                        value={row.producer}
                        onChange={(event) => patchRow(index, { producer: event.target.value })}
                      />
                    </Field>

                    <Field label="Cuvée / wine name">
                      <input
                        value={row.name}
                        onChange={(event) => patchRow(index, { name: event.target.value })}
                      />
                    </Field>

                    <div className="grid-3">
                      <Field label="Vintage">
                        <input
                          inputMode="numeric"
                          value={row.vintage ?? ''}
                          placeholder="NV"
                          onChange={(event) => {
                            const year = event.target.value.replace(/\D/g, '').slice(0, 4);
                            patchRow(index, { vintage: year ? Number(year) : null });
                          }}
                        />
                      </Field>
                      <Field label="Bottles">
                        <input
                          inputMode="numeric"
                          value={row.quantity}
                          onChange={(event) =>
                            patchRow(index, { quantity: Math.max(0, digits(event.target.value)) })
                          }
                        />
                      </Field>
                      <Field label="Price each">
                        <NumberInput
                          value={row.unitPrice}
                          onChange={(unitPrice) => patchRow(index, { unitPrice })}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="stack">
              <div className="small faint center">
                {bottles} {bottles === 1 ? 'bottle' : 'bottles'}
                {total > 0 ? ` · ${formatMoney(total, currency)} in total` : ''}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={saving || bottles === 0}
                onClick={() => void addToCellar()}
              >
                {saving ? <Spinner /> : <ReceiptIcon />}
                Add {bottles} {bottles === 1 ? 'bottle' : 'bottles'} to the cellar
              </button>
            </div>
          </>
        ) : null}
      </div>
    </Screen>
  );
};
