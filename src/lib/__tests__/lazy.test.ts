import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isStaleBuild, loadModule, StaleBuildError } from '../lazy.ts';

const withOnline = async (online: boolean, body: () => Promise<void>) => {
  const before = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: online },
    configurable: true,
  });
  try {
    await body();
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: before, configurable: true });
  }
};

test('a module that loads is handed straight back', async () => {
  const module = await loadModule(async () => ({ answer: 42 }));
  assert.deepEqual(module, { answer: 42 });
});

test('a chunk missing after a deploy asks for a reload', async () => {
  await withOnline(true, async () => {
    const failure = await loadModule(() =>
      Promise.reject(new TypeError('Importing a module script failed.')),
    ).catch((error: unknown) => error);

    assert.ok(isStaleBuild(failure));
    assert.match((failure as Error).message, /Reload to finish updating/);
  });
});

test('offline is not a stale build, and says what it is', async () => {
  await withOnline(false, async () => {
    const failure = await loadModule(() =>
      Promise.reject(new TypeError('Importing a module script failed.')),
    ).catch((error: unknown) => error);

    assert.equal(isStaleBuild(failure), false);
    assert.match((failure as Error).message, /offline/);
  });
});

test('only a stale build reads as one', () => {
  assert.equal(isStaleBuild(new StaleBuildError()), true);
  assert.equal(isStaleBuild(new Error('something else')), false);
  assert.equal(isStaleBuild('a string'), false);
});
