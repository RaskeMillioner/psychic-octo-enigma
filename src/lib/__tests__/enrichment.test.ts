import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnrichment, hasGaps, mergeEnrichment } from '../enrichment.ts';
import type { CellarWine, DiaryEntry } from '../../types.ts';

const wine = (overrides: Partial<CellarWine>): CellarWine => ({
  id: 'w1',
  name: 'Clavoillon',
  producer: 'Domaine Leflaive',
  country: '',
  region: '',
  appellation: '',
  grapes: [],
  vintage: 2019,
  classification: '',
  wineType: '',
  abv: null,
  sizeMl: 750,
  quantity: 6,
  purchasePrice: 180,
  currency: 'EUR',
  purchaseDate: '2024-02-11',
  purchasedFrom: 'Merchant',
  drinkFrom: null,
  drinkTo: null,
  storageLocation: 'Rack 3',
  notes: 'Keep for the long haul.',
  photoId: 'photo-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const diaryEntry = (overrides: Partial<DiaryEntry>): DiaryEntry =>
  ({
    ...wine({}),
    id: 'd1',
    cellarWineId: null,
    drunkOn: '2026-02-02',
    setting: 'private',
    place: 'Home',
    venue: '',
    city: '',
    venueCountry: '',
    occasion: '',
    companions: '',
    rating: 4,
    tastingNote: 'Lovely.',
    price: null,
    ...overrides,
  }) as DiaryEntry;

const enriched = (records: Record<string, unknown>[]) => ({
  format: 'cellarbook-enrichment',
  version: 1,
  exportedAt: '2026-08-19T00:00:00.000Z',
  instructions: '',
  wines: records,
});

/* ------------------------------------------------------------------ export */

test('only wines with something missing are exported', () => {
  const complete = wine({
    id: 'w2',
    country: 'France',
    region: 'Burgundy',
    appellation: 'Puligny-Montrachet',
    classification: 'Premier Cru',
    grapes: ['Chardonnay'],
    wineType: 'White',
    abv: 13,
  });
  const file = buildEnrichment([wine({}), complete], []);
  assert.deepEqual(file.wines.map((record) => record.id), ['w1']);
  assert.equal(hasGaps(file.wines[0]), true);
});

test('the export carries no photos, quantities or prices', () => {
  const file = buildEnrichment([wine({})], []);
  const record = file.wines[0] as unknown as Record<string, unknown>;
  for (const forbidden of ['photoId', 'quantity', 'purchasePrice', 'notes', 'storageLocation']) {
    assert.equal(record[forbidden], undefined, `${forbidden} must not leave the app`);
  }
  assert.equal(record.producer, 'Domaine Leflaive');
});

test('diary entries come along, tagged by kind', () => {
  const file = buildEnrichment([], [diaryEntry({})]);
  assert.equal(file.wines[0].kind, 'diary');
});

test('a batch is capped so one reply can cover it', () => {
  const many = Array.from({ length: 80 }, (_, index) => wine({ id: `w${index}` }));
  assert.equal(buildEnrichment(many, [], { limit: 25 }).wines.length, 25);
});

test('the file tells the model what to do with it', () => {
  const file = buildEnrichment([wine({})], []);
  assert.match(file.instructions, /search the web/i);
  assert.match(file.instructions, /Never change a field that already has a value/i);
});

/* ------------------------------------------------------------------- merge */

test('blanks are filled and counted', () => {
  const report = mergeEnrichment(
    enriched([
      { id: 'w1', kind: 'cellar', country: 'France', region: 'Burgundy', grapes: ['Chardonnay'], abv: 13 },
    ]),
    [wine({})],
    [],
  );
  assert.equal(report.filled, 4);
  assert.equal(report.wines[0].country, 'France');
  assert.deepEqual(report.wines[0].grapes, ['Chardonnay']);
  assert.equal(report.wines[0].abv, 13);
});

test('values already set are never overwritten', () => {
  const report = mergeEnrichment(
    enriched([{ id: 'w1', kind: 'cellar', country: 'Italy', region: 'Burgundy' }]),
    [wine({ country: 'France' })],
    [],
  );
  assert.equal(report.wines[0].country, 'France');
  assert.equal(report.ignored, 1);
  assert.equal(report.filled, 1);
});

test('quantities, prices, photos and notes survive a merge untouched', () => {
  const report = mergeEnrichment(
    enriched([
      {
        id: 'w1', kind: 'cellar', country: 'France',
        quantity: 999, purchasePrice: 1, photoId: null, notes: 'wiped', storageLocation: '',
      },
    ]),
    [wine({})],
    [],
  );
  const merged = report.wines[0];
  assert.equal(merged.quantity, 6);
  assert.equal(merged.purchasePrice, 180);
  assert.equal(merged.photoId, 'photo-1');
  assert.equal(merged.notes, 'Keep for the long haul.');
  assert.equal(merged.storageLocation, 'Rack 3');
});

test('records this cellar does not have are skipped, not inserted', () => {
  const report = mergeEnrichment(
    enriched([{ id: 'invented', kind: 'cellar', country: 'France' }]),
    [wine({})],
    [],
  );
  assert.equal(report.unknown, 1);
  assert.equal(report.wines.length, 0);
});

test('nonsense values are dropped rather than stored', () => {
  const report = mergeEnrichment(
    enriched([{ id: 'w1', kind: 'cellar', wineType: 'Purple', abv: 'quite strong', grapes: 'Chardonnay' }]),
    [wine({})],
    [],
  );
  assert.equal(report.filled, 0);
  assert.equal(report.wines.length, 0);
});

test('diary entries merge by the same rules', () => {
  const report = mergeEnrichment(
    enriched([{ id: 'd1', kind: 'diary', region: 'Burgundy' }]),
    [],
    [diaryEntry({})],
  );
  assert.equal(report.diary[0].region, 'Burgundy');
  assert.equal(report.diary[0].rating, 4);
  assert.equal(report.diary[0].tastingNote, 'Lovely.');
});

test('a file that is not an enrichment file is refused', () => {
  assert.throws(() => mergeEnrichment({ format: 'cellarbook-backup' }, [], []), /not a CellarBook enrichment file/);
  assert.throws(() => mergeEnrichment(null, [], []), /not a CellarBook enrichment file/);
});
