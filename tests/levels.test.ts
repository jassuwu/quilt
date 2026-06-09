import { describe, expect, test } from "bun:test";
import { type Thresholds, computeThresholds, hexForLevel, levelForCount } from "../src/lib/levels";

describe("hexForLevel", () => {
  test("maps each level to its green", () => {
    expect(hexForLevel(0)).toBe("#161b22");
    expect(hexForLevel(1)).toBe("#0e4429");
    expect(hexForLevel(2)).toBe("#006d32");
    expect(hexForLevel(3)).toBe("#26a641");
    expect(hexForLevel(4)).toBe("#39d353");
  });
});

describe("computeThresholds", () => {
  test("returns a default ramp when there are no active days", () => {
    expect(computeThresholds([0, 0, 0])).toEqual([1, 2, 3]);
  });

  test("is strictly increasing so every level is reachable", () => {
    const [t1, t2, t3] = computeThresholds([1, 1, 1, 1, 5]);
    expect(t1).toBeLessThan(t2);
    expect(t2).toBeLessThan(t3);
  });
});

describe("levelForCount", () => {
  const t: Thresholds = [2, 4, 6];

  test("zero or negative is level 0", () => {
    expect(levelForCount(0, t)).toBe(0);
    expect(levelForCount(-3, t)).toBe(0);
  });

  test("buckets by threshold", () => {
    expect(levelForCount(1, t)).toBe(1);
    expect(levelForCount(2, t)).toBe(1);
    expect(levelForCount(3, t)).toBe(2);
    expect(levelForCount(4, t)).toBe(2);
    expect(levelForCount(5, t)).toBe(3);
    expect(levelForCount(6, t)).toBe(3);
    expect(levelForCount(99, t)).toBe(4);
  });
});
