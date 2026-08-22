import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photoInUse } from '../photoRefs.ts';

const holder = (id: string, photoId: string | null) => ({ id, photoId });

test('a photo nothing points at is free to delete', () => {
  assert.equal(photoInUse('p1', [[holder('w1', null)], []]), false);
  assert.equal(photoInUse('p1', [[], []]), false);
});

test('a photo another record still shows is kept', () => {
  // Every bottle from one receipt carries the same photo, so deleting one of
  // them must not blank the label on the rest.
  const wines = [holder('w1', 'receipt'), holder('w2', 'receipt')];
  assert.equal(photoInUse('receipt', [wines, []], 'w1'), true);
});

test('the record being deleted does not keep its own photo alive', () => {
  assert.equal(photoInUse('p1', [[holder('w1', 'p1')], []], 'w1'), false);
});

test('a diary entry counts as a holder too', () => {
  assert.equal(photoInUse('p1', [[], [holder('d1', 'p1')]], 'w1'), true);
});
