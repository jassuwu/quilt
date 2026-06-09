import { describe, expect, test } from "bun:test";
import { renderQuiltSvg } from "../src/lib/svg";
import type { Quilt } from "../src/lib/types";

const quilt: Quilt = {
  usernames: ["a", "b"],
  days: [
    { date: "2026-01-01", count: 0, level: 0 },
    { date: "2026-01-02", count: 5, level: 4 },
  ],
  total: 5,
  maxCount: 5,
  longestStreak: 1,
  currentStreak: 0,
  from: "2026-01-01",
  to: "2026-01-02",
};

describe("renderQuiltSvg", () => {
  test("returns an empty string for an empty quilt", () => {
    expect(renderQuiltSvg({ ...quilt, days: [], from: "", to: "" })).toBe("");
  });

  test("renders a responsive svg with one rect per day", () => {
    const svg = renderQuiltSvg(quilt);
    expect(svg).toContain("<svg");
    expect(svg).toContain("max-width:100%");
    expect(svg).toContain('viewBox="0 0');
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
    expect(svg).toContain("#39d353"); // level-4 green
    expect(svg).toContain("5 contributions on 2026-01-02");
  });
});
