/**
 * Takes the outermost JSON object out of a reply. Chat answers arrive wrapped
 * in code fences or a sentence of explanation, and neither is worth failing on.
 */
export const parseJsonLoosely = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object in the response');
    return JSON.parse(raw.slice(start, end + 1));
  }
};
