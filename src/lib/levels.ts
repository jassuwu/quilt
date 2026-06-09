import type { Level } from "./types";

/**
 * Cell colors — the single source of truth for the green ramp.
 * Mirrored by the --color-level-* tokens in src/styles/global.css.
 */
export const LEVEL_HEX: Record<Level, string> = {
  0: "#161b22",
  1: "#0e4429",
  2: "#006d32",
  3: "#26a641",
  4: "#39d353",
};

export function hexForLevel(level: Level): string {
  return LEVEL_HEX[level];
}

export type Theme = "dark" | "light";

export interface Palette {
  /** Cell colours for levels 0–4. */
  levels: readonly [string, string, string, string, string];
  /** Card background (used by embeds). */
  bg: string;
  /** Label colour (months, weekdays). */
  muted: string;
}

/**
 * Theme palettes for the rendered SVG. Dark reuses the site ramp; light mirrors
 * GitHub's light contribution ramp — for embeds on light READMEs/sites.
 */
export const PALETTES: Record<Theme, Palette> = {
  dark: {
    levels: [
      LEVEL_HEX[0],
      LEVEL_HEX[1],
      LEVEL_HEX[2],
      LEVEL_HEX[3],
      LEVEL_HEX[4],
    ],
    bg: "#0d1117",
    muted: "#7d8590",
  },
  light: {
    levels: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
    bg: "#ffffff",
    muted: "#59636e",
  },
};

/** Upper bounds for levels 1, 2 and 3 (level 4 is everything above). */
export type Thresholds = [number, number, number];

/**
 * Derive level thresholds from a set of daily counts using quartiles of the
 * *active* days, so a merged quilt shades like a real GitHub graph rather than
 * a flat cutoff. Guarantees strictly increasing bounds so every level is
 * reachable.
 */
export function computeThresholds(counts: number[]): Thresholds {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (active.length === 0) return [1, 2, 3];
  const at = (p: number) =>
    active[
      Math.min(active.length - 1, Math.max(0, Math.ceil(p * active.length) - 1))
    ];
  let t1 = at(0.25);
  let t2 = at(0.5);
  let t3 = at(0.75);
  if (t2 <= t1) t2 = t1 + 1;
  if (t3 <= t2) t3 = t2 + 1;
  return [t1, t2, t3];
}

/** Bucket a single day's count into a 0–4 level given thresholds. */
export function levelForCount(count: number, [t1, t2, t3]: Thresholds): Level {
  if (count <= 0) return 0;
  if (count <= t1) return 1;
  if (count <= t2) return 2;
  if (count <= t3) return 3;
  return 4;
}
