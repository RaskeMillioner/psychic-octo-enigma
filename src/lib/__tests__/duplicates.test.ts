import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findDuplicate, mergeIntoCellar } from '../duplicates.ts';
import { emptyWineFacts, type CellarWine } from '../../types.ts';

const wine = (over: Partial<CellarWine> = {}): CellarWine => ({
  ...emptyWineFacts(),
  id: over.id ?? 'w1',
  quantity: 1,
  purchasePrice: null,
  currency: 'EUR',
  purchaseDate: '',
  purchasedFrom: '',
  drinkFrom: null,
  drinkTo: null,
  storageLocation: '',
  notes: '',
  photoId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const barton = wine({
  id: 'barton',
  producer: 'Château Léoville-Barton',
  name: 'Saint-Julien',
  vintage: 2016,
  quantity: 6,
});

test('the same bottle is found through accents and punctuation', () => {
  const found = findDuplicate(
    { producer: 'Chateau Leoville Barton', name: 'saint julien', vintage: 2016, sizeMl: 750 },
    [wine({ id: 'other', producer: 'Vega Sicilia' }), barton],
  );
  assert.equal(found?.id, 'barton');
});

test('another vintage or another size is another wine', () => {
  const other = (over: object) =>
    findDuplicate(
      { producer: 'Château Léoville-Barton', name: 'Saint-Julien', vintage: 2016, sizeMl: 750, ...over },
      [barton],
    );
  assert.equal(other({ vintage: 2015 }), null, 'a different vintage');
  assert.equal(other({ vintage: null }), null, 'non-vintage is not the 2016');
  assert.equal(other({ sizeMl: 1500 }), null, 'a magnum keeps its own line');
  assert.equal(other({ producer: 'Léoville Las Cases' }), null, 'a neighbour is not a match');
  assert.equal(other({ name: 'Réserve' }), null, 'a different cuvée');
});

test('a scan with no producer and no cuvée matches nothing', () => {
  const blank = wine({ id: 'blank', vintage: 2016 });
  assert.equal(findDuplicate({ producer: '', name: '', vintage: 2016, sizeMl: 750 }, [blank]), null);
});

test('a top-up adds the bottles and keeps the original purchase', () => {
  const existing = wine({
    quantity: 6,
    purchasePrice: 42,
    purchaseDate: '2024-03-01',
    purchasedFrom: 'Vinmonopolet',
    region: 'Bordeaux',
    producer: 'Barton',
  });
  const merged = mergeIntoCellar(existing, {
    ...existing,
    quantity: 6,
    purchasePrice: 55,
    purchaseDate: '2026-08-01',
    purchasedFrom: 'Berry Bros',
    region: 'Médoc',
  });
  assert.equal(merged.quantity, 12);
  assert.equal(merged.purchasePrice, 42, 'the original price stands');
  assert.equal(merged.purchaseDate, '2024-03-01');
  assert.equal(merged.purchasedFrom, 'Vinmonopolet');
  assert.equal(merged.region, 'Bordeaux');
  assert.equal(merged.id, existing.id);
});

test('a top-up fills what the entry left blank', () => {
  const existing = wine({ quantity: 2, producer: 'Barton' });
  const merged = mergeIntoCellar(existing, {
    ...existing,
    quantity: 3,
    country: 'France',
    region: 'Bordeaux',
    grapes: ['Cabernet Sauvignon', 'Merlot'],
    wineType: 'Red',
    abv: 13,
    drinkFrom: 2026,
    purchasePrice: 55,
    purchasedFrom: 'Berry Bros',
    photoId: 'p1',
    notes: 'Case of six.',
  });
  assert.equal(merged.quantity, 5);
  assert.equal(merged.country, 'France');
  assert.deepEqual(merged.grapes, ['Cabernet Sauvignon', 'Merlot']);
  assert.equal(merged.wineType, 'Red');
  assert.equal(merged.abv, 13);
  assert.equal(merged.drinkFrom, 2026);
  assert.equal(merged.purchasePrice, 55, 'no price on record, so the new one is kept');
  assert.equal(merged.purchasedFrom, 'Berry Bros');
  assert.equal(merged.photoId, 'p1');
  assert.equal(merged.notes, 'Case of six.');
});
