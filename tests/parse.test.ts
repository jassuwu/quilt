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

  test("accepts @handles and github.com profile URLs", () => {
    expect(parseUsernames("@jassuwu")).toEqual(["jassuwu"]);
    expect(parseUsernames("https://github.com/jassuwu")).toEqual(["jassuwu"]);
    expect(parseUsernames("github.com/jassuwu/")).toEqual(["jassuwu"]);
    expect(parseUsernames("https://github.com/jassuwu?tab=repositories")).toEqual(
      ["jassuwu"],
    );
    expect(parseUsernames("www.github.com/torvalds https://github.com/jassuwu")).toEqual(
      ["torvalds", "jassuwu"],
    );
  });

  test("normalized duplicates still dedupe", () => {
    expect(parseUsernames("@jassuwu, https://github.com/JASSUWU")).toEqual([
      "jassuwu",
    ]);
  });

  test("bare a/b tokens pass through to fail loudly, not silently truncate", () => {
    expect(parseUsernames("jassuwu/torvalds")).toEqual(["jassuwu/torvalds"]);
  });
});
