import type { DiaryEntry } from '../types.ts';
import { normalize } from './appellation.ts';
import { parseList } from './format.ts';

/** When a value was last used — the drinking date, or failing that when it was written. */
const lastUsed = (entry: DiaryEntry): string => entry.drunkOn || entry.createdAt || '';

interface Use {
  count: number;
  last: string;
}

interface Tally extends Use {
  /** Every spelling seen of this one value, so the usual one can be shown. */
  spellings: Map<string, Use>;
}

/**
 * Most used wins, most recent breaks the tie. Two spellings used exactly alike
 * is a coin toss, so the last word goes to the capitalised one — "Sunday roast"
 * rather than "sunday roast".
 */
const byUse = (a: [string, Use], b: [string, Use]) =>
  b[1].count - a[1].count ||
  b[1].last.localeCompare(a[1].last) ||
  a[0].localeCompare(b[0], undefined, { caseFirst: 'upper' });

/**
 * Distinct values out of the diary, likeliest first: what you use most often,
 * and among equals what you used most recently. Matching ignores case and
 * accents, and a value is shown with the spelling you use most, so one hurried
 * "cafe noir" does not rename Café Noir everywhere it appears.
 */
const rememberedValues = (
  diary: DiaryEntry[],
  pick: (entry: DiaryEntry) => string[],
): string[] => {
  const tallies = new Map<string, Tally>();

  for (const entry of diary) {
    const used = lastUsed(entry);
    // One entry counts once per value, however many times it names it.
    const seen = new Set<string>();
    for (const raw of pick(entry)) {
      const label = raw.trim();
      const key = normalize(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      let tally = tallies.get(key);
      if (!tally) {
        tally = { count: 0, last: used, spellings: new Map() };
        tallies.set(key, tally);
      }
      tally.count += 1;
      if (used > tally.last) tally.last = used;

      const spelling = tally.spellings.get(label);
      if (!spelling) tally.spellings.set(label, { count: 1, last: used });
      else {
        spelling.count += 1;
        if (used > spelling.last) spelling.last = used;
      }
    }
  }

  return [...tallies.entries()]
    .sort(byUse)
    .map(([, tally]) => [...tally.spellings.entries()].sort(byUse)[0][0]);
};

const atVenue = (diary: DiaryEntry[]) => diary.filter((entry) => entry.setting === 'venue');
const inPrivate = (diary: DiaryEntry[]) => diary.filter((entry) => entry.setting !== 'venue');

export const rememberedPlaces = (diary: DiaryEntry[]): string[] =>
  rememberedValues(inPrivate(diary), (entry) => [entry.place]);

export const rememberedVenues = (diary: DiaryEntry[]): string[] =>
  rememberedValues(atVenue(diary), (entry) => [entry.venue]);

export const rememberedCities = (diary: DiaryEntry[]): string[] =>
  rememberedValues(atVenue(diary), (entry) => [entry.city]);

export const rememberedVenueCountries = (diary: DiaryEntry[]): string[] =>
  rememberedValues(atVenue(diary), (entry) => [entry.venueCountry]);

/** Everyone you have ever drunk with, as individual names rather than as groups. */
export const rememberedCompanions = (diary: DiaryEntry[]): string[] =>
  rememberedValues(diary, (entry) => parseList(entry.companions));

/** Occasions are drawn from the whole diary: a birthday is one at home or out. */
export const rememberedOccasions = (diary: DiaryEntry[]): string[] =>
  rememberedValues(diary, (entry) => [entry.occasion]);

export type VenueLocation = Pick<DiaryEntry, 'venue' | 'city' | 'venueCountry'>;

/** Where a venue was the last time you drank there, if you have been before. */
export const venueLocation = (diary: DiaryEntry[], venue: string): VenueLocation | null => {
  const key = normalize(venue);
  if (!key) return null;

  let best: DiaryEntry | null = null;
  for (const entry of diary) {
    if (entry.setting !== 'venue' || normalize(entry.venue) !== key) continue;
    if (!best || lastUsed(entry) >= lastUsed(best)) best = entry;
  }
  if (!best) return null;
  return { venue: best.venue, city: best.city, venueCountry: best.venueCountry };
};

type LocationPatch = Partial<Pick<DiaryEntry, 'city' | 'venueCountry'>>;

/**
 * What a remembered venue can contribute. Only ever fills blanks — anything
 * already typed stays exactly as it is, the same rule the appellation autofill
 * follows.
 */
export const venuePatch = (
  details: Pick<DiaryEntry, 'city' | 'venueCountry'>,
  memory: VenueLocation,
): LocationPatch => {
  const patch: LocationPatch = {};
  if (!details.city.trim() && memory.city.trim()) patch.city = memory.city;
  if (!details.venueCountry.trim() && memory.venueCountry.trim()) {
    patch.venueCountry = memory.venueCountry;
  }
  return patch;
};

/** Human-readable summary of what a patch filled in, for the hint under the field. */
export const describeVenuePatch = (patch: LocationPatch): string => {
  const labels: string[] = [];
  if (patch.city) labels.push('city');
  if (patch.venueCountry) labels.push('country');
  if (labels.length === 0) return '';
  return `Filled ${labels.join(' and ')} from your last visit — edit if this one differs.`;
};

/**
 * Completions for the name being typed at the end of the "shared with" list.
 * Picking from a datalist replaces the whole field, so every option carries the
 * names already typed along with it. Anyone in the list already is left out.
 */
export const suggestCompanions = (input: string, roster: string[], limit = 8): string[] => {
  const cut = input.lastIndexOf(',');
  const prefix = cut === -1 ? '' : `${input.slice(0, cut + 1)} `;
  const typed = normalize(cut === -1 ? input : input.slice(cut + 1));
  const taken = new Set(
    (cut === -1 ? [] : parseList(input.slice(0, cut))).map((name) => normalize(name)),
  );

  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of roster) {
    const key = normalize(name);
    if (!key || taken.has(key)) continue;
    if (!typed || key.startsWith(typed)) starts.push(name);
    else if (key.includes(typed)) contains.push(name);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit).map((name) => `${prefix}${name}`);
};
