import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellarStats, diaryStats } from '../stats.ts';
import type { CellarWine, DiaryEntry } from '../../types.ts';

const wine = (overrides: Partial<CellarWine>): CellarWine => ({
  id: Math.random().toString(36).slice(2),
  name: '',
  producer: 'Producer',
  country: 'France',
  region: 'Burgundy',
  appellation: '',
  grapes: ['Chardonnay'],
  vintage: 2020,
  classification: '',
  wineType: 'White',
  abv: 13,
  sizeMl: 750,
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
  ...overrides,
});

const entry = (overrides: Partial<DiaryEntry>): DiaryEntry => ({
  id: Math.random().toString(36).slice(2),
  cellarWineId: null,
  name: '',
  producer: 'Producer',
  country: 'France',
  region: '',
  appellation: '',
  grapes: [],
  vintage: 2020,
  classification: '',
  wineType: 'Red',
  abv: null,
  sizeMl: 750,
  drunkOn: '2026-01-15',
  setting: 'private',
  place: 'Home',
  venue: '',
  city: '',
  venueCountry: '',
  occasion: '',
  companions: '',
  rating: null,
  tastingNote: '',
  price: null,
  currency: 'EUR',
  photoId: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
});

test('cellar totals count bottles, not rows, and ignore emptied wines', () => {
  const stats = cellarStats(
    [wine({ quantity: 3 }), wine({ quantity: 2, country: 'Italy' }), wine({ quantity: 0 })],
    'EUR',
  );
  assert.equal(stats.bottles, 5);
  assert.equal(stats.wines, 2);
  assert.equal(stats.countries, 2);
});

test('cellar value only counts bottles that carry a price', () => {
  const stats = cellarStats(
    [wine({ quantity: 2, purchasePrice: 50 }), wine({ quantity: 2, purchasePrice: null })],
    'EUR',
  );
  assert.equal(stats.value, 100);
  assert.equal(stats.valueCoverage, 0.5);
});

test('grapes in a blend each get the full bottle count', () => {
  const stats = cellarStats([wine({ quantity: 4, grapes: ['Syrah', 'Grenache'] })], 'EUR');
  assert.deepEqual(
    stats.byGrape.map((slice) => [slice.label, slice.value]),
    [
      ['Grenache', 4],
      ['Syrah', 4],
    ],
  );
});

test('ranked slices fold the tail into Other', () => {
  const wines = Array.from({ length: 12 }, (_, index) =>
    wine({ quantity: 1, country: `Country ${index}` }),
  );
  const stats = cellarStats(wines, 'EUR');
  assert.equal(stats.byCountry.length, 8);
  const other = stats.byCountry.at(-1);
  assert.equal(other?.label, 'Other');
  assert.equal(other?.value, 5);
});

test('non-vintage bottles sort after the vintages', () => {
  const stats = cellarStats(
    [wine({ vintage: 2018 }), wine({ vintage: null }), wine({ vintage: 2010 })],
    'EUR',
  );
  assert.deepEqual(stats.byVintage.map((slice) => slice.label), ['2010', '2018', 'NV']);
});

test('average rating skips unrated bottles', () => {
  const stats = diaryStats([entry({ rating: 5 }), entry({ rating: 3 }), entry({ rating: null })], 'EUR');
  assert.equal(stats.bottles, 3);
  assert.equal(stats.rated, 2);
  assert.equal(stats.averageRating, 4);
});

test('averages by country need at least two rated bottles', () => {
  const stats = diaryStats(
    [
      entry({ country: 'Italy', rating: 4 }),
      entry({ country: 'Italy', rating: 5 }),
      entry({ country: 'Spain', rating: 2 }),
    ],
    'EUR',
  );
  assert.deepEqual(
    stats.ratingByCountry.map((slice) => [slice.label, slice.value, slice.detail]),
    [['Italy', 4.5, '2 btl']],
  );
});

test('the monthly series always spans twelve months', () => {
  const stats = diaryStats([entry({})], 'EUR');
  assert.equal(stats.perMonth.length, 12);
  assert.equal(
    stats.perMonth.reduce((sum, slice) => sum + slice.value, 0) <= 1,
    true,
  );
});

test('venues are grouped by name and city, and counted', () => {
  const stats = diaryStats(
    [
      entry({ setting: 'venue', venue: 'Noma', city: 'Copenhagen', venueCountry: 'Denmark' }),
      entry({ setting: 'venue', venue: 'Noma', city: 'Copenhagen', venueCountry: 'Denmark' }),
      entry({ place: 'Home' }),
    ],
    'EUR',
  );
  assert.equal(stats.atVenue, 2);
  assert.deepEqual(
    stats.byPlace.map((slice) => [slice.label, slice.value]),
    [
      ['Noma, Copenhagen', 2],
      ['Home', 1],
    ],
  );
});
