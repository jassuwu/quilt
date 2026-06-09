/** Intensity bucket for a day, 0 (none) to 4 (most). */
export type Level = 0 | 1 | 2 | 3 | 4;

/** A single day in a GitHub contribution calendar. */
export interface ContributionDay {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Contributions on this day (public + privatized-but-visible). */
  count: number;
  /** Intensity bucket. */
  level: Level;
}

/** Shape returned by the jogruber github-contributions-api (v4). */
export interface ContributionsApiResponse {
  total: Record<string, number>;
  contributions: ContributionDay[];
}

/** One account's fetched calendar, ready to merge. */
export interface AccountContributions {
  username: string;
  days: ContributionDay[];
}

/** The merged result — many accounts stitched into one quilt. */
export interface Quilt {
  /** Accounts stitched together, in input order. */
  usernames: string[];
  /** Merged days, ascending by date. */
  days: ContributionDay[];
  /** Sum of all contributions across every account. */
  total: number;
  /** Busiest single day. */
  maxCount: number;
  /** Longest run of consecutive active days. */
  longestStreak: number;
  /** Trailing run of consecutive active days. */
  currentStreak: number;
  /** First date present, or "" when empty. */
  from: string;
  /** Last date present, or "" when empty. */
  to: string;
}
