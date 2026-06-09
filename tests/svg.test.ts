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

  test("renders a responsive dark svg with one rect per day", () => {
    const svg = renderQuiltSvg(quilt);
    expect(svg).toContain("<svg");
    expect(svg).toContain("max-width:100%");
    expect(svg).toContain('viewBox="0 0');
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
    expect(svg).toContain("#39d353"); // dark level-4 green
    expect(svg).toContain("5 contributions on 2026-01-02");
  });

  test("uses the light ramp when theme is light", () => {
    const svg = renderQuiltSvg(quilt, { theme: "light" });
    expect(svg).toContain("#216e39"); // light level-4 green
    expect(svg).not.toContain("#39d353");
  });

  test("embed mode wraps in a themed, padded card", () => {
    const svg = renderQuiltSvg(quilt, { theme: "light", embed: true });
    expect(svg).toContain("#ffffff"); // light card background
    expect(svg).toContain("translate(16,16)");
    expect(svg).not.toContain("max-width:100%"); // fixed size for <img>
  });

  test("custom color ramps over the custom bg, not the stock canvas", () => {
    const svg = renderQuiltSvg(quilt, {
      embed: true,
      bg: "282a36",
      color: "bd93f9",
    });
    expect(svg).toContain("#282a36"); // card bg
    expect(svg).toContain("#bd93f9"); // level-4 = the base color itself
    expect(svg).not.toContain("#161b22"); // stock empty tone would read as holes
  });

  test("embed footer carries the quilt.jass.gg attribution", () => {
    const svg = renderQuiltSvg(quilt, { embed: true });
    expect(svg).toContain("quilt.jass.gg");
    expect(svg).toContain('href="https://quilt.jass.gg/?u=a,b"');
  });

  test("embed footer shows the merged streak when it fits", () => {
    // a year of active days → wide grid (roomy budget) + a real streak
    const days = Array.from({ length: 365 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 1 + i))
        .toISOString()
        .slice(0, 10);
      return { date, count: 1, level: 1 as const };
    });
    const yearQuilt: Quilt = {
      ...quilt,
      days,
      total: 365,
      longestStreak: 365,
      currentStreak: 365,
      from: days[0].date,
      to: days.at(-1)!.date,
    };
    const svg = renderQuiltSvg(yearQuilt, { embed: true });
    expect(svg).toContain("365-day streak");
  });
});
