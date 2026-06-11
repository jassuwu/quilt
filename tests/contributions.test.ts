import { describe, expect, setSystemTime, test } from "bun:test";
import {
  ContributionsError,
  clearCache,
  fetchContributions,
  isValidUsername,
} from "../src/lib/contributions";

describe("isValidUsername", () => {
  test("accepts valid handles", () => {
    expect(isValidUsername("jassuwu")).toBe(true);
    expect(isValidUsername("jass-ucyd")).toBe(true);
    expect(isValidUsername("a")).toBe(true);
  });

  test("rejects invalid handles", () => {
    expect(isValidUsername("-nope")).toBe(false);
    expect(isValidUsername("no--double")).toBe(false);
    expect(isValidUsername("waaaaytoolong-".repeat(4))).toBe(false);
    expect(isValidUsername("bad name")).toBe(false);
  });
});

describe("fetchContributions", () => {
  test("parses the API response and caches it", async () => {
    clearCache();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          total: { lastYear: 3 },
          contributions: [{ date: "2026-01-01", count: 3, level: 2 }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const first = await fetchContributions("octocat", { fetchImpl });
    expect(first.days).toHaveLength(1);
    expect(first.days[0].count).toBe(3);

    // second call is served from cache (fetchImpl not invoked again)
    await fetchContributions("octocat", { fetchImpl });
    expect(calls).toBe(1);
  });

  test("throws a friendly error for unknown users", async () => {
    clearCache();
    const fetchImpl = (async () =>
      new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(
      fetchContributions("definitely-not-real-xyz", { fetchImpl, retries: 0 }),
    ).rejects.toBeInstanceOf(ContributionsError);
  });

  test("rejects invalid usernames before fetching", async () => {
    await expect(fetchContributions("bad name")).rejects.toBeInstanceOf(
      ContributionsError,
    );
  });

  test("expires cached calendars after the TTL", async () => {
    clearCache();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ total: {}, contributions: [] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    try {
      setSystemTime(new Date("2026-06-09T12:00:00Z"));
      await fetchContributions("octocat", { fetchImpl });
      await fetchContributions("octocat", { fetchImpl });
      expect(calls).toBe(1);

      setSystemTime(new Date("2026-06-09T12:31:00Z"));
      await fetchContributions("octocat", { fetchImpl });
      expect(calls).toBe(2);
    } finally {
      setSystemTime();
    }
  });

  test("fails fast on abort/timeout instead of a dead retry", async () => {
    clearCache();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    await expect(
      fetchContributions("octocat", { fetchImpl, retries: 3 }),
    ).rejects.toBeInstanceOf(DOMException);
    expect(calls).toBe(1);
  });

  test("fails fast on 4xx instead of retrying", async () => {
    clearCache();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("", { status: 429 });
    }) as unknown as typeof fetch;
    await expect(
      fetchContributions("octocat", { fetchImpl, retries: 3 }),
    ).rejects.toBeInstanceOf(ContributionsError);
    expect(calls).toBe(1);
  });
});
