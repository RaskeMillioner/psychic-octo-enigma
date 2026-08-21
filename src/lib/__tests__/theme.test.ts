import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTheme, THEME_OPTIONS } from '../theme.ts';

test('an explicit choice ignores what the device is doing', () => {
  assert.equal(resolveTheme('dark', true), 'dark');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
});

test('matching the device follows it both ways', () => {
  assert.equal(resolveTheme('system', true), 'light');
  assert.equal(resolveTheme('system', false), 'dark');
});

test('the switch offers all three, dark first', () => {
  assert.deepEqual(
    THEME_OPTIONS.map((option) => option.value),
    ['dark', 'light', 'system'],
  );
});
