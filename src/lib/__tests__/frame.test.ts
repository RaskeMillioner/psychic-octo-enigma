import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsMeasuredHeight } from '../frame.ts';

/** Stands in for the browser's CSS object, which node has no notion of. */
const withCSS = <T>(value: unknown, run: () => T): T => {
  const globals = globalThis as { CSS?: unknown };
  const had = 'CSS' in globals;
  const previous = globals.CSS;
  if (value === undefined) delete globals.CSS;
  else globals.CSS = value;
  try {
    return run();
  } finally {
    if (had) globals.CSS = previous;
    else delete globals.CSS;
  }
};

test('a browser that understands dvh is left to CSS', () => {
  const supports = (property: string, value: string) =>
    property === 'height' && value === '100dvh';
  assert.equal(withCSS({ supports }, needsMeasuredHeight), false);
});

test('one that does not gets a measured height instead', () => {
  assert.equal(withCSS({ supports: () => false }, needsMeasuredHeight), true);
});

test('and so does one with no CSS.supports to ask', () => {
  assert.equal(withCSS({}, needsMeasuredHeight), true);
  assert.equal(withCSS(undefined, needsMeasuredHeight), true);
});
