import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeVenuePatch,
  rememberedCities,
  rememberedCompanions,
  rememberedPlaces,
  rememberedVenueCountries,
  rememberedVenues,
  suggestCompanions,
  venueLocation,
  venuePatch,
} from '../diaryMemory.ts';
import type { DiaryEntry } from '../../types.ts';

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

const atVenue = (overrides: Partial<DiaryEntry>): DiaryEntry =>
  entry({ setting: 'venue', place: '', ...overrides });

test('offers the place used most often first', () => {
  const places = rememberedPlaces([
    entry({ place: 'Home' }),
    entry({ place: "Anna's flat" }),
    entry({ place: 'Home' }),
  ]);
  assert.deepEqual(places, ['Home', "Anna's flat"]);
});

test('breaks a tie on how recently the place was used', () => {
  const places = rememberedPlaces([
    entry({ place: 'The garden', drunkOn: '2026-02-01' }),
    entry({ place: 'Home', drunkOn: '2026-05-01' }),
  ]);
  assert.deepEqual(places, ['Home', 'The garden']);
});

test('spellings that differ only in case or accent count as one value', () => {
  const venues = rememberedVenues([
    atVenue({ venue: 'cafe noir', drunkOn: '2026-01-01' }),
    atVenue({ venue: 'Café Noir', drunkOn: '2026-03-01' }),
  ]);
  assert.deepEqual(venues, ['Café Noir']);
});

test('places and venues stay in their own lists', () => {
  const diary = [
    entry({ place: 'Home' }),
    atVenue({ venue: 'Noma', city: 'Copenhagen', venueCountry: 'Denmark' }),
  ];
  assert.deepEqual(rememberedPlaces(diary), ['Home']);
  assert.deepEqual(rememberedVenues(diary), ['Noma']);
  assert.deepEqual(rememberedCities(diary), ['Copenhagen']);
  assert.deepEqual(rememberedVenueCountries(diary), ['Denmark']);
});

test('blank fields are never suggested', () => {
  assert.deepEqual(rememberedPlaces([entry({ place: '   ' })]), []);
  assert.deepEqual(rememberedCities([atVenue({ venue: 'Noma', city: '' })]), []);
});

test('companions are remembered as people, not as groups', () => {
  const names = rememberedCompanions([
    entry({ companions: 'Anna, Peter', drunkOn: '2026-03-01' }),
    atVenue({ venue: 'Noma', companions: 'anna , Sofie', drunkOn: '2026-01-01' }),
  ]);
  assert.deepEqual(names, ['Anna', 'Peter', 'Sofie']);
});

test('naming the same person twice in one entry counts once', () => {
  const names = rememberedCompanions([
    entry({ companions: 'Anna, Anna' }),
    entry({ companions: 'Peter' }),
    entry({ companions: 'Peter' }),
  ]);
  assert.deepEqual(names, ['Peter', 'Anna']);
});

test('a venue remembers where it was on the most recent visit', () => {
  const known = venueLocation(
    [
      atVenue({ venue: 'Noma', city: 'Copenhagen', venueCountry: 'Denmark', drunkOn: '2026-01-01' }),
      atVenue({ venue: 'noma', city: 'København', venueCountry: 'Denmark', drunkOn: '2026-04-01' }),
    ],
    'NOMA',
  );
  assert.deepEqual(known, { venue: 'noma', city: 'København', venueCountry: 'Denmark' });
});

test('an unknown venue is not remembered', () => {
  assert.equal(venueLocation([atVenue({ venue: 'Noma' })], 'Geranium'), null);
  assert.equal(venueLocation([atVenue({ venue: 'Noma' })], ''), null);
});

test('the venue patch fills blanks and leaves typed values alone', () => {
  const memory = { venue: 'Noma', city: 'Copenhagen', venueCountry: 'Denmark' };
  assert.deepEqual(venuePatch({ city: '', venueCountry: '' }, memory), {
    city: 'Copenhagen',
    venueCountry: 'Denmark',
  });
  assert.deepEqual(venuePatch({ city: 'Aarhus', venueCountry: '' }, memory), {
    venueCountry: 'Denmark',
  });
  assert.deepEqual(venuePatch({ city: 'Aarhus', venueCountry: 'Denmark' }, memory), {});
});

test('the hint names what was filled, and says nothing when nothing was', () => {
  assert.match(describeVenuePatch({ city: 'Copenhagen', venueCountry: 'Denmark' }), /city and country/);
  assert.match(describeVenuePatch({ venueCountry: 'Denmark' }), /Filled country/);
  assert.equal(describeVenuePatch({}), '');
});

test('an empty companions field offers the whole roster', () => {
  assert.deepEqual(suggestCompanions('', ['Anna', 'Peter']), ['Anna', 'Peter']);
});

test('completing a name keeps the names already typed', () => {
  assert.deepEqual(suggestCompanions('Anna, S', ['Anna', 'Peter', 'Sofie']), ['Anna, Sofie']);
});

test('someone already in the list is not offered again', () => {
  assert.deepEqual(suggestCompanions('Anna, ', ['Anna', 'Peter']), ['Anna, Peter']);
});

test('spacing after the comma is normalised', () => {
  assert.deepEqual(suggestCompanions('Anna,pe', ['Peter']), ['Anna, Peter']);
});

test('a prefix match outranks a match in the middle of a name', () => {
  assert.deepEqual(suggestCompanions('an', ['Susanne', 'Anna']), ['Anna', 'Susanne']);
});

test('the suggestion list is capped', () => {
  const roster = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  assert.equal(suggestCompanions('', roster).length, 8);
  assert.equal(suggestCompanions('', roster, 3).length, 3);
});
