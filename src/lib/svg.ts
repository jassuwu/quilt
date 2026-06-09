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
  /** Wrap in a themed, padded card with an inline font — for <img>/README embeds. */
  embed?: boolean;
}

/**
 * Render a merged quilt as a self-contained SVG string (no DOM).
 *
 * - On the page (`embed: false`): responsive (`max-width:100%`) so the full
 *   year fits with no horizontal scroll; inherits the page font + dark theme.
 * - As an embed (`embed: true`): a padded, themed card with an inline font and
 *   its own background, so it renders correctly inside an `<img>` on any site.
 */
export function renderQuiltSvg(
  quilt: Quilt,
  options: RenderOptions = {},
): string {
  if (!quilt.days.length) return "";
  const { theme = "dark", embed = false } = options;
  const palette = PALETTES[theme];

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
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${palette.levels[day.level]}"><title>${day.count} ${noun} on ${day.date}</title></rect>`;
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
        `<text x="${LEFT + col * STEP}" y="${TOP - 6}" fill="${palette.muted}" font-size="10">${MONTHS[m]}</text>`,
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
      ([row, label]) =>
        `<text x="0" y="${TOP + (row as number) * STEP + 9}" fill="${palette.muted}" font-size="10">${label}</text>`,
    )
    .join("");

  const label = `Merged contribution graph for ${quilt.usernames.join(", ")}`;
  const inner = `${months.join("")}${weekdays}${cells}`;

  if (embed) {
    const pad = 16;
    const w = width + pad * 2;
    const h = height + pad * 2;
    const font = "ui-sans-serif,-apple-system,'Segoe UI',Roboto,sans-serif";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" style="font-family:${font}"><rect width="${w}" height="${h}" rx="10" fill="${palette.bg}"/><g transform="translate(${pad},${pad})">${inner}</g></svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" style="max-width:100%;height:auto;display:block;font-family:var(--font-sans,ui-sans-serif)">${inner}</svg>`;
}
