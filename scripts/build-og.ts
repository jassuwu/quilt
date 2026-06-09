import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { C } from "./art";

const W = 1200;
const H = 630;
const RAMP = ["#161b22", C.l1, C.l2, C.l3, C.l4];

/** Seeded PRNG so the sample card is byte-stable across regenerations. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleLevel(rng: () => number): number {
  const r = rng();
  if (r < 0.08) return 0;
  if (r < 0.22) return 1;
  if (r < 0.46) return 2;
  if (r < 0.72) return 3;
  return 4; // biased lush — this is the merged, busy graph
}

const panelX = 72;
const panelY = 224;
const panelW = 1056;
const panelH = 300;
const pad = 28;
const cols = 52;
const rows = 7;
const step = (panelW - pad * 2) / cols;
const cell = Number((step - 4).toFixed(2));
const gridX = panelX + pad;
const gridY = panelY + (panelH - rows * step) / 2;

function sampleGrid(): string {
  const rng = mulberry32(42);
  let out = "";
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      out += `<rect x="${(gridX + c * step).toFixed(1)}" y="${(gridY + r * step).toFixed(1)}" width="${cell}" height="${cell}" rx="3" fill="${RAMP[sampleLevel(rng)]}"/>`;
    }
  }
  return out;
}

const font = `font-family="Helvetica, Arial, sans-serif"`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <text x="72" y="130" ${font} font-size="88" font-weight="700" fill="#e6edf3">quilt<tspan fill="${C.stitch}">.</tspan></text>
  <text x="76" y="178" ${font} font-size="30" fill="#7d8590">every GitHub account, stitched into one green graph.</text>
  <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="20" fill="#161b22" stroke="#21262d"/>
  ${sampleGrid()}
  <text x="72" y="574" ${font} font-size="28" fill="#e6edf3">12,431 contributions · 4 accounts · 318-day streak</text>
  <text x="1128" y="574" ${font} text-anchor="end" font-size="28" font-weight="600" fill="${C.stitch}">quilt.jass.gg</text>
</svg>`;

const outDir = fileURLToPath(new URL("../public/og/", import.meta.url));
await mkdir(outDir, { recursive: true });
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" },
});
await writeFile(join(outDir, "default.png"), Buffer.from(resvg.render().asPng()));
console.log("✓ public/og/default.png");
