import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DiaryDetailsFields, type DiaryDetails } from '../components/DiaryDetailsFields';
import { BottleIcon, GlassIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { Banner, EmptyState, Spinner } from '../components/ui';
import { copyPhoto, consumeFromCellar } from '../lib/db';
import { todayIso, vintageLabel, wineTitle } from '../lib/format';
import { useData } from '../lib/store';
import { pickWineFacts, type CellarWine } from '../types';

export const ConsumePage = () => {
  const { id } = useParams();
  const { wines, loading } = useData();
  const wine = wines.find((item) => item.id === id);

  if (!wine) {
    return (
      <Screen title="Consume a bottle" back>
        {loading ? null : <EmptyState icon={<BottleIcon />} title="Wine not found" />}
      </Screen>
    );
  }

  // Keyed on the wine, and mounted only once there is one: the form's opening
  // values are read from it, and a state initialiser runs once. Reading them in
  // the page itself would take whatever the cellar held on the first render —
  // nothing at all, on a reload straight onto this URL — and the price carried
  // over from the purchase would be lost.
  return <ConsumeForm key={wine.id} wine={wine} />;
};

const ConsumeForm = ({ wine }: { wine: CellarWine }) => {
  const navigate = useNavigate();
  const { reload } = useData();
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
    price: wine.purchasePrice,
    currency: wine.currency,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      // The diary keeps its own copy of the label photo so it survives the
      // cellar entry being deleted later.
      const photoId = await copyPhoto(wine.photoId);
      const entry = await consumeFromCellar(wine.id, {
        ...pickWineFacts(wine),
        ...details,
        photoId,
      });
      await reload();
      navigate(`/diary/${entry.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save.');
      setSaving(false);
    }
  };

  return (
    <Screen title="Consume a bottle" back>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="small faint">{wine.producer}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
          {wineTitle(wine)} {vintageLabel(wine.vintage)}
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          {wine.quantity} in cellar → {wine.quantity - 1} after this bottle
        </div>
      </div>

      <form className="stack" style={{ gap: 20 }} onSubmit={submit}>
        <DiaryDetailsFields
          value={details}
          onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
        />

        {error ? <Banner tone="error">{error}</Banner> : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? <Spinner /> : <GlassIcon />}
          Log bottle & update cellar
        </button>
      </form>
    </Screen>
  );
};
