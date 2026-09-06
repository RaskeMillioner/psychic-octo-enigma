import type { DiaryEntry } from '../types';

/** The fields of a past entry that can seed an autocomplete list. */
export type DiaryPlaces = Pick<
  DiaryEntry,
  'place' | 'venue' | 'city' | 'venueCountry' | 'occasion' | 'companions'
>;

/** Trimmed, sorted, and deduplicated ignoring case — the first spelling wins. */
const unique = (values: string[]) => {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
};

/** The companions field is one comma-separated line; these are its names. */
export const splitCompanions = (value: string): string[] =>
  value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

/** Where and with whom past bottles were drunk, offered as autocomplete. */
export const diarySuggestions = (diary: DiaryPlaces[]) => ({
  places: unique(diary.map((entry) => entry.place)),
  venues: unique(diary.map((entry) => entry.venue)),
  cities: unique(diary.map((entry) => entry.city)),
  venueCountries: unique(diary.map((entry) => entry.venueCountry)),
  occasions: unique(diary.map((entry) => entry.occasion)),
  companions: unique(diary.flatMap((entry) => splitCompanions(entry.companions))),
});

/**
 * Completions for the comma-separated companions field. A datalist replaces the
 * whole input, so each known name is offered with the names already entered
 * kept in front of it — picking one appends rather than wipes the line. Names
 * already on the line are left out.
 */
export const companionCompletions = (value: string, names: string[]): string[] => {
  const entered = splitCompanions(value);
  // Without a trailing comma the last name is still being typed, so it is a
  // prefix to complete rather than a name already settled on.
  const settled = /,\s*$/.test(value) ? entered : entered.slice(0, -1);
  const taken = new Set(settled.map((name) => name.toLowerCase()));
  const prefix = settled.length ? `${settled.join(', ')}, ` : '';
  return names.filter((name) => !taken.has(name.toLowerCase())).map((name) => `${prefix}${name}`);
};
