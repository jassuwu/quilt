import { describe, expect, test } from "bun:test";
import { mergeContributions } from "../src/lib/merge";
import type { AccountContributions } from "../src/lib/types";

const day = (date: string, count: number) => ({ date, count, level: 0 as const });

describe("mergeContributions", () => {
  test("sums counts per date across accounts", () => {
    const a: AccountContributions = { username: "a", days: [day("2026-01-01", 2), day("2026-01-02", 0)] };
    const b: AccountContributions = { username: "b", days: [day("2026-01-01", 3), day("2026-01-02", 5)] };
    const quilt = mergeContributions([a, b]);
    expect(quilt.days).toHaveLength(2);
    expect(quilt.days[0]).toMatchObject({ date: "2026-01-01", count: 5 });
    expect(quilt.days[1]).toMatchObject({ date: "2026-01-02", count: 5 });
    expect(quilt.total).toBe(10);
    expect(quilt.maxCount).toBe(5);
    expect(quilt.usernames).toEqual(["a", "b"]);
  });

  test("unions and sorts dates from different accounts", () => {
    const a: AccountContributions = { username: "a", days: [day("2026-01-03", 1)] };
    const b: AccountContributions = { username: "b", days: [day("2026-01-01", 1)] };
    const quilt = mergeContributions([a, b]);
    expect(quilt.days.map((d) => d.date)).toEqual(["2026-01-01", "2026-01-03"]);
    expect(quilt.from).toBe("2026-01-01");
    expect(quilt.to).toBe("2026-01-03");
  });

  test("computes longest and current streaks", () => {
    const a: AccountContributions = {
      username: "a",
      days: [day("2026-01-01", 1), day("2026-01-02", 0), day("2026-01-03", 2), day("2026-01-04", 1)],
    };
    const quilt = mergeContributions([a]);
    expect(quilt.longestStreak).toBe(2);
    expect(quilt.currentStreak).toBe(2);
  });

  test("handles empty input without crashing", () => {
    const quilt = mergeContributions([]);
    expect(quilt.days).toHaveLength(0);
    expect(quilt.total).toBe(0);
    expect(quilt.maxCount).toBe(0);
    expect(quilt.from).toBe("");
  });
});
