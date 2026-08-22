import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameBottomPadding, frameHeight, HOME_INDICATOR } from '../frame.ts';

const height = (over: Partial<Parameters<typeof frameHeight>[0]> = {}) =>
  frameHeight({ standalone: true, innerHeight: 763, screenHeight: 852, ...over });

test('a standalone app laid out short of the screen fills the screen', () => {
  assert.equal(height(), 852);
});

test('when the two agree, nothing is stretched', () => {
  assert.equal(height({ innerHeight: 852 }), 852);
  assert.equal(height({ innerHeight: 900, screenHeight: 852 }), 900, 'never shrinks the viewport');
});

test('a browser tab is left alone — that space is the toolbar', () => {
  assert.equal(height({ standalone: false }), 763);
});

test('an implausible difference is not trusted', () => {
  assert.equal(height({ innerHeight: 400 }), 400, 'a rotated or stale measurement');
});

test('the bar keeps its labels off the home indicator', () => {
  assert.equal(frameBottomPadding(89), HOME_INDICATOR, 'capped at the indicator');
  assert.equal(frameBottomPadding(20), 20, 'a small reach needs only itself');
  assert.equal(frameBottomPadding(0), 0, 'nothing to clear when nothing was added');
});
