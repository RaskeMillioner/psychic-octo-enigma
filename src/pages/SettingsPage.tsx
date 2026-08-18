import { useEffect, useRef, useState } from 'react';
import { DownloadIcon, TrashIcon, UploadIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { Banner, Field, Spinner } from '../components/ui';
import { clearAllData, exportBackup, importBackup } from '../lib/db';
import { useData } from '../lib/store';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

export const SettingsPage = () => {
  const { settings, updateSettings, wines, diary, reload } = useData();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [currency, setCurrency] = useState(settings.currency);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [usage, setUsage] = useState<string>('');
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(settings.apiKey);
    setCurrency(settings.currency);
  }, [settings]);

  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => {
      if (estimate?.usage) setUsage(formatBytes(estimate.usage));
    });
  }, [wines, diary]);

  const saveSettings = async () => {
    await updateSettings({ apiKey: apiKey.trim(), currency: currency.trim().toUpperCase() || 'EUR' });
    setStatus('Settings saved.');
  };

  const download = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cellarbook-${backup.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Backup downloaded.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus('');
    try {
      const parsed = JSON.parse(await file.text());
      const result = await importBackup(parsed);
      await reload();
      setStatus(`Imported ${result.wines} cellar wines and ${result.diary} diary entries.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    await clearAllData();
    await reload();
    setConfirmClear(false);
    setStatus('All wine data deleted.');
  };

  return (
    <Screen title="Settings">
      <section className="section">
        <h3 className="section-title">Label scanning</h3>
        <div className="stack">
          <Field
            label="Anthropic API key"
            hint="Stored only in this browser, on this device. Used to read label photos."
          >
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </Field>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
            <span className="tiny faint">
              Get a key at console.anthropic.com. Requests go straight from this device to Anthropic.
            </span>
          </div>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Preferences</h3>
        <Field label="Default currency" hint="Used for new purchases.">
          <input
            value={currency}
            maxLength={3}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </Field>
      </section>

      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginBottom: 26 }}
        onClick={() => void saveSettings()}
      >
        Save settings
      </button>

      <section className="section">
        <h3 className="section-title">Your data</h3>
        <div className="card stack">
          <div className="small muted">
            {wines.length} wines in the cellar · {diary.length} diary entries
            {usage ? ` · ${usage} stored on this device` : ''}
          </div>
          <div className="row">
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={() => void download()}
            >
              {busy ? <Spinner /> : <DownloadIcon />}
              Export
            </button>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={() => importInput.current?.click()}
            >
              <UploadIcon />
              Import
            </button>
          </div>
          <div className="tiny faint">
            Everything lives in this browser. Export regularly — clearing site data erases your
            cellar.
          </div>
          <input
            ref={importInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      </section>

      {status ? (
        <div className="section">
          <Banner tone="success">{status}</Banner>
        </div>
      ) : null}

      <section className="section">
        {confirmClear ? (
          <div className="card stack">
            <div className="small">
              Delete every wine, diary entry and photo on this device? This cannot be undone.
            </div>
            <div className="row">
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={() => void wipe()}>
                Delete everything
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmClear(true)}>
            <TrashIcon />
            Delete all data
          </button>
        )}
      </section>
    </Screen>
  );
};
