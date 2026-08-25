/**
 * How tall the app's frame is — the box the header, the scrolling middle and
 * the navigation bar are laid out in, and whose bottom edge the bar sits on.
 *
 * In a browser tab that is a plain CSS declaration, `100dvh`, and this file
 * does nothing: the dynamic viewport already means the visible area and it
 * shrinks and grows with the toolbars on its own. Two cases need more.
 *
 * The first is iOS before 15.4, which has no `dvh` at all: there the viewport
 * is measured instead.
 *
 * The second is a Home Screen app on iOS, which is the reason the bar has kept
 * coming to rest above the bottom of the screen. Such an app is painted over
 * the whole display — `viewport-fit=cover`, a translucent status bar — but it
 * is not always laid out against the whole of it: the box that `dvh`, a
 * percentage height and `position: fixed` all resolve against can end short by
 * the height of the status bar, and a screenshot of it shows a strip of page
 * below the bar exactly as tall as the inset at the top. It does not start out
 * that way, which is why the bug looked fixed and then came back: turning the
 * phone and turning it back is enough to bring it on.
 *
 * There is no browser chrome in a Home Screen app, so the visible area is the
 * screen, and the screen's height is known without asking the viewport at all:
 * it is the display's long side stood up, or its short side laid down. That is
 * what the frame takes there, and taking it has a second benefit — a value that
 * does not move while the phone turns. The half-dozen intermediate sizes iOS
 * reports mid-rotation never reach the layout, so the bar goes from one edge to
 * the other in one step rather than flickering between them.
 *
 * What is deliberately not done is guessing. The screen is only taken when the
 * shortfall is one the display itself explains — no larger than its own insets.
 * Anything else is a viewport still settling, or a platform whose `screen`
 * means something else (Android counts the system gesture bar in it), and the
 * frame is left as it was rather than reached under a bar it cannot see.
 *
 * Before settling for that, a display that comes up short is asked to think
 * again — the viewport meta tag is taken out and put straight back, which is
 * the recomputation a rotation would have forced. Where that works there is
 * nothing to reach past at all. Where it does not, the frame is reached down as
 * described above and the two are indistinguishable from the outside.
 *
 * How far the frame was reached down is published too, as --app-stretch, and
 * the bar keeps its labels that far up. Reaching the frame past the box iOS
 * laid the page out in is the whole point, but whether it will paint down there
 * is iOS's business rather than ours: the surface can be spared if it does not,
 * because styles.css has the display's own background carrying the bar's colour
 * to the bottom edge, and a clipped label could not be. So nothing that has to
 * be read is put anywhere that might be clipped away.
 */

/** The display, as far as sizing the frame is concerned. */
export interface Display {
  /** No browser chrome of any kind: the display is the viewport. */
  standalone: boolean;
  /** The screen's two sides, in either order. */
  screen: { width: number; height: number };
  /** The box the page is currently laid out against. */
  laidOut: { width: number; height: number };
  /** The display's own insets, top and bottom together. */
  insets: number;
}

/** What the frame should be sized by. */
export type Frame =
  /** Leave it to CSS: the dynamic viewport is the visible area here. */
  | { kind: 'viewport' }
  /**
   * A Home Screen app, whose visible area is the screen. `stretch` is how much
   * of that height lies past the box the page was laid out in.
   */
  | { kind: 'screen'; height: number; stretch: number }
  /** Nothing credible to say — a viewport mid-rotation. Keep what is there. */
  | { kind: 'unsettled' };

/**
 * How tall the frame should be, given what the display says about itself.
 *
 * Which way up the display is, is read from the viewport's own width rather
 * than from an orientation API. Nothing takes width off a Home Screen app, so
 * the width it is laid out to is one of the screen's two sides, and which one
 * says which way round the other is. That also means the reading checks itself:
 * a width matching neither side is a viewport still turning, or a window that
 * is not the whole display — an iPad sharing the screen with another app — and
 * either way not something to reach a bar down into.
 */
export const frameHeight = (display: Display): Frame => {
  if (!display.standalone) return { kind: 'viewport' };

  const tall = Math.max(display.screen.width, display.screen.height);
  const wide = Math.min(display.screen.width, display.screen.height);
  const laidOut = display.laidOut;
  const screenHeight =
    laidOut.width === wide ? tall : laidOut.width === tall ? wide : undefined;
  if (screenHeight === undefined) return { kind: 'unsettled' };

  const shortfall = screenHeight - laidOut.height;
  // Above zero the page is laid out short of the display, by the status bar it
  // is painted under. Below it, or by more than the display's own edges can
  // account for, and this is not that: it is a viewport mid-rotation, or a
  // platform that counts something else in `screen` — Android has the system
  // gesture bar in there — and the frame is better left where it is.
  if (shortfall < 0 || shortfall > display.insets) return { kind: 'unsettled' };

  return { kind: 'screen', height: screenHeight, stretch: shortfall };
};

/** Whether this browser needs a measured height rather than `100dvh`. */
export const needsMeasuredHeight = (): boolean =>
  typeof CSS === 'undefined' ||
  typeof CSS.supports !== 'function' ||
  !CSS.supports('height', '100dvh');

/**
 * What the display's insets and its dynamic viewport come to, which only the
 * browser can say: an inset cannot be read any other way, and `dvh` is a better
 * answer than `innerHeight` where it is supported. One hidden probe, laid out
 * and thrown away, answers both.
 *
 * The insets are read through the variables in styles.css rather than from
 * `env()` here, so that the app and this file always have the same idea of what
 * the display's edges are — and so that a test can stand a notched phone on its
 * side, which it can do to a variable and cannot do to `env()`.
 */
