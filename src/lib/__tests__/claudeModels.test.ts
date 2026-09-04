import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supportsFilteredSearch } from '../claudeModels.ts';

test('the 4.6 line decides who gets the filtered search', () => {
  for (const model of [
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-fable-5-1',
    'claude-opus-4-8',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
  ]) {
    assert.equal(supportsFilteredSearch(model), true, model);
  }

  for (const model of [
    'claude-haiku-4-5',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5',
    'claude-3-5-haiku-20241022',
    'claude-3-7-sonnet-20250219',
  ]) {
    assert.equal(supportsFilteredSearch(model), false, model);
  }
});

test('a trailing date is not a version', () => {
  assert.equal(supportsFilteredSearch('claude-haiku-4-5-20251001'), false);
  assert.equal(supportsFilteredSearch('claude-opus-4-6-20260101'), true);
});

test('an id it cannot read gets the search every model accepts', () => {
  assert.equal(supportsFilteredSearch(''), false);
  assert.equal(supportsFilteredSearch('some-fine-tune'), false);
});
