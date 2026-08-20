import { useMemo, useState } from 'react';
import {
  ChartCard,
  ColumnChart,
  COUNT_HUE,
  RankedBars,
  RATING_HUE,
  Tile,
} from '../components/charts';
import { CellarReviewCard } from '../components/CellarReviewCard';
import { ChartIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { EmptyState } from '../components/ui';
import { formatMoney } from '../lib/format';
import { clearReview } from '../lib/db';
import { cellarStats, diaryStats } from '../lib/stats';
import { useData } from '../lib/store';

type Scope = 'cellar' | 'diary';

const bottles = (value: number) => `${value}`;
const stars = (value: number) => value.toFixed(1);

export const StatsPage = () => {
  const { wines, diary, settings, review, loading, reload } = useData();
  const [scope, setScope] = useState<Scope>('cellar');

  const cellar = useMemo(() => cellarStats(wines, settings.currency), [wines, settings.currency]);
  const drunk = useMemo(() => diaryStats(diary, settings.currency), [diary, settings.currency]);

  const hasCellar = cellar.bottles > 0;
  const hasDiary = drunk.bottles > 0;

  return (
    <Screen title="Statistics">
      {review ? (
        <CellarReviewCard
          review={review}
          onClear={() => {
            void clearReview().then(reload);
          }}
        />
      ) : null}

      {/* One scope switch above everything it scopes — never per chart. */}
      <div className="chips" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`chip${scope === 'cellar' ? ' active' : ''}`}
          onClick={() => setScope('cellar')}
        >
          In the cellar
        </button>
        <button
          type="button"
          className={`chip${scope === 'diary' ? ' active' : ''}`}
          onClick={() => setScope('diary')}
        >
          Drunk
        </button>
      </div>

      {loading ? null : scope === 'cellar' ? (
        !hasCellar ? (
          <EmptyState icon={<ChartIcon />} title="Nothing to chart yet">
            Add bottles to your cellar and the numbers appear here.
          </EmptyState>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            <div className="tiles">
              <Tile value={cellar.bottles} label="Bottles" />
              <Tile value={cellar.wines} label="Different wines" />
              <Tile value={cellar.countries} label="Countries" />
              <Tile
                value={cellar.value === null ? '—' : formatMoney(cellar.value, cellar.currency)}
                label="Cellar value"
              />
            </div>
            {cellar.value !== null && cellar.valueCoverage < 0.999 ? (
              <p className="tiny faint" style={{ margin: '-8px 2px 0' }}>
                Value covers the {Math.round(cellar.valueCoverage * 100)}% of bottles with a
                recorded price.
              </p>
            ) : null}

            <ChartCard title="Bottles by vintage" note="Non-vintage bottles sit at the far right.">
              <ColumnChart data={cellar.byVintage} />
            </ChartCard>

            <ChartCard title="Bottles by country">
              <RankedBars data={cellar.byCountry} format={bottles} />
            </ChartCard>

            <ChartCard title="Bottles by style">
              <RankedBars data={cellar.byType} format={bottles} />
            </ChartCard>

            <ChartCard
              title="Grape varieties"
              note="A blend counts once for each of its grapes, so the totals exceed the bottle count."
            >
              <RankedBars data={cellar.byGrape} format={bottles} />
            </ChartCard>

            <ChartCard title="Regions">
              <RankedBars data={cellar.byRegion} format={bottles} />
            </ChartCard>

            <ChartCard title="Producers">
              <RankedBars data={cellar.byProducer} format={bottles} />
            </ChartCard>

            <div className="tiles">
              <Tile value={cellar.readyNow} label="In their drinking window" />
            </div>
          </div>
        )
      ) : !hasDiary ? (
        <EmptyState icon={<ChartIcon />} title="No bottles logged yet">
          Mark a bottle as drunk and your drinking history is charted here.
        </EmptyState>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <div className="tiles">
            <Tile value={drunk.bottles} label="Bottles drunk" />
            <Tile value={drunk.thisYear} label={`Drunk in ${new Date().getFullYear()}`} />
            <Tile
              value={drunk.averageRating === null ? '—' : `${drunk.averageRating.toFixed(1)}★`}
              label="Average rating"
            />
            <Tile
              value={drunk.spend === null ? '—' : formatMoney(drunk.spend, drunk.currency)}
              label="Value drunk"
            />
            <Tile value={drunk.atVenue} label="Drunk out" />
          </div>

          <ChartCard title="Bottles per month" note="The last twelve months.">
            <ColumnChart data={drunk.perMonth} />
          </ChartCard>

          <ChartCard
            title="How you rate"
            note={`${drunk.rated} of ${drunk.bottles} bottles rated.`}
          >
            <RankedBars data={drunk.ratingSpread} hue={RATING_HUE} format={bottles} />
          </ChartCard>

          {drunk.ratingByCountry.length ? (
            <ChartCard
              title="Average rating by country"
              note="Countries with at least two rated bottles."
            >
              <RankedBars
                data={drunk.ratingByCountry}
                hue={RATING_HUE}
                format={stars}
                scaleMax={5}
              />
            </ChartCard>
          ) : null}

          {drunk.ratingByType.length ? (
            <ChartCard title="Average rating by style" note="Styles with at least two rated bottles.">
              <RankedBars data={drunk.ratingByType} hue={RATING_HUE} format={stars} scaleMax={5} />
            </ChartCard>
          ) : null}

          <ChartCard title="Bottles by country">
            <RankedBars data={drunk.byCountry} hue={COUNT_HUE} format={bottles} />
          </ChartCard>

          <ChartCard title="Grape varieties">
            <RankedBars data={drunk.byGrape} format={bottles} />
          </ChartCard>

          <ChartCard title="Producers">
            <RankedBars data={drunk.byProducer} format={bottles} />
          </ChartCard>

          <ChartCard
            title="Where you drank"
            note={`${drunk.atVenue} of ${drunk.bottles} bottles were drunk out.`}
          >
            <RankedBars data={drunk.byPlace} format={bottles} />
          </ChartCard>
        </div>
      )}
    </Screen>
  );
};
