/** quilt's green system — mirror of src/styles/global.css @theme. */
export const C = {
  bg: "#0d1117",
  l1: "#0e4429",
  l2: "#006d32",
  l3: "#26a641",
  l4: "#39d353",
  stitch: "#e8a87c",
} as const;

const LEVELS = [C.l1, C.l2, C.l3, C.l4];

// 4×4 patch — the brightest greens trace a rising anti-diagonal (an up-tick),
// fading to the dim corners.
const GRID = [
  [0, 1, 2, 3],
  [1, 2, 3, 2],
  [2, 3, 2, 1],
  [3, 2, 1, 0],
];

const VIEW = 64;
const r = (n: number) => Number(n.toFixed(2));

/** The quilt block: green patches + one warm running-stitch seam down the centre. */
function patch(pad: number): string {
  const area = VIEW - pad * 2;
  const gap = area / 13;
  const cell = (area - 3 * gap) / 4;
  const step = cell + gap;

  let cells = "";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = pad + col * step;
      const y = pad + row * step;
      cells += `<rect x="${r(x)}" y="${r(y)}" width="${r(cell)}" height="${r(cell)}" rx="${r(cell * 0.24)}" fill="${LEVELS[GRID[row][col]]}"/>`;
    }
  }

  // running-stitch seam in the centre channel — two patches, stitched into one
  const seamX = pad + step + cell + gap / 2;
  const seam = `<line x1="${r(seamX)}" y1="${r(pad)}" x2="${r(seamX)}" y2="${r(pad + area)}" stroke="${C.stitch}" stroke-width="${r(cell * 0.16)}" stroke-linecap="round" stroke-dasharray="${r(cell * 0.42)} ${r(cell * 0.5)}"/>`;

  return cells + seam;
}

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}">${body}</svg>`;
}

/** Rounded dark tile — the browser-tab favicon. */
export function faviconSvg(): string {
  return svg(
    `<rect width="${VIEW}" height="${VIEW}" rx="14" fill="${C.bg}"/>${patch(9)}`,
  );
}

/** Full-bleed square — apple-touch + standard PWA icons (the OS rounds it). */
export function solidSvg(): string {
  return svg(
    `<rect width="${VIEW}" height="${VIEW}" fill="${C.bg}"/>${patch(11)}`,
  );
}

/** Full-bleed with a generous safe zone for Android maskable icons. */
export function maskableSvg(): string {
  return svg(
    `<rect width="${VIEW}" height="${VIEW}" fill="${C.bg}"/>${patch(15)}`,
  );
}
