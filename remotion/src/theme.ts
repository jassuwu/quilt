/**
 * quilt's green system — a standalone mirror of ../../src/styles/global.css @theme
 * and ../../src/lib/levels.ts. Kept local so the Remotion bundle carries no
 * cross-project import; keep the hexes in sync with the site.
 */
export type Level = 0 | 1 | 2 | 3 | 4;

export const LEVEL_HEX: Record<Level, string> = {
  0: "#161b22",
  1: "#0e4429",
  2: "#006d32",
  3: "#26a641",
  4: "#39d353",
};

export const hexForLevel = (level: Level): string => LEVEL_HEX[level];

export const COLORS = {
  bg: "#0d1117",
  surface: "#161b22",
  seam: "#21262d",
  text: "#e6edf3",
  muted: "#7d8590",
  stitch: "#e8a87c",
};
