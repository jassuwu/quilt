import { describe, expect, test } from "bun:test";
import { parseUsernames } from "../src/lib/parse";

describe("parseUsernames", () => {
  test("splits on commas and whitespace", () => {
    expect(parseUsernames("jassuwu, torvalds")).toEqual([
      "jassuwu",
      "torvalds",
    ]);
    expect(parseUsernames("a b\nc")).toEqual(["a", "b", "c"]);
  });

  test("dedupes case-insensitively, keeping input order", () => {
    expect(parseUsernames("Jassuwu, jassuwu, torvalds")).toEqual([
      "Jassuwu",
      "torvalds",
    ]);
  });

  test("returns empty for blank input", () => {
    expect(parseUsernames("")).toEqual([]);
    expect(parseUsernames("  ,  ")).toEqual([]);
  });
});
