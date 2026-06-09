import { PALETTES, type Theme } from "./levels";
import type { Quilt } from "./types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const CELL = 11;
const STEP = 14; // cell + gap
const TOP = 18; // room for month labels
const LEFT = 26; // room for weekday labels

const utcDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export interface RenderOptions {
  theme?: Theme;
  /** Override the card background (hex). */
  bg?: string;
  /** Base color for the ramp (hex); levels 1–4 are derived from it. */
  color?: string;
  /** Wrap in a themed, padded card with an inline font — for <img>/README embeds. */
  embed?: boolean;
}

/** Validate a 3- or 6-digit hex color (with or without leading #). */
export function isHexColor(s: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
}

/** Escape a string for use in SVG text content and attribute values. */
function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const withHash = (s: string): string => (s.startsWith("#") ? s : `#${s}`);

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, "");
  const s =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

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

/** Derive a 5-step ramp (empty + levels 1–4) from a base color, over the theme bg. */
function rampFromColor(color: string, theme: Theme): readonly string[] {
  const c = parseHex(color);
  const bg = parseHex(PALETTES[theme].bg);
  if (!c || !bg) return PALETTES[theme].levels;
  return [
    PALETTES[theme].levels[0],
    ...[0.4, 0.6, 0.8, 1].map((t) => toHex(mix(bg, c, t))),
  ];
}

function resolvePalette(options: RenderOptions) {
  const theme = options.theme ?? "dark";
  const base = PALETTES[theme];
  return {
    bg: options.bg && isHexColor(options.bg) ? withHash(options.bg) : base.bg,
    levels:
      options.color && isHexColor(options.color)
        ? rampFromColor(options.color, theme)
        : base.levels,
    muted: base.muted,
  };
}

/**
 * Render a merged quilt as a self-contained SVG string (no DOM).
 *
 * - On the page (`embed: false`): responsive so the full year fits, no scroll.
 * - As an embed (`embed: true`): a padded card with its own background, inline
 *   font, a less→more legend, and accounts linked to their GitHub profiles —
 *   renders correctly inside an `<img>` on any site. `bg`/`color` customize it.
 */
export function renderQuiltSvg(
  quilt: Quilt,
  options: RenderOptions = {},
): string {
  if (!quilt.days.length) return "";
  const { embed = false } = options;
  const { bg, levels, muted } = resolvePalette(options);

  const first = utcDate(quilt.from);
  const firstSunday = new Date(first);
  firstSunday.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const colOf = (d: Date) =>
    Math.floor((d.getTime() - firstSunday.getTime()) / (7 * 86_400_000));
  const numCols = colOf(utcDate(quilt.to)) + 1;
  const width = LEFT + numCols * STEP;
  const height = TOP + 7 * STEP;

  const cells = quilt.days
    .map((day) => {
      const d = utcDate(day.date);
      const x = LEFT + colOf(d) * STEP;
      const y = TOP + d.getUTCDay() * STEP;
      const noun = day.count === 1 ? "contribution" : "contributions";
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${levels[day.level]}"><title>${day.count} ${noun} on ${day.date}</title></rect>`;
    })
    .join("");

  const months: string[] = [];
  let prevMonth = -1;
  for (let col = 0; col < numCols; col++) {
    const weekStart = new Date(firstSunday);
    weekStart.setUTCDate(firstSunday.getUTCDate() + col * 7);
    const m = weekStart.getUTCMonth();
    if (m !== prevMonth) {
      months.push(
        `<text x="${LEFT + col * STEP}" y="${TOP - 6}" fill="${muted}" font-size="10">${MONTHS[m]}</text>`,
      );
      prevMonth = m;
    }
  }

  const weekdays = [
    [1, "Mon"],
    [3, "Wed"],
    [5, "Fri"],
  ]
    .map(
      ([row, lbl]) =>
        `<text x="0" y="${TOP + (row as number) * STEP + 9}" fill="${muted}" font-size="10">${lbl}</text>`,
    )
    .join("");

  const label = `merged contribution quilt for ${quilt.usernames.join(", ")}`;
  const inner = `${months.join("")}${weekdays}${cells}`;

  if (embed) {
    const pad = 16;
    const footerH = 24;
    const w = width + pad * 2;
    const h = height + footerH + pad * 2;
    const font = "ui-sans-serif,-apple-system,'Segoe UI',Roboto,sans-serif";

    // footer: linked accounts + total + attribution on the left, a less→more
    // legend on the right
    const fy = height + 16;
    const legendX = Math.max(0, width - 128);
    const links = quilt.usernames
      .map(
        (u) =>
          `<a href="https://github.com/${u}" target="_blank"><tspan text-decoration="underline">${u}</tspan></a>`,
      )
      .join("<tspan> + </tspan>");

    // keep the left summary out of the legend's lane: optional parts only
    // render while the ~6px/char estimate stays inside the budget.
    const CHAR_W = 6;
    const budget = legendX - 12;
    const domainText = " · quilt.jass.gg";
    let textLen = quilt.usernames.join(" + ").length + domainText.length;
    let extras = "";
    // the merged cross-account streak is the one number no per-account tool
    // can show — surface it when it means something and fits.
    for (const part of [
      ` · ${quilt.total.toLocaleString("en-US")} contributions`,
      ...(quilt.longestStreak > 1
        ? [` · ${quilt.longestStreak}-day streak`]
        : []),
    ]) {
      if ((textLen + part.length) * CHAR_W > budget) break;
      extras += `<tspan>${part}</tspan>`;
      textLen += part.length;
    }

    // the attribution is the only path from a README back to the product —
    // camo strips the link, but the visible domain is the point.
    const domain = `<a href="https://quilt.jass.gg/?u=${quilt.usernames.join(",")}"><tspan>${domainText}</tspan></a>`;
    const summary = `<text x="0" y="${fy + 9}" font-size="11" fill="${muted}">${links}${extras}${domain}</text>`;
    let legend = `<text x="${legendX}" y="${fy + 9}" font-size="11" fill="${muted}">less</text>`;
    for (let i = 0; i < 5; i++) {
      legend += `<rect x="${legendX + 30 + i * 13}" y="${fy}" width="10" height="10" rx="2" fill="${levels[i]}"/>`;
    }
    legend += `<text x="${legendX + 99}" y="${fy + 9}" font-size="11" fill="${muted}">more</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" style="font-family:${font}"><rect width="${w}" height="${h}" rx="10" fill="${bg}"/><g transform="translate(${pad},${pad})">${inner}${summary}${legend}</g></svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" style="max-width:100%;height:auto;display:block;font-family:var(--font-sans,ui-sans-serif)">${inner}</svg>`;
}

/** A small self-contained card for empty/error states (renders inside an `<img>`). */
export function placeholderSvg(message: string, theme: Theme = "dark"): string {
  const p = PALETTES[theme];
  const w = 480;
  const h = 96;
  const font = "ui-sans-serif,-apple-system,'Segoe UI',Roboto,sans-serif";
  const msg = escapeXml(message);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${msg}" style="font-family:${font}"><rect width="${w}" height="${h}" rx="10" fill="${p.bg}"/><text x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle" font-size="16" fill="${p.muted}">${msg}</text></svg>`;
}
