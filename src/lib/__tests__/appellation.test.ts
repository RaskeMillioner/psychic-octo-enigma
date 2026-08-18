import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appellationPatch,
  describePatch,
  findAppellation,
  normalize,
  suggestAppellations,
} from '../appellation.ts';
import { emptyWineFacts } from '../../types.ts';

test('matches a plain appellation name', () => {
  const match = findAppellation('Chablis');
  assert.equal(match?.entry.country, 'France');
  assert.deepEqual(match?.entry.grapes, ['Chardonnay']);
});

test('ignores case, accents and punctuation', () => {
  assert.equal(normalize('Rías Baixas'), 'rias baixas');
  assert.equal(findAppellation('rias baixas')?.entry.region, 'Galicia');
  assert.equal(findAppellation('CHÂTEAUNEUF-DU-PAPE')?.entry.region, 'Southern Rhône');
});

test('reads the classification out of the label wording', () => {
  const match = findAppellation('Gevrey-Chambertin 1er Cru');
  assert.equal(match?.entry.name, 'Gevrey-Chambertin');
  assert.equal(match?.classification, 'Premier Cru');
});

test('finds the appellation inside a longer vineyard designation', () => {
  const match = findAppellation('Puligny-Montrachet 1er Cru Les Combettes');
  assert.equal(match?.entry.name, 'Puligny-Montrachet');
  assert.equal(match?.entry.region, 'Burgundy');
});

test('prefers the longer appellation when names overlap', () => {
  assert.equal(findAppellation('Saint-Émilion Grand Cru')?.entry.name, 'Saint-Émilion Grand Cru');
});

test('matches aliases and strips appellation boilerplate', () => {
  assert.equal(findAppellation('Sherry')?.entry.name, 'Jerez');
  assert.equal(findAppellation('Barolo DOCG')?.entry.name, 'Barolo');
});

test('returns null for anything unknown', () => {
  assert.equal(findAppellation('Planet Zog Vineyards'), null);
  assert.equal(findAppellation(''), null);
});

test('only fills blank fields', () => {
  const match = findAppellation('Barolo');
  assert.ok(match);
  const facts = { ...emptyWineFacts(), country: 'Italy', grapes: ['Barbera'] };
  const patch = appellationPatch(facts, match);
  assert.equal(patch.country, undefined, 'country was already set');
  assert.equal(patch.grapes, undefined, 'grapes were already set');
  assert.equal(patch.region, 'Piedmont');
  assert.equal(patch.classification, 'DOCG');
});

test('a label classification beats the appellation default', () => {
  const match = findAppellation('Chianti Classico Riserva');
  assert.ok(match);
  const patch = appellationPatch(emptyWineFacts(), match);
  assert.equal(patch.classification, 'Riserva');
});

test('suggestions are prefix-first', () => {
  const suggestions = suggestAppellations('barb');
  assert.ok(suggestions.includes('Barbaresco'));
  assert.ok(suggestions.every((name) => typeof name === 'string'));
});

test('the hint names what was filled', () => {
  assert.match(describePatch({ country: 'France', grapes: ['Gamay'] }), /country and grapes/);
  assert.equal(describePatch({}), '');
});
