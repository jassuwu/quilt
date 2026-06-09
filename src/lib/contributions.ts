import type {
  AccountContributions,
  ContributionDay,
  ContributionsApiResponse,
} from "./types";

const API_BASE = "https://github-contributions-api.jogruber.de/v4";

/** GitHub username rules: 1–39 chars, alphanumeric with single inner hyphens. */
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.trim());
}

export class ContributionsError extends Error {
  constructor(
    message: string,
    readonly username: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ContributionsError";
  }
}

export interface FetchOptions {
  /** Year to fetch; "last" = trailing 12 months (default). */
  year?: number | "last";
  signal?: AbortSignal;
  /** Retries on transient failures (default 3). */
  retries?: number;
  /** Injectable fetch, for tests. */
  fetchImpl?: typeof fetch;
}

const sessionCache = new Map<string, ContributionDay[]>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // A missing user will never succeed — fail fast.
      if (error instanceof ContributionsError && error.status === 404)
        throw error;
      if (attempt === retries) break;
      await sleep(250 * 2 ** attempt);
    }
  }
  throw lastError;
}

/**
 * Fetch one account's contribution calendar from the jogruber API. No auth;
 * includes privatized-but-visible contributions exactly as the profile shows.
 * Results are memoized for the session.
 */
export async function fetchContributions(
  username: string,
  options: FetchOptions = {},
): Promise<AccountContributions> {
  const name = username.trim();
  if (!isValidUsername(name)) {
    throw new ContributionsError(
      `"${username}" isn't a valid GitHub username`,
      username,
    );
  }

  const year = options.year ?? "last";
  const cacheKey = `${name.toLowerCase()}:${year}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return { username: name, days: cached };

  const doFetch = options.fetchImpl ?? fetch;
  const url = `${API_BASE}/${encodeURIComponent(name)}?y=${year}`;

  const days = await withRetry(async () => {
    const res = await doFetch(url, {
      signal: options.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      throw new ContributionsError(
        `GitHub user "${name}" not found`,
        name,
        404,
      );
    }
    if (!res.ok) {
      throw new ContributionsError(
        `Couldn't load "${name}" (HTTP ${res.status})`,
        name,
        res.status,
      );
    }
    const json = (await res.json()) as ContributionsApiResponse;
    return json.contributions ?? [];
  }, options.retries ?? 3);

  sessionCache.set(cacheKey, days);
  return { username: name, days };
}

/** Clear the per-session cache (mainly for tests). */
export function clearCache(): void {
  sessionCache.clear();
}
