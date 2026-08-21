import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BottleIcon, PlusIcon, SearchIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { EmptyState } from '../components/ui';
import { WineCard } from '../components/WineCard';
import { originLine, vintageLabel, wineTitle } from '../lib/format';
import { useData } from '../lib/store';
import type { CellarWine } from '../types';

type SortKey = 'added' | 'producer' | 'vintage' | 'quantity';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'added', label: 'Recently added' },
  { key: 'producer', label: 'Producer A–Z' },
  { key: 'vintage', label: 'Oldest vintage' },
  { key: 'quantity', label: 'Most bottles' },
];

const matches = (wine: CellarWine, query: string) => {
  if (!query) return true;
  const haystack = [
    wine.name,
    wine.producer,
    wine.country,
    wine.region,
    wine.appellation,
    wine.classification,
    wine.storageLocation,
    ...wine.grapes,
    wine.vintage ? String(wine.vintage) : '',
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
};

export const CellarPage = () => {
  const { wines, loading } = useData();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<SortKey>('added');
  const [showEmpty, setShowEmpty] = useState(false);

  const countries = useMemo(
    () => [...new Set(wines.map((wine) => wine.country).filter(Boolean))].sort(),
    [wines],
  );
  const types = useMemo(
    () => [...new Set(wines.map((wine) => wine.wineType).filter(Boolean))].sort(),
    [wines],
  );

  const visible = useMemo(() => {
    const filtered = wines.filter(
      (wine) =>
        (showEmpty || wine.quantity > 0) &&
        (!type || wine.wineType === type) &&
        (!country || wine.country === country) &&
        matches(wine, query),
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'producer':
          return (a.producer || wineTitle(a)).localeCompare(b.producer || wineTitle(b));
        case 'vintage':
          return (a.vintage ?? 9999) - (b.vintage ?? 9999);
        case 'quantity':
          return b.quantity - a.quantity;
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return sorted;
  }, [wines, showEmpty, type, country, query, sort]);

  const bottles = visible.reduce((total, wine) => total + wine.quantity, 0);
  const emptyCount = wines.filter((wine) => wine.quantity === 0).length;

  return (
    <Screen title="Cellar">
      <div className="stack" style={{ marginBottom: 14 }}>
        <div className="search">
          <input
            type="search"
            value={query}
            placeholder="Search producer, region, grape…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <SearchIcon />
        </div>

        <div className="chips">
          <button
            type="button"
            className={`chip${!type && !country ? ' active' : ''}`}
            onClick={() => {
              setType('');
              setCountry('');
            }}
          >
            All
          </button>
          {types.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${type === option ? ' active' : ''}`}
              onClick={() => setType(type === option ? '' : option)}
            >
              {option}
            </button>
          ))}
          {countries.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${country === option ? ' active' : ''}`}
              onClick={() => setCountry(country === option ? '' : option)}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="row-between small muted">
          <span>
            {bottles} {bottles === 1 ? 'bottle' : 'bottles'} · {visible.length}{' '}
            {visible.length === 1 ? 'wine' : 'wines'}
          </span>
          <select
            className="select-compact"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? null : visible.length === 0 ? (
        <EmptyState icon={<BottleIcon />} title={wines.length ? 'Nothing matches' : 'Empty cellar'}>
          {wines.length ? (
            'Try a different search or filter.'
          ) : (
            <>
              Tap <strong>+</strong> and photograph a label to add your first bottle.
            </>
          )}
        </EmptyState>
      ) : (
        <div className="stack">
          {visible.map((wine) => (
            <WineCard
              key={wine.id}
              to={`/cellar/${wine.id}`}
              photoId={wine.photoId}
              producer={wine.producer}
              title={`${wineTitle(wine)} ${vintageLabel(wine.vintage)}`}
              meta={originLine(wine)}
              right={
                <div className={`qty${wine.quantity === 0 ? ' empty' : ''}`}>
                  <strong>{wine.quantity}</strong>
                  <span>{wine.quantity === 1 ? 'btl' : 'btls'}</span>
                </div>
              }
            />
          ))}
        </div>
      )}

      {emptyCount > 0 && !showEmpty ? (
        <button
          type="button"
          className="btn btn-ghost btn-block btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => setShowEmpty(true)}
        >
          Show {emptyCount} finished {emptyCount === 1 ? 'wine' : 'wines'}
        </button>
      ) : null}

      <Link to="/cellar/new" className="fab" aria-label="Add wine">
        <PlusIcon />
      </Link>
    </Screen>
  );
};
