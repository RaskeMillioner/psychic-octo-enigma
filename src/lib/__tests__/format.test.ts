import assert from 'node:assert/strict';
import { test } from 'node:test';
import { originLine, parseDecimal, placeLabel } from '../format.ts';
import { emptyWineFacts } from '../../types.ts';

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

test('a number is read with either decimal separator', () => {
  assert.equal(parseDecimal('13.5'), 13.5);
  assert.equal(parseDecimal('13,5'), 13.5);
  assert.equal(parseDecimal('45'), 45);
});

test('a half-typed number keeps the value it has so far', () => {
  // The point being typed must not be read as nothing: the field would empty
  // itself under the user mid-keystroke.
  assert.equal(parseDecimal('13.'), 13);
  assert.equal(parseDecimal('13,'), 13);
});

test('an empty or unreadable field is no value rather than zero', () => {
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('   '), null);
  assert.equal(parseDecimal('about twelve'), null);
});

test('the origin line names each place once, widest last', () => {
  const facts = emptyWineFacts();
  assert.equal(
    originLine({ ...facts, appellation: 'Chablis', region: 'Burgundy', country: 'France' }),
    'Chablis · Burgundy · France',
  );
  assert.equal(originLine({ ...facts, region: 'Burgundy', country: 'France' }), 'Burgundy · France');
  // Barolo is both the appellation and the region as often as not.
  assert.equal(
    originLine({ ...facts, appellation: 'Barolo', region: 'Barolo', country: 'Italy' }),
    'Barolo · Italy',
  );
  assert.equal(originLine(facts), '');
});
