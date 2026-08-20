import { useEffect, useRef, useState } from 'react';
import { DownloadIcon, SparkleIcon, TrashIcon, UploadIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { Banner, Field, Spinner } from '../components/ui';
import { clearAllData, exportBackup, importBackup } from '../lib/db';
import { ModelPicker } from '../components/ModelPicker';
import { listClaudeModels } from '../lib/claudeModels';
import { listGeminiModels } from '../lib/scanGemini';
import { useData } from '../lib/store';
import type { ScanProvider, Settings } from '../types';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const PROVIDERS: { id: ScanProvider; label: string }[] = [
  { id: 'gemini', label: 'Gemini — free tier' },
  { id: 'claude', label: 'Claude — pay per scan' },
];

export const SettingsPage = () => {
  const { settings, updateSettings, wines, diary, reload } = useData();
  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [usage, setUsage] = useState('');
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(settings), [settings]);

  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => {
      if (estimate?.usage) setUsage(formatBytes(estimate.usage));
    });
  }, [wines, diary]);

  const patch = (next: Partial<Settings>) => setDraft((current) => ({ ...current, ...next }));

  const save = async () => {
    await updateSettings({
      ...draft,
      apiKey: draft.apiKey.trim(),
      geminiApiKey: draft.geminiApiKey.trim(),
      claudeModel: draft.claudeModel.trim() || 'claude-opus-5',
      geminiModel: draft.geminiModel.trim(),
      currency: draft.currency.trim().toUpperCase() || 'EUR',
    });
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

  const gemini = draft.scanProvider === 'gemini';

  return (
    <Screen title="Settings">
      <section className="section">
        <h3 className="section-title">Label scanning</h3>

        <div className="chips" style={{ marginBottom: 12 }}>
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`chip${draft.scanProvider === provider.id ? ' active' : ''}`}
              onClick={() => patch({ scanProvider: provider.id })}
            >
              {provider.label}
            </button>
          ))}
        </div>

        {gemini ? (
          <div className="stack">
            <Field
              label="Google AI Studio key"
              hint="Free tier, no card needed. Get one at aistudio.google.com/apikey."
            >
              <input
                type={showKey ? 'text' : 'password'}
                value={draft.geminiApiKey}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => patch({ geminiApiKey: event.target.value })}
              />
            </Field>

            <ModelPicker
              value={draft.geminiModel}
              onChange={(geminiModel) => patch({ geminiModel })}
              savedKey={settings.geminiApiKey}
              draftKey={draft.geminiApiKey}
              load={listGeminiModels}
              extra={
                <button type="button" className="btn btn-sm" onClick={() => setShowKey(!showKey)}>
                  {showKey ? 'Hide key' : 'Show key'}
                </button>
              }
            />

            <Banner>
              Google's free tier costs nothing and needs no card, but it is rate limited, and
              Google's free-tier terms permit using what you send to improve their models. Your
              label photos would be covered by that.
            </Banner>
          </div>
        ) : (
          <div className="stack">
            <Field
              label="Anthropic API key"
              hint="Pay per scan — roughly a few cents a label. From console.anthropic.com."
            >
              <input
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey}
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => patch({ apiKey: event.target.value })}
              />
            </Field>

            <ModelPicker
              value={draft.claudeModel}
              onChange={(claudeModel) => patch({ claudeModel })}
              savedKey={settings.apiKey}
              draftKey={draft.apiKey}
              load={listClaudeModels}
              extra={
                <button type="button" className="btn btn-sm" onClick={() => setShowKey(!showKey)}>
                  {showKey ? 'Hide key' : 'Show key'}
                </button>
              }
            />
          </div>
        )}

        <label className="toggle" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={draft.webLookup}
            onChange={(event) => patch({ webLookup: event.target.checked })}
          />
          <span className="toggle-text">
            <strong>Look the wine up online</strong>
            <span className="tiny faint">
              The model searches the web for the producer, cuvée and vintage, so it can fill in the
              grape blend and classification a label leaves out — instead of only reading what is
              printed. Slower, and each scan uses a search: on Gemini that draws on the free
              grounding allowance, on Claude it is billed per search.
            </span>
          </span>
        </label>

        <p className="tiny faint" style={{ marginTop: 10 }}>
          Keys are stored only in this browser, on this device, and are sent only to the provider
          you pick. Without a key everything else still works — typing an appellation fills in the
          region, grapes and classification from the app's own reference list.
        </p>
      </section>

      <section className="section">
        <h3 className="section-title">Preferences</h3>
        <Field label="Default currency" hint="Used for new purchases.">
          <input
            value={draft.currency}
            maxLength={3}
            onChange={(event) => patch({ currency: event.target.value.toUpperCase() })}
          />
        </Field>
      </section>

      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginBottom: 26 }}
        onClick={() => void save()}
      >
        <SparkleIcon />
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
              <button
                type="button"
                className="btn"
                style={{ flex: 1 }}
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => void wipe()}
              >
                Delete everything
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => setConfirmClear(true)}
          >
            <TrashIcon />
            Delete all data
          </button>
        )}
      </section>
    </Screen>
  );
};
