import assert from 'node:assert/strict';
import { test } from 'node:test';
import { windowLabel, windowStatus } from '../drinkWindow.ts';

const at = (drinkFrom: number | null, drinkTo: number | null) => ({ drinkFrom, drinkTo });

test('a bottle inside its window is ready', () => {
  assert.equal(windowStatus(at(2024, 2032), 2026), 'ready');
  assert.equal(windowStatus(at(2026, 2026), 2026), 'ready', 'the bounds are inclusive');
});

test('one bound is enough to place a bottle', () => {
  assert.equal(windowStatus(at(2030, null), 2026), 'young');
  assert.equal(windowStatus(at(null, 2024), 2026), 'past');
  assert.equal(windowStatus(at(2020, null), 2026), 'ready', 'open-ended above');
  assert.equal(windowStatus(at(null, 2030), 2026), 'ready', 'open-ended below');
});

test('no window recorded is not the same as ready', () => {
  assert.equal(windowStatus(at(null, null), 2026), 'unknown');
});

test('the label says what to do about it', () => {
  assert.equal(windowLabel(at(2024, 2032), 2026), 'Ready now, until 2032');
  assert.equal(windowLabel(at(2020, null), 2026), 'Ready now');
  assert.equal(windowLabel(at(2030, 2040), 2026), 'From 2030');
  assert.equal(windowLabel(at(2015, 2024), 2026), 'Past its window (2024)');
  assert.equal(windowLabel(at(null, null), 2026), '');
});
