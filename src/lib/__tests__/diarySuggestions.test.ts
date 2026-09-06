import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  companionCompletions,
  diarySuggestions,
  splitCompanions,
  type DiaryPlaces,
} from '../diarySuggestions.ts';

const entry = (overrides: Partial<DiaryPlaces>): DiaryPlaces => ({
  place: '',
  venue: '',
  city: '',
  venueCountry: '',
  occasion: '',
  companions: '',
  ...overrides,
});

test('collects past values, trimmed, deduplicated and sorted', () => {
  const suggestions = diarySuggestions([
    entry({ venue: 'Noma', city: 'Copenhagen', occasion: 'Birthday' }),
    entry({ venue: ' Noma ', city: 'Aarhus', occasion: '' }),
    entry({ place: 'Home' }),
  ]);
  assert.deepEqual(suggestions.venues, ['Noma']);
  assert.deepEqual(suggestions.cities, ['Aarhus', 'Copenhagen']);
  assert.deepEqual(suggestions.occasions, ['Birthday']);
  assert.deepEqual(suggestions.places, ['Home']);
  assert.deepEqual(suggestions.venueCountries, []);
});

test('companions are collected name by name, not as whole lines', () => {
  const { companions } = diarySuggestions([
    entry({ companions: 'Anna, Peter' }),
    entry({ companions: 'peter' }),
    entry({ companions: 'Bo' }),
  ]);
  assert.deepEqual(companions, ['Anna', 'Bo', 'Peter']);
});

test('splitCompanions drops blanks and whitespace', () => {
  assert.deepEqual(splitCompanions(' Anna , , Peter '), ['Anna', 'Peter']);
});

test('an empty field offers each name on its own', () => {
  assert.deepEqual(companionCompletions('', ['Anna', 'Peter']), ['Anna', 'Peter']);
});

test('after a comma, names are offered appended to what is already there', () => {
  assert.deepEqual(companionCompletions('Anna, ', ['Anna', 'Bo', 'Peter']), [
    'Anna, Bo',
    'Anna, Peter',
  ]);
});

test('a half-typed last name is completed, and the name before it is not repeated', () => {
  assert.deepEqual(companionCompletions('Anna, Pe', ['Anna', 'Peter']), ['Anna, Peter']);
});

test('names already on the line are not offered again', () => {
  assert.deepEqual(companionCompletions('Anna, Bo, ', ['anna', 'Bo', 'Peter']), ['Anna, Bo, Peter']);
});
