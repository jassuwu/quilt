// A tiny 5×7 pixel font (I is 3 wide, space is 2) — enough to spell the verdict.
// "1" = lit cell. Rows are the 7 days of the week; columns are weeks.
const GLYPHS: Record<string, string[]> = {
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  F: ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
  E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
  " ": ["00", "00", "00", "00", "00", "00", "00"],
};

export const ROWS = 7;

/**
 * The lit `"row,col"` cells needed to spell `word` (5×7 pixels per glyph),
 * centered horizontally in a `cols`-wide, 7-row contribution grid.
 */
export function wordCells(word: string, cols: number): Set<string> {
  const glyphs = [...word.toUpperCase()].map((ch) => GLYPHS[ch] ?? GLYPHS[" "]);
  const widths = glyphs.map((g) => g[0].length);
  const total = widths.reduce((a, b) => a + b, 0) + (glyphs.length - 1);
  const start = Math.max(0, Math.floor((cols - total) / 2));

  const lit = new Set<string>();
  let c = start;
  for (let gi = 0; gi < glyphs.length; gi++) {
    for (let r = 0; r < ROWS; r++) {
      for (let x = 0; x < widths[gi]; x++) {
        if (glyphs[gi][r][x] === "1") lit.add(`${r},${c + x}`);
      }
    }
    c += widths[gi] + 1;
  }
  return lit;
}
