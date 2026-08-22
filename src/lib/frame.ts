/**
 * The frame is the height of the dynamic viewport, which is a plain CSS
 * declaration — `100dvh` — everywhere that supports it. This file exists only
 * for the browsers that do not: iOS before 15.4, where `vh` means the viewport
 * with the toolbars hidden and so overshoots the visible area.
 *
 * There was a heuristic here that reached the frame down to `screen.height`
 * whenever a standalone app appeared to be laid out short of the display. It
 * never fired on the device it was written for — `screen`, `window` and `dvh`
 * all agreed — and it would misfire on Android, where `screen.height` includes
 * the system gesture bar. Measuring the viewport is the job; guessing at the
 * display is not.
 */

/** Whether this browser needs a measured height rather than `100dvh`. */
export const needsMeasuredHeight = (): boolean =>
  typeof CSS === 'undefined' ||
  typeof CSS.supports !== 'function' ||
  !CSS.supports('height', '100dvh');

/** Writes the viewport's height onto the document for the CSS to use. */
export const applyFrame = (): void => {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
};

/**
 * Keeps the fallback current through rotation and any late settling of the
 * viewport. Where `dvh` is supported this does nothing at all: CSS already has
 * a better answer than anything measured here, and one that updates itself.
 */
export const watchFrame = (): (() => void) => {
  if (!needsMeasuredHeight()) return () => {};

  applyFrame();
  const update = () => applyFrame();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
  };
};
