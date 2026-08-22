/**
 * How tall the app's frame should be.
 *
 * On iOS a Home Screen app can lay out against a box that ends short of the
 * screen — the web view still paints its background over the whole display, but
 * percentages, `dvh` and `position: fixed` all resolve against the shorter one,
 * so anything anchored to the bottom floats above the bottom edge. `screen` is
 * the only measure that describes the display itself, so where it is taller by
 * a plausible margin, that is the frame's height.
 *
 * Only in a standalone app: in a browser tab the space below the viewport is
 * the browser's own chrome, and reaching into it would put the navigation bar
 * underneath the toolbar.
 */
export const frameHeight = ({
  standalone,
  innerHeight,
  screenHeight,
}: {
  standalone: boolean;
  innerHeight: number;
  screenHeight: number;
}): number => {
  const extra = screenHeight - innerHeight;
  // A sane margin: a status bar and a home indicator, not a rotated screen or a
  // stale measurement.
  if (!standalone || extra <= 0 || extra > 200) return innerHeight;
  return screenHeight;
};

/**
 * The bar's own bottom padding, keeping its labels clear of the home indicator
 * when the frame reaches past the box iOS laid out against. The safe-area inset
 * is the right answer whenever iOS gives one; this is the fallback for when it
 * reports nothing and the frame is reaching down regardless.
 */
export const HOME_INDICATOR = 34;

export const frameBottomPadding = (extra: number): number =>
  extra <= 0 ? 0 : Math.min(extra, HOME_INDICATOR);

const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches ||
  // iOS's own flag, which predates the media query and is still what a Home
  // Screen app reports on older versions.
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Measures the display and writes the frame's dimensions onto the document. */
export const applyFrame = (): void => {
  const innerHeight = window.innerHeight;
  const screenHeight = window.screen.height;
  const height = frameHeight({ standalone: isStandalone(), innerHeight, screenHeight });
  const root = document.documentElement;
  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--frame-bottom', `${frameBottomPadding(height - innerHeight)}px`);
};

/** Keeps it right through rotation and any late settling of the viewport. */
export const watchFrame = (): (() => void) => {
  applyFrame();
  const update = () => applyFrame();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.visualViewport?.addEventListener('resize', update);
  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
    window.visualViewport?.removeEventListener('resize', update);
  };
};
