import { useEffect, useRef, useState } from 'react';
import { useData } from '../lib/store';

/** How long the splash stays even when the cellar was ready immediately. */
const MINIMUM_MS = 450;
/** Matches the fade in styles.css. */
const FADE_MS = 250;

/**
 * The first thing the app shows: its mark and its name, held until the cellar
 * has been read out of IndexedDB. It is painted from the theme tokens, which
 * the bootstrap in index.html has already stamped, so a light-mode launch never
 * flashes black — and on iOS it continues the launch image rather than
 * replacing it with something else.
 */
export const Splash = () => {
  const { loading } = useData();
  const shownAt = useRef(Date.now());
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (loading) return;
    // A splash that flashes past reads as a glitch, and a warm start answers in
    // about twenty milliseconds — so it is held for a moment either way.
    const wait = Math.max(0, MINIMUM_MS - (Date.now() - shownAt.current));
    const fade = setTimeout(() => setLeaving(true), wait);
    const remove = setTimeout(() => setGone(true), wait + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [loading]);

  if (gone) return null;

  return (
    <div className={`splash${leaving ? ' splash-leaving' : ''}`} aria-hidden={leaving}>
      {/* The app mark, same geometry as the icon and the iOS launch image. */}
      <svg className="splash-mark" viewBox="0 0 512 512" role="img" aria-label="CellarBook">
        <path d="M138 132h236a118 118 0 0 1-118 187 118 118 0 0 1-118-187Z" fill="var(--text)" />
        <path d="M143.5 196h225a118 118 0 0 1-112.5 123A118 118 0 0 1 143.5 196Z" fill="var(--wine)" />
        <rect x="243" y="318" width="26" height="84" fill="var(--text)" />
        <ellipse cx="256" cy="412" rx="80" ry="19" fill="var(--text)" />
      </svg>
      <h1 className="splash-name">CellarBook</h1>
      <p className="splash-tagline">Cellar · diary · statistics</p>
    </div>
  );
};
