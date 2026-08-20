import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectScanModel } from '../scanGemini.ts';

const models = (...ids: string[]) => ids.map((id) => ({ id, label: id }));

test('prefers a concrete model over a -latest alias', () => {
  // An alias can resolve to a model with no free quota, and the failure then
  // names a model the account's dashboard never mentions.
  assert.equal(
    selectScanModel(models('gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash')),
    'gemini-2.5-flash',
  );
});

test('falls back to an alias only when nothing concrete is offered', () => {
  assert.equal(selectScanModel(models('gemini-flash-latest')), 'gemini-flash-latest');
});

test('otherwise takes the newest flash version', () => {
  assert.equal(
    selectScanModel(models('gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-2.5-flash')),
    'gemini-3.5-flash',
  );
});

test('skips preview and experimental builds, which carry no free quota', () => {
  assert.equal(
    selectScanModel(models('gemini-9.9-flash-preview', 'gemini-9.8-flash-exp', 'gemini-2.5-flash')),
    'gemini-2.5-flash',
  );
});

test('skips models that are not text-out vision models', () => {
  assert.equal(
    selectScanModel(models('gemini-3.0-flash-image', 'gemini-3.0-flash-tts', 'gemini-2.5-flash')),
    'gemini-2.5-flash',
  );
  assert.equal(selectScanModel(models('text-embedding-004', 'gemma-3-27b')), null);
});

test('never returns a model already tried', () => {
  assert.equal(
    selectScanModel(models('gemini-flash-latest', 'gemini-2.5-flash'), ['gemini-flash-latest']),
    'gemini-2.5-flash',
  );
  assert.equal(selectScanModel(models('gemini-2.5-flash'), ['gemini-2.5-flash']), null);
});

test('falls back to a non-flash model when no flash is available', () => {
  assert.equal(selectScanModel(models('gemini-2.5-pro')), 'gemini-2.5-pro');
});

test('prefers the plain id over a longer variant of the same version', () => {
  assert.equal(
    selectScanModel(models('gemini-2.5-flash-lite-8b', 'gemini-2.5-flash')),
    'gemini-2.5-flash',
  );
});

test('an empty list yields nothing rather than throwing', () => {
  assert.equal(selectScanModel([]), null);
});

/* ------------------------------------------------------- error reporting */

import { describeError, readError } from '../scanGemini.ts';

const errorResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

test('a zero free-tier quota is reported as permanent, with a way out', async () => {
  const error = await readError(
    errorResponse(429, {
      error: {
        message:
          'You exceeded your current quota. Quota exceeded for metric: generate_requests_per_model_per_day, limit: 0',
      },
    }),
  );
  assert.equal(error.exhausted, true);
  const text = describeError(error, 'gemini-3.5-flash');
  assert.match(text, /No quota for gemini-3\.5-flash/);
  assert.match(text, /not a wait/);
  assert.match(text, /switch provider/i);
});

test('a quota error with no retry time is not reported as something to wait out', async () => {
  // Exactly the shape Google returns when a model is not on the key's free
  // tier: no retryDelay, no limit figure, usage sitting at zero.
  const error = await readError(
    errorResponse(429, {
      error: { message: 'You exceeded your current quota, please check your plan and billing details.' },
    }),
  );
  assert.equal(error.exhausted, true);
  const text = describeError(error, 'gemini-flash-latest');
  assert.match(text, /No quota for gemini-flash-latest/);
  assert.match(text, /region/);
  assert.doesNotMatch(text, /wait a moment/);
  // One cause reported once, not a paragraph repeated per model.
  assert.equal(text.match(/No quota for/g)?.length, 1);
});

test('ordinary throttling is reported as a wait, with the delay Google gave', async () => {
  const error = await readError(
    errorResponse(429, {
      error: {
        message: 'Resource has been exhausted (e.g. check quota).',
        details: [{ retryDelay: '24s' }],
      },
    }),
  );
  assert.equal(error.exhausted, false);
  assert.equal(error.retryDelay, '24s');
  assert.match(describeError(error, 'gemini-2.5-flash'), /retry in 24s/);
});

test('other statuses carry Google’s own explanation through', async () => {
  const missing = await readError(errorResponse(404, { error: { message: 'models/x is not found' } }));
  assert.match(describeError(missing, 'x'), /x is not available to your key.*is not found/);

  const rejected = await readError(errorResponse(403, { error: { message: 'API key not valid' } }));
  assert.match(describeError(rejected, 'x'), /key was rejected.*API key not valid/);
});

test('a non-JSON error body still produces something readable', async () => {
  const error = await readError(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
  assert.match(describeError(error, 'gemini-2.5-flash'), /error \(502\)/);
});

/* --------------------------------------------------- provenance & parsing */

import { forgetTouched, toProvenance } from '../labelFields.ts';
import { parseJsonLoosely } from '../scanGemini.ts';

test('provenance keeps reported origins and drops the rest', () => {
  const provenance = toProvenance({
    producer: 'label',
    country: 'web',
    grapes: 'knowledge',
    vintage: 'guess',
    region: 'none',
    classification: 'nonsense',
    notAField: 'label',
  });
  assert.deepEqual(provenance, {
    producer: 'label',
    country: 'web',
    grapes: 'knowledge',
    vintage: 'guess',
  });
});

test('provenance survives a missing or malformed fields object', () => {
  assert.deepEqual(toProvenance(undefined), {});
  assert.deepEqual(toProvenance('nope'), {});
});

test('editing a field forgets where the model got its value', () => {
  const provenance = toProvenance({ producer: 'label', grapes: 'guess' });
  assert.deepEqual(forgetTouched(provenance, { grapes: ['Syrah'] }), { producer: 'label' });
  assert.deepEqual(forgetTouched(provenance, { quantity: 3 }), provenance);
});

test('a grounded answer wrapped in prose or a code fence still parses', () => {
  assert.deepEqual(parseJsonLoosely('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonLoosely('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoosely('Here is the wine:\n{"a":1}\nHope that helps.'), { a: 1 });
  assert.throws(() => parseJsonLoosely('no object here'));
});
