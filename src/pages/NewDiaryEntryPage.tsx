import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DiaryDetailsFields, type DiaryDetails } from '../components/DiaryDetailsFields';
import { BookIcon } from '../components/icons';
import { LabelScanner } from '../components/LabelScanner';
import { Screen } from '../components/Screen';
import { Banner, Spinner } from '../components/ui';
import { WineFactsFields } from '../components/WineFactsFields';
import { createDiaryEntry } from '../lib/db';
import { todayIso } from '../lib/format';
import { forgetTouched, type Provenance } from '../lib/labelFields';
import { commitPhoto, type PhotoRef } from '../lib/photos';
import { useData } from '../lib/store';
import { emptyWineFacts, type WineFacts } from '../types';

/** Logs a wine that never passed through the cellar — a restaurant bottle, a tasting. */
export const NewDiaryEntryPage = () => {
  const { settings, reload } = useData();
  const navigate = useNavigate();
  const [facts, setFacts] = useState<WineFacts>(emptyWineFacts());
  const [provenance, setProvenance] = useState<Provenance>({});
  const [photo, setPhoto] = useState<PhotoRef>(null);
  const [details, setDetails] = useState<DiaryDetails>({
    drunkOn: todayIso(),
    setting: 'private',
    place: '',
    venue: '',
    city: '',
    venueCountry: '',
    occasion: '',
    companions: '',
    rating: null,
    tastingNote: '',
    price: null,
    currency: settings.currency,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!facts.producer.trim() && !facts.name.trim()) {
      setError('Give the wine at least a producer or a name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const photoId = await commitPhoto(photo, null);
      const entry = await createDiaryEntry({ ...facts, ...details, cellarWineId: null, photoId });
      await reload();
      navigate(`/diary/${entry.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save.');
      setSaving(false);
    }
  };

  return (
    <Screen title="Log a wine" back>
      <form className="stack" style={{ gap: 22 }} onSubmit={submit}>
        <LabelScanner
          photo={photo}
          onPhotoChange={setPhoto}
          onFacts={(scanned, origins) => {
            setFacts((current) => ({ ...current, ...scanned }));
            setProvenance(origins);
          }}
        />

        <section>
          <h2 className="section-title">Wine</h2>
          <WineFactsFields
            value={facts}
            provenance={provenance}
            onChange={(patch) => {
              setFacts((current) => ({ ...current, ...patch }));
              setProvenance((current) => forgetTouched(current, patch));
            }}
          />
        </section>

        <section>
          <h2 className="section-title">The occasion</h2>
          <DiaryDetailsFields
            value={details}
            onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
          />
        </section>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? <Spinner /> : <BookIcon />}
          Save to diary
        </button>
      </form>
    </Screen>
  );
};
