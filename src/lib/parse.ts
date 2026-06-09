/** Cap on accounts per quilt — every account is one fetch to the free API. */
export const MAX_ACCOUNTS = 10;

/**
 * People paste what they have — @handles, profile URLs, trailing junk.
 * Reduce a token to the bare username instead of erroring on it.
 */
function normalizeAccount(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?github\.com\//i, "")
    .split(/[/?#]/, 1)[0]
    .replace(/^@/, "");
}

/**
 * Parse a free-form usernames field: comma/space separated, deduped
 * case-insensitively, input order preserved.
 */
export function parseUsernames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const name = normalizeAccount(part);
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}