export const measureCss = (): { dvh: number; insetTop: number; insetBottom: number } => {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;top:0;left:0;width:0;visibility:hidden;height:100dvh;' +
    'padding-top:var(--safe-top, 0px);padding-bottom:var(--safe-bottom, 0px)';
  // Body first, so the probe inherits the same variables the app is using; the
  // root will do before the body exists, which is where the first call lands.
  (document.body ?? document.documentElement).append(probe);
  const style = getComputedStyle(probe);
  const measured = {
    dvh: probe.getBoundingClientRect().height,
    insetTop: Number.parseFloat(style.paddingTop) || 0,
    insetBottom: Number.parseFloat(style.paddingBottom) || 0,
  };
  probe.remove();
  return measured;
};

/** Whether this is an app on the Home Screen rather than a page in a browser. */
const isHomeScreenApp = (): boolean => {
  // Safari's own answer, and the only one that distinguishes a Home Screen app
  // from a Safari tab on iOS. Everywhere else the display mode does.
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (typeof ios === 'boolean') return ios;
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  );
};

/** Reads the display the frame is being sized for. */
export const readDisplay = (): Display => {
  const { insetTop, insetBottom } = measureCss();
  const root = document.documentElement;
  return {
    standalone: isHomeScreenApp(),
    screen: { width: window.screen.width, height: window.screen.height },
    // The root element's client box is the one percentages and viewport units
    // resolve against — the one whose height comes up short.
    laidOut: { width: root.clientWidth, height: root.clientHeight },
    insets: insetTop + insetBottom,
  };
};

/**
 * Writes the frame's height onto the document for the CSS to use, if it needs
 * one, and reports what it decided — so a caller can tell a display that is
 * being reached past from one that was the right size to begin with, without
 * measuring it all over again.
 */
export const applyFrame = (): Frame => {
  const root = document.documentElement;
  // Only what changes gets written: an identical rule rewritten on every resize
  // event is a style invalidation for nothing, and there are dozens of those
  // while a phone is turning.
  const write = (property: string, value: string | null) => {
    if (root.style.getPropertyValue(property) === (value ?? '')) return;
    if (value === null) root.style.removeProperty(property);
    else root.style.setProperty(property, value);
  };

  const frame = frameHeight(readDisplay());
  if (frame.kind === 'unsettled') return frame;
  if (frame.kind === 'screen') {
    write('--app-height', `${frame.height}px`);
    write('--app-stretch', `${frame.stretch}px`);
    return frame;
  }
  // A browser tab: `100dvh` is the answer, unless this browser has never heard
  // of it, in which case the viewport is measured as it was before.
  write('--app-height', needsMeasuredHeight() ? `${window.innerHeight}px` : null);
  write('--app-stretch', null);
  return frame;
};

/** How many times a launch will ask iOS to think again. */
const NUDGE_LIMIT = 2;
let nudges = 0;

/**
 * Asks the browser to work the viewport out again.
 *
 * A Home Screen app laid out short of the display puts itself right the moment
 * the phone is turned: the rotation makes Safari recompute the viewport from
 * scratch, and this time it takes the whole screen. Taking the viewport meta
 * tag out of the document and putting it straight back asks for the same
 * recomputation without turning anything, and if Safari obliges there is
 * nothing left to reach past — the page is laid out on the display itself, the
 * stretch is zero, and the bar sits on the bottom edge with only the home
 * indicator beneath it.
 *
 * Whether it obliges is Safari's business, so this is written to cost nothing
 * when it does not: the tag goes back in the same document position with the
 * same content, in the same task, so there is no frame in which the page has no
 * viewport to be laid out against; it is only tried where the display really is
 * short; and it is tried twice at most.
 */
const nudgeViewport = (): void => {
  const meta = document.querySelector('meta[name="viewport"]');
  const parent = meta?.parentNode;
  if (!meta || !parent) return;
  nudges += 1;
  const after = meta.nextSibling;
  parent.removeChild(meta);
  parent.insertBefore(meta, after);
};

/**
 * Keeps the frame current through rotation, a return from the background, and
 * any late settling of the viewport. iOS reports the new size in stages after a
 * rotation — and sometimes only reports the last of them once — so each event
 * is followed up on twice rather than trusted the first time.
 */
export const watchFrame = (): (() => void) => {
  let frame = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];

  // Applying is what has to happen on every event; nudging only follows an
  // answer that says the display is being reached past, which after a rotation
  // — or after a nudge that took — it no longer does.
  const apply = () => {
    const answer = applyFrame();
    if (answer.kind === 'screen' && answer.stretch > 0 && nudges < NUDGE_LIMIT) {
      nudgeViewport();
      requestAnimationFrame(() => void applyFrame());
    }
  };

  const settle = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
    timers.forEach(clearTimeout);
    timers = [setTimeout(apply, 120), setTimeout(apply, 400)];
  };

  apply();
  window.addEventListener('resize', settle);
  window.addEventListener('orientationchange', settle);
  window.addEventListener('pageshow', settle);
  document.addEventListener('visibilitychange', settle);
  window.screen?.orientation?.addEventListener('change', settle);

  return () => {
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener('resize', settle);
    window.removeEventListener('orientationchange', settle);
    window.removeEventListener('pageshow', settle);
    document.removeEventListener('visibilitychange', settle);
    window.screen?.orientation?.removeEventListener('change', settle);
  };
};
