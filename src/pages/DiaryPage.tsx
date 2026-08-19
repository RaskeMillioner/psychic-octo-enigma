import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookIcon, PlusIcon, SearchIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { EmptyState, StarRating } from '../components/ui';
import { WineCard } from '../components/WineCard';
import { formatDate, monthLabel, originLine, placeLabel, vintageLabel, wineTitle } from '../lib/format';
import { useData } from '../lib/store';
import type { DiaryEntry } from '../types';

const matches = (entry: DiaryEntry, query: string) => {
  if (!query) return true;
  const haystack = [
    entry.name,
    entry.producer,
    entry.country,
    entry.region,
    entry.appellation,
    entry.place,
    entry.venue,
    entry.city,
    entry.venueCountry,
    entry.occasion,
    entry.companions,
    entry.tastingNote,
    ...entry.grapes,
    entry.vintage ? String(entry.vintage) : '',
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
};

export const DiaryPage = () => {
  const { diary, loading } = useData();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const filtered = diary
      .filter((entry) => matches(entry, query))
      .sort((a, b) => b.drunkOn.localeCompare(a.drunkOn) || b.createdAt.localeCompare(a.createdAt));

    const byMonth = new Map<string, DiaryEntry[]>();
    for (const entry of filtered) {
      const key = entry.drunkOn.slice(0, 7);
      const bucket = byMonth.get(key);
      if (bucket) bucket.push(entry);
      else byMonth.set(key, [entry]);
    }
    return [...byMonth.entries()];
  }, [diary, query]);

  const thisYear = new Date().getFullYear();
  const drunkThisYear = diary.filter((entry) => entry.drunkOn.startsWith(String(thisYear))).length;

  return (
    <Screen title="Diary">
      <div className="stack" style={{ marginBottom: 14 }}>
        <div className="search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            placeholder="Search wine, place, occasion…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="small muted">
          {diary.length} {diary.length === 1 ? 'bottle' : 'bottles'} logged · {drunkThisYear} in{' '}
          {thisYear}
        </div>
      </div>

      {loading ? null : groups.length === 0 ? (
        <EmptyState icon={<BookIcon />} title={diary.length ? 'Nothing matches' : 'No entries yet'}>
          {diary.length ? (
            'Try a different search.'
          ) : (
            <>
              Open a bottle from your cellar, or tap <strong>+</strong> to log a wine you drank
              elsewhere.
            </>
          )}
        </EmptyState>
      ) : (
        groups.map(([month, entries]) => (
          <div key={month}>
            <div className="month-heading">{monthLabel(month)}</div>
            <div className="stack">
              {entries.map((entry) => (
                <WineCard
                  key={entry.id}
                  to={`/diary/${entry.id}`}
                  photoId={entry.photoId}
                  producer={entry.producer}
                  title={`${wineTitle(entry)} ${vintageLabel(entry.vintage)}`}
                  meta={[formatDate(entry.drunkOn), placeLabel(entry) || originLine(entry)]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    entry.rating ? (
                      <div className="qty" style={{ minWidth: 'auto' }}>
                        <StarRating value={entry.rating} />
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))
      )}

      <Link to="/diary/new" className="fab" aria-label="Log a wine">
        <PlusIcon />
      </Link>
    </Screen>
  );
};
