import type { AccountContributions, ContributionDay, Quilt } from "./types";
import { computeThresholds, levelForCount } from "./levels";

function computeStreaks(days: ContributionDay[]): { longest: number; current: number } {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.count > 0) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current += 1;
    else break;
  }
  return { longest, current };
}

/**
 * Stitch several accounts' calendars into one quilt: sum each day's count
 * across accounts, then recompute the 0–4 level from the merged distribution.
 */
export function mergeContributions(sources: AccountContributions[]): Quilt {
  const byDate = new Map<string, number>();
  for (const source of sources) {
    for (const day of source.days) {
      byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.count);
    }
  }

  const dates = [...byDate.keys()].sort();
  const counts = dates.map((date) => byDate.get(date) as number);
  const thresholds = computeThresholds(counts);

  const days: ContributionDay[] = dates.map((date) => {
    const count = byDate.get(date) as number;
    return { date, count, level: levelForCount(count, thresholds) };
  });

  const total = counts.reduce((sum, c) => sum + c, 0);
  const maxCount = counts.reduce((max, c) => (c > max ? c : max), 0);
  const { longest, current } = computeStreaks(days);

  return {
    usernames: sources.map((s) => s.username),
    days,
    total,
    maxCount,
    longestStreak: longest,
    currentStreak: current,
    from: dates[0] ?? "",
    to: dates.at(-1) ?? "",
  };
}
