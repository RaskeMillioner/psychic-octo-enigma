import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DiaryDetailsFields, type DiaryDetails } from '../components/DiaryDetailsFields';
import { BookIcon, BottleIcon, PencilIcon, TrashIcon } from '../components/icons';
import { PhotoPicker, usePhotoUrl } from '../components/Photo';
import { Screen } from '../components/Screen';
import { Banner, EmptyState, StarRating } from '../components/ui';
import { WineFactsFields } from '../components/WineFactsFields';
import { deleteDiaryEntry, putDiaryEntry } from '../lib/db';
import { formatDate, formatMoney, originLine, sizeLabel, vintageLabel, wineTitle } from '../lib/format';
import { commitPhoto, storedRef, type PhotoRef } from '../lib/photos';
import { useData } from '../lib/store';
import { pickWineFacts, type WineFacts } from '../types';

export const DiaryEntryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { diary, wines, loading, reload } = useData();
  const entry = diary.find((item) => item.id === id);

  const [editing, setEditing] = useState(false);
  const [facts, setFacts] = useState<WineFacts | null>(null);
  const [details, setDetails] = useState<DiaryDetails | null>(null);
  const [photo, setPhoto] = useState<PhotoRef>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const photoUrl = usePhotoUrl(storedRef(entry?.photoId ?? null));

  if (!entry) {
    return (
      <Screen title="Diary entry" back>
        {loading ? null : (
          <EmptyState icon={<BookIcon />} title="Entry not found">
            It may have been deleted.
          </EmptyState>
        )}
      </Screen>
    );
  }

  const startEditing = () => {
    setFacts(pickWineFacts(entry));
    setDetails({
      drunkOn: entry.drunkOn,
      setting: entry.setting,
      place: entry.place,
      venue: entry.venue,
      city: entry.city,
      venueCountry: entry.venueCountry,
      occasion: entry.occasion,
      companions: entry.companions,
      rating: entry.rating,
      tastingNote: entry.tastingNote,
      price: entry.price,
      currency: entry.currency,
    });
    setPhoto(storedRef(entry.photoId));
    setError('');
    setEditing(true);
  };

  const save = async () => {
    if (!facts || !details) return;
    try {
      const photoId = await commitPhoto(photo, entry.photoId);
      await putDiaryEntry({ ...entry, ...facts, ...details, photoId });
      await reload();
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save.');
    }
  };

  const remove = async () => {
    await deleteDiaryEntry(entry.id);
    await reload();
    navigate('/diary', { replace: true });
  };

  if (editing && facts && details) {
    return (
      <Screen title="Edit entry" back>
        <div className="stack" style={{ gap: 22 }}>
          <PhotoPicker label="Label photo" value={photo} onChange={setPhoto} />

          <section>
            <h2 className="section-title">Wine</h2>
            <WineFactsFields
              value={facts}
              onChange={(patch) => setFacts((current) => (current ? { ...current, ...patch } : current))}
            />
          </section>

          <section>
            <h2 className="section-title">The occasion</h2>
            <DiaryDetailsFields
              value={details}
              onChange={(patch) =>
                setDetails((current) => (current ? { ...current, ...patch } : current))
              }
            />
          </section>

          {error ? <Banner tone="error">{error}</Banner> : null}

          <div className="row">
            <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => void save()}>
              Save changes
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  const sourceWine = entry.cellarWineId
    ? wines.find((wine) => wine.id === entry.cellarWineId)
    : undefined;

  const facts_: [string, string][] = [
    ['Drunk on', formatDate(entry.drunkOn)],
    ...(entry.setting === 'venue'
      ? ([
          ['Venue', entry.venue || '—'],
          ['City', entry.city || '—'],
          ['Venue country', entry.venueCountry || '—'],
        ] as [string, string][])
      : ([['Place', entry.place || '—']] as [string, string][])),
    ['Occasion', entry.occasion || '—'],
    ['Shared with', entry.companions || '—'],
    ['Vintage', vintageLabel(entry.vintage)],
    ['Type', entry.wineType || '—'],
    ['Country', entry.country || '—'],
    ['Region', entry.region || '—'],
    ['Appellation', entry.appellation || '—'],
    ['Classification', entry.classification || '—'],
    ['Grapes', entry.grapes.join(', ') || '—'],
    ['Bottle', sizeLabel(entry.sizeMl)],
    ['Alcohol', entry.abv ? `${entry.abv}%` : '—'],
    ['Price', formatMoney(entry.price, entry.currency)],
  ];

  return (
    <Screen
      title="Diary entry"
      back
      action={
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Edit" onClick={startEditing}>
          <PencilIcon />
        </button>
      }
    >
      <div className="detail-hero">
        <div className="photo">
          {photoUrl ? (
            <img src={photoUrl} alt="Wine label" />
          ) : (
            <BottleIcon style={{ width: 30, opacity: 0.3 }} />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="small faint">{entry.producer}</div>
          <h2>
            {wineTitle(entry)} {vintageLabel(entry.vintage)}
          </h2>
          <div className="muted small">{originLine(entry)}</div>
          <div style={{ marginTop: 8 }}>
            <StarRating value={entry.rating} />
          </div>
        </div>
      </div>

      {entry.tastingNote ? (
        <section className="section">
          <h3 className="section-title">Tasting note</h3>
          <div className="card" style={{ whiteSpace: 'pre-wrap' }}>
            {entry.tastingNote}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h3 className="section-title">Details</h3>
        <dl className="facts">
          {facts_.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {sourceWine ? (
        <section className="section">
          <Link to={`/cellar/${sourceWine.id}`} className="btn btn-block">
            <BottleIcon />
            {sourceWine.quantity} left in cellar
          </Link>
        </section>
      ) : null}

      <section className="section">
        {confirmDelete ? (
          <div className="card stack">
            <div className="small">
              Delete this diary entry? The bottle will not be returned to your cellar.
            </div>
            <div className="row">
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={() => void remove()}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmDelete(true)}>
            <TrashIcon />
            Delete entry
          </button>
        )}
      </section>
    </Screen>
  );
};
