import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeLabel } from '../format.ts';

const at = (overrides: Record<string, unknown>) =>
  ({
    setting: 'private',
    place: '',
    venue: '',
    city: '',
    venueCountry: '',
    ...overrides,
  }) as Parameters<typeof placeLabel>[0];

test('a private bottle is described by its free-text place', () => {
  assert.equal(placeLabel(at({ place: 'Home' })), 'Home');
  assert.equal(placeLabel(at({ place: 'Home', venue: 'Noma' })), 'Home');
});

test('a venue reads as restaurant and city, with the country only in full', () => {
  const entry = at({ setting: 'venue', venue: 'Noma', city: 'Copenhagen', venueCountry: 'Denmark' });
  assert.equal(placeLabel(entry), 'Noma, Copenhagen');
  assert.equal(placeLabel(entry, { full: true }), 'Noma, Copenhagen, Denmark');
});

test('missing parts are left out rather than leaving stray commas', () => {
  assert.equal(placeLabel(at({ setting: 'venue', venue: 'Noma' })), 'Noma');
  assert.equal(placeLabel(at({ setting: 'venue', city: 'Copenhagen' })), 'Copenhagen');
  assert.equal(placeLabel(at({ setting: 'venue' })), '');
  assert.equal(placeLabel(at({ place: '  ' })), '');
});
