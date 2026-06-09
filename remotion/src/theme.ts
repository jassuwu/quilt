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

// ---- named theme presets (mirrors ../../src/lib/levels.ts PRESETS and the
// ramp derivation in ../../src/lib/svg.ts rampFromColor) ----

const parseHex = (hex: string): [number, number, number] => {
  const h = hex.replace(/^#/, "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};
const toHex = (rgb: number[]): string =>
  `#${rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
const mix = (a: number[], b: number[], t: number): number[] =>
  [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);

type Ramp = readonly [string, string, string, string, string];

/** 5-step ramp (empty + levels 1–4) from a base color over its bg. */
function ramp(bg: string, color: string): Ramp {
  const c = parseHex(color);
  const b = parseHex(bg);
  const level0 = toHex(mix(b, [255, 255, 255], 0.07));
  return [
    level0,
    ...[0.4, 0.6, 0.8, 1].map((t) => toHex(mix(b, c, t))),
  ] as unknown as Ramp;
}

export interface DemoTheme {
  /** the `?theme=` param shown in the snippet — "" is the green default */
  name: string;
  bg: string;
  surface: string;
  color: string;
  levels: Ramp;
}

const preset = (name: string, bg: string, color: string): DemoTheme => ({
  name,
  bg,
  surface: toHex(mix(parseHex(bg), [255, 255, 255], 0.045)),
  color,
  levels: ramp(bg, color),
});

/** the theme beat: home green, then the named looks the embed really ships */
export const HOME_THEME: DemoTheme = {
  name: "",
  bg: COLORS.bg,
  surface: COLORS.surface,
  color: LEVEL_HEX[4],
  levels: [
    LEVEL_HEX[0],
    LEVEL_HEX[1],
    LEVEL_HEX[2],
    LEVEL_HEX[3],
    LEVEL_HEX[4],
  ],
};
export const DEMO_THEMES: DemoTheme[] = [
  preset("dracula", "#282a36", "#bd93f9"),
  preset("nord", "#2e3440", "#88c0d0"),
  preset("tokyonight", "#1a1b26", "#7aa2f7"),
];
