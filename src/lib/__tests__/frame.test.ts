import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameHeight, needsMeasuredHeight, type Display } from '../frame.ts';

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

/** An iPhone with a Dynamic Island, stood up, as a Home Screen app. */
const phone = (over: Partial<Display> = {}): Display => ({
  standalone: true,
  screen: { width: 393, height: 852 },
  laidOut: { width: 393, height: 852 },
  insets: 59 + 34,
  ...over,
});

/** The same phone on its side, where only the home indicator is inset. */
const onItsSide = (over: Partial<Display> = {}): Display =>
  phone({ laidOut: { width: 852, height: 393 }, insets: 21, ...over });

test('a page in a browser is sized by the dynamic viewport', () => {
  assert.deepEqual(
    frameHeight(phone({ standalone: false, laidOut: { width: 393, height: 745 } })),
    { kind: 'viewport' },
  );
});

test('a Home Screen app laid out short of the screen takes the screen', () => {
  // Straight off the phone that reported this, read from Settings: a screen of
  // 393×852, a window and a dynamic viewport of 393×793, insets of 59 and 34.
  // The frame ended at 793 and a 59-point strip of page showed below the bar.
  assert.deepEqual(
    frameHeight({
      standalone: true,
      screen: { width: 393, height: 852 },
      laidOut: { width: 393, height: 793 },
      insets: 59 + 34,
    }),
    { kind: 'screen', height: 852, stretch: 59 },
  );
});

test('and one already reaching the bottom is given the same number', () => {
  // Nothing to reach past, so the bar keeps its labels where the display's own
  // inset puts them.
  assert.deepEqual(frameHeight(phone()), { kind: 'screen', height: 852, stretch: 0 });
});

test('on its side it takes the screen’s short side', () => {
  assert.deepEqual(frameHeight(onItsSide()), { kind: 'screen', height: 393, stretch: 0 });
});

test('whichever way round the platform reports the two sides', () => {
  // iOS has historically kept screen.width and screen.height the way the phone
  // was made, whatever way up it is being held.
  const reversed = { width: 852, height: 393 };
  assert.deepEqual(frameHeight(phone({ screen: reversed })), {
    kind: 'screen',
    height: 852,
    stretch: 0,
  });
  assert.deepEqual(frameHeight(onItsSide({ screen: reversed })), {
    kind: 'screen',
    height: 393,
    stretch: 0,
  });
});

test('a reading from the middle of a rotation is not acted on', () => {
  // The viewport has taken the new width and not yet the new height.
  assert.deepEqual(frameHeight(phone({ laidOut: { width: 852, height: 852 }, insets: 21 })), {
    kind: 'unsettled',
  });
  // And the other way about.
  assert.deepEqual(frameHeight(phone({ laidOut: { width: 393, height: 393 } })), {
    kind: 'unsettled',
  });
});

test('a window that is not the whole display is left alone', () => {
  // An iPad sharing its screen with another app: the frame is the window, and
  // the screen has nothing to say about it.
  assert.deepEqual(
    frameHeight(phone({ screen: { width: 1024, height: 1366 }, laidOut: { width: 507, height: 1366 } })),
    { kind: 'unsettled' },
  );
});

test('a shortfall the display cannot account for is not guessed at', () => {
  // Android counts the system gesture bar in screen.height and reports no
  // inset for it. Reaching the frame down there would put the bar under it.
  assert.deepEqual(
    frameHeight(phone({ laidOut: { width: 393, height: 852 - 48 }, insets: 0 })),
    { kind: 'unsettled' },
  );
});

test('a screen with no insets at all still gets its own height', () => {
  const old = { width: 375, height: 667 };
  assert.deepEqual(frameHeight(phone({ screen: old, laidOut: old, insets: 0 })), {
    kind: 'screen',
    height: 667,
    stretch: 0,
  });
});
