import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnrichment, hasGaps, mergeEnrichment } from '../enrichment.ts';
import { parseJsonLoosely } from '../json.ts';
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
    drinkFrom: 2026,
    drinkTo: 2036,
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

/* ------------------------------------------------------------------ review */

import { sanitiseReview } from '../enrichment.ts';

test('the export shows the whole cellar, not only the wines with gaps', () => {
  const complete = wine({
    id: 'w2', country: 'Italy', region: 'Piedmont', appellation: 'Barolo',
    classification: 'DOCG', grapes: ['Nebbiolo'], wineType: 'Red', abv: 14, quantity: 3,
    drinkFrom: 2026, drinkTo: 2046,
  });
  // A diary entry with nothing missing, so the count isolates the cellar case.
  const drunk = diaryEntry({
    rating: 5, country: 'Italy', region: 'Piedmont', appellation: 'Barolo',
    classification: 'DOCG', grapes: ['Nebbiolo'], wineType: 'Red', abv: 14,
  });
  const file = buildEnrichment([wine({}), complete], [drunk]);
  assert.equal(file.wines.length, 1, 'only the incomplete wine needs filling');
  assert.equal(file.cellar.length, 2, 'but the review sees both');
  assert.equal(file.cellar[1].quantity, 3, 'depth is part of the picture');
  assert.equal(file.consumed[0].rating, 5, 'and so is what was enjoyed');
});

test('the collection summary still leaves prices and notes at home', () => {
  const file = buildEnrichment([wine({})], []);
  const entry = file.cellar[0] as unknown as Record<string, unknown>;
  for (const forbidden of ['purchasePrice', 'notes', 'photoId', 'storageLocation', 'purchasedFrom']) {
    assert.equal(entry[forbidden], undefined, `${forbidden} must not leave the app`);
  }
});

test('emptied cellar entries are left out of the review picture', () => {
  const file = buildEnrichment([wine({ id: 'w3', quantity: 0 })], []);
  assert.equal(file.cellar.length, 0);
});

test('the instructions ask for a candid review, not just metadata', () => {
  const file = buildEnrichment([wine({})], []);
  assert.match(file.instructions, /"strengths"/);
  assert.match(file.instructions, /"gaps"/);
  assert.match(file.instructions, /"suggestions"/);
  assert.match(file.instructions, /candid rather than flattering/i);
});

test('the instructions ask for a file, since a chat message cannot be imported', () => {
  const { instructions } = buildEnrichment([wine({})], []);
  assert.match(instructions, /downloadable file named "cellarbook-filled\.json"/);
  assert.match(instructions, /Do NOT paste the JSON into the chat/);
  assert.match(instructions, /cannot produce a file/, 'with a fallback for chats that cannot');
  assert.match(instructions, /"format", "version"/, 'and a warning to keep the keys the import needs');
});

test('an answer pasted with a fence or a sentence around it still merges', () => {
  const reply = JSON.stringify({
    ...enriched([{ id: 'w1', kind: 'cellar', country: 'France' }]),
    review: { summary: 'Fine cellar.', strengths: [], gaps: [], suggestions: [] },
  });
  const messy = `Here you go!\n\n\`\`\`json\n${reply}\n\`\`\`\n\nHope that helps.`;
  const report = mergeEnrichment(parseJsonLoosely(messy), [wine({})], []);
  assert.equal(report.wines[0].country, 'France');
  assert.equal(report.review?.summary, 'Fine cellar.');
});

test('a review comes back through the merge', () => {
  const report = mergeEnrichment(
    {
      ...enriched([]),
      review: {
        summary: 'A Burgundy-heavy cellar with little to drink tonight.',
        strengths: ['Real depth in white Burgundy'],
        gaps: ['Almost nothing ready to open'],
        suggestions: [{ wine: 'Produttori del Barbaresco Barbaresco', why: 'Mature Nebbiolo for now' }],
      },
    },
    [],
    [],
  );
  assert.equal(report.review?.strengths[0], 'Real depth in white Burgundy');
  assert.equal(report.review?.suggestions[0].wine, 'Produttori del Barbaresco Barbaresco');
});

test('a malformed review is dropped rather than rendered', () => {
  assert.equal(sanitiseReview(null), null);
  assert.equal(sanitiseReview('a lovely cellar'), null);
  assert.equal(sanitiseReview({ summary: '   ' }), null);
  assert.equal(sanitiseReview({ strengths: 'not a list' }), null);
});

test('a review is capped so a runaway reply cannot break the page', () => {
  const review = sanitiseReview({
    summary: 'x'.repeat(5000),
    strengths: Array.from({ length: 40 }, (_, index) => `point ${index}`),
    suggestions: [{ wine: 'y'.repeat(500), why: 'z'.repeat(900) }, { why: 'no name' }],
  });
  assert.equal(review?.summary.length, 1500);
  assert.equal(review?.strengths.length, 6);
  assert.equal(review?.suggestions.length, 1, 'a suggestion without a wine is not one');
  assert.equal(review?.suggestions[0].wine.length, 200);
  assert.equal(review?.suggestions[0].why.length, 400);
});

/* --------------------------------------------------------- drinking window */

test('a wine with every field but no drinking window still has a gap', () => {
  const filled = wine({
    country: 'France', region: 'Burgundy', appellation: 'Puligny-Montrachet',
    classification: 'Premier Cru', grapes: ['Chardonnay'], wineType: 'White', abv: 13,
  });
  assert.equal(hasGaps(buildEnrichment([filled], []).wines[0] ?? { id: '' } as never), true);
  assert.equal(buildEnrichment([filled], []).wines.length, 1);
});

test('the window is asked for on cellar records only', () => {
  const cellar = buildEnrichment([wine({})], []).wines[0];
  assert.equal(cellar.drinkFrom, null, 'present and empty, so it reads as a gap');
  const entry = buildEnrichment([], [diaryEntry({})]).wines[0];
  assert.equal('drinkFrom' in entry, false, 'a diary entry has nowhere to put one');
});

test('a returned window fills a blank one', () => {
  const report = mergeEnrichment(
    enriched([{ id: 'w1', kind: 'cellar', drinkFrom: 2027, drinkTo: 2040 }]),
    [wine({})],
    [],
  );
  assert.equal(report.wines[0].drinkFrom, 2027);
  assert.equal(report.wines[0].drinkTo, 2040);
  assert.equal(report.filled, 2);
});

test('a window already recorded is kept', () => {
  const report = mergeEnrichment(
    enriched([{ id: 'w1', kind: 'cellar', drinkFrom: 2027 }]),
    [wine({ drinkFrom: 2024 })],
    [],
  );
  assert.equal(report.wines.length, 0, 'nothing to change');
  assert.equal(report.ignored, 1);
});

test('a nonsense year is dropped rather than stored', () => {
  const report = mergeEnrichment(
    enriched([{ id: 'w1', kind: 'cellar', drinkFrom: 'soon', drinkTo: 12 }]),
    [wine({})],
    [],
  );
  assert.equal(report.filled, 0);
});

test('a complete diary entry is not exported forever for want of a window', () => {
  const complete = diaryEntry({
    country: 'Italy', region: 'Piedmont', appellation: 'Barolo', classification: 'DOCG',
    grapes: ['Nebbiolo'], wineType: 'Red', abv: 14,
  });
  assert.equal(buildEnrichment([], [complete]).wines.length, 0);
});
