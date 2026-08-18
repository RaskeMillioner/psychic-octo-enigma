import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BottleIcon, GlassIcon, PencilIcon, TrashIcon } from '../components/icons';
import { usePhotoUrl } from '../components/Photo';
import { Screen } from '../components/Screen';
import { EmptyState, StarRating } from '../components/ui';
import { deleteCellarWine, putCellarWine } from '../lib/db';
import { formatDate, formatMoney, originLine, sizeLabel, vintageLabel, wineTitle } from '../lib/format';
import { storedRef } from '../lib/photos';
import { useData } from '../lib/store';

export const WineDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { wines, diary, loading, reload } = useData();
  const wine = wines.find((item) => item.id === id);
  const photoUrl = usePhotoUrl(storedRef(wine?.photoId ?? null));
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!wine) {
    return (
      <Screen title="Wine" back>
        {loading ? null : (
          <EmptyState icon={<BottleIcon />} title="Wine not found">
            It may have been deleted.
          </EmptyState>
        )}
      </Screen>
    );
  }

  const history = diary
    .filter((entry) => entry.cellarWineId === wine.id)
    .sort((a, b) => b.drunkOn.localeCompare(a.drunkOn));

  const facts: [string, string][] = [
    ['Vintage', vintageLabel(wine.vintage)],
    ['Type', wine.wineType || '—'],
    ['Country', wine.country || '—'],
    ['Region', wine.region || '—'],
    ['Appellation', wine.appellation || '—'],
    ['Classification', wine.classification || '—'],
    ['Grapes', wine.grapes.join(', ') || '—'],
    ['Bottle', sizeLabel(wine.sizeMl)],
    ['Alcohol', wine.abv ? `${wine.abv}%` : '—'],
    ['Price paid', formatMoney(wine.purchasePrice, wine.currency)],
    ['Bought', wine.purchaseDate ? formatDate(wine.purchaseDate) : '—'],
    ['From', wine.purchasedFrom || '—'],
    [
      'Drinking window',
      wine.drinkFrom || wine.drinkTo ? `${wine.drinkFrom ?? '?'}–${wine.drinkTo ?? '?'}` : '—',
    ],
    ['Storage', wine.storageLocation || '—'],
  ];

  const addBottle = async () => {
    await putCellarWine({ ...wine, quantity: wine.quantity + 1 });
    await reload();
  };

  const remove = async () => {
    await deleteCellarWine(wine.id);
    await reload();
    navigate('/cellar', { replace: true });
  };

  return (
    <Screen
      title={wine.producer || wineTitle(wine)}
      back
      action={
        <Link to={`/cellar/${wine.id}/edit`} className="btn btn-ghost btn-sm" aria-label="Edit">
          <PencilIcon />
        </Link>
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
          <h2>
            {wineTitle(wine)} {vintageLabel(wine.vintage)}
          </h2>
          <div className="muted small">{originLine(wine) || 'Origin not recorded'}</div>
          <div style={{ marginTop: 10 }}>
            <span className="tag">
              {wine.quantity} {wine.quantity === 1 ? 'bottle' : 'bottles'} in cellar
            </span>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 22 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={wine.quantity < 1}
          onClick={() => navigate(`/cellar/${wine.id}/drink`)}
        >
          <GlassIcon />
          Drink a bottle
        </button>
        <button type="button" className="btn" onClick={() => void addBottle()}>
          + 1 bottle
        </button>
      </div>

      <section className="section">
        <h3 className="section-title">Details</h3>
        <dl className="facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {wine.notes ? (
        <section className="section">
          <h3 className="section-title">Notes</h3>
          <div className="card" style={{ whiteSpace: 'pre-wrap' }}>
            {wine.notes}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h3 className="section-title">Bottles drunk</h3>
        {history.length === 0 ? (
          <div className="card muted small">No bottles of this wine drunk yet.</div>
        ) : (
          <div className="stack">
            {history.map((entry) => (
              <Link key={entry.id} to={`/diary/${entry.id}`} className="card">
                <div className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <div>{formatDate(entry.drunkOn)}</div>
                    <div className="small faint">{entry.place || 'Place not recorded'}</div>
                  </div>
                  <StarRating value={entry.rating} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        {confirmDelete ? (
          <div className="card stack">
            <div className="small">
              Delete this wine and its label photo? Diary entries for bottles already drunk are kept.
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
            Delete wine
          </button>
        )}
      </section>
    </Screen>
  );
};
