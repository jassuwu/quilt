import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FILL_END, FILL_START, GATHER_END, GATHER_START } from "./choreography";
import { COLORS, hexForLevel, type Level } from "./theme";

const { fontFamily: DISPLAY } = loadDisplay("normal", { weights: ["800"], subsets: ["latin"] });
const { fontFamily: MONO } = loadMono("normal", { weights: ["400", "600"], subsets: ["latin"] });

const COLS = 52;
const ROWS = 7;
const CELL = 24;
const GAP = 7;
const STEP = CELL + GAP;
const GRID_W = COLS * STEP - GAP;
const GRID_H = ROWS * STEP - GAP;
const CELL_COUNT = COLS * ROWS;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genAccount(seed: number, density: number): number[][] {
  const rng = mulberry32(seed);
  const grid: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) row.push(rng() < density ? 1 + Math.floor(rng() * 3) : 0);
    grid.push(row);
  }
  return grid;
}

const ACCOUNTS = [
  { label: "@your-main", data: genAccount(7, 0.16) },
  { label: "@your-work", data: genAccount(23, 0.2) },
  { label: "@your-side", data: genAccount(91, 0.13) },
];

const MERGED: number[][] = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => ACCOUNTS.reduce((sum, a) => sum + a.data[r][c], 0)),
);
const TOTAL = MERGED.flat().reduce((sum, n) => sum + n, 0);

const ownLevel = (n: number): Level => (n <= 0 ? 0 : Math.min(4, n)) as Level;
const mergedLevelOf = (n: number): Level => {
  if (n <= 0) return 0;
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 4) return 3;
  return 4;
};

const FAN = [
  { x: -360, y: -70, rot: -7 },
  { x: 30, y: 60, rot: 5 },
  { x: 360, y: -30, rot: 9 },
];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Grid: React.FC<{
  cellOf: (r: number, c: number) => { color: string; scale?: number; opacity?: number };
}> = ({ cellOf }) => {
  const cells = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const { color, scale = 1, opacity = 1 } = cellOf(r, c);
      cells.push(
        <div
          key={c * ROWS + r}
          style={{ width: CELL, height: CELL, borderRadius: 4, background: color, transform: `scale(${scale})`, opacity }}
        />,
      );
    }
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
        gridAutoFlow: "column",
        columnGap: GAP,
        rowGap: GAP,
        width: GRID_W,
        height: GRID_H,
      }}
    >
      {cells}
    </div>
  );
};

const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontFamily: MONO, fontSize: 54, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 22, color: COLORS.muted }}>{label}</div>
  </div>
);

export const QuiltMerge: React.FC<{ showCta?: boolean }> = ({ showCta = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);

  const gatherT = interpolate(frame, [GATHER_START, GATHER_END], [0, 1], clamp);
  const mergedAppear = interpolate(frame, [GATHER_END - 10, GATHER_END + 8], [0, 1], clamp);
  const fillProgress = interpolate(frame, [FILL_START, FILL_END], [0, 1], clamp);
  const counter = Math.round(TOTAL * ease(fillProgress));
  const wm = spring({ frame: frame - (FILL_END - 12), fps, config: { damping: 200 } });
  const cta = interpolate(frame, [FILL_END + 40, FILL_END + 70], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: DISPLAY }}>
      <div
        style={{
          position: "absolute",
          top: 196,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 72,
          opacity: mergedAppear,
        }}
      >
        <Stat value={counter.toLocaleString("en-US")} label="contributions" />
        <Stat value={String(ACCOUNTS.length)} label="accounts" />
      </div>

      <div style={{ position: "absolute", top: 332, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: GRID_W, height: GRID_H }}>
          {ACCOUNTS.map((acc, i) => {
            const appear = interpolate(frame, [i * 7, i * 7 + 20], [0, 1], clamp);
            const fadeOut = interpolate(frame, [GATHER_END - 16, GATHER_END], [1, 0], clamp);
            const x = FAN[i].x * (1 - gatherT);
            const y = FAN[i].y * (1 - gatherT) + (1 - appear) * 60;
            const rot = FAN[i].rot * (1 - gatherT);
            const scale = interpolate(appear, [0, 1], [0.86, 1]);
            return (
              <div
                key={acc.label}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: appear * fadeOut,
                  transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
                  transformOrigin: "center",
                }}
              >
                <div
                  style={{ position: "absolute", inset: -18, borderRadius: 18, background: COLORS.surface, border: `1px solid ${COLORS.seam}` }}
                />
                <div style={{ position: "absolute", top: -46, left: 0, fontFamily: MONO, fontSize: 22, color: COLORS.muted }}>
                  {acc.label}
                </div>
                <Grid cellOf={(r, c) => ({ color: hexForLevel(ownLevel(acc.data[r][c])) })} />
              </div>
            );
          })}

          <div style={{ position: "absolute", inset: 0, opacity: mergedAppear }}>
            <Grid cellOf={() => ({ color: COLORS.surface })} />
          </div>
          <div style={{ position: "absolute", inset: 0 }}>
            <Grid
              cellOf={(r, c) => {
                const idx = c * ROWS + r;
                const start = FILL_START + (idx / CELL_COUNT) * (FILL_END - FILL_START) * 0.72;
                const p = interpolate(frame, [start, start + 9], [0, 1], clamp);
                return { color: hexForLevel(mergedLevelOf(MERGED[r][c])), opacity: mergedAppear * p, scale: 0.45 + 0.55 * p };
              }}
            />
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              top: GRID_H + 16,
              height: 4,
              width: GRID_W * fillProgress,
              background: `repeating-linear-gradient(90deg, ${COLORS.stitch} 0 10px, transparent 10px 18px)`,
              opacity: mergedAppear,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 648,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: wm,
          transform: `translateY(${(1 - wm) * 16}px)`,
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>
          quilt<span style={{ color: COLORS.stitch }}>.</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 26, color: COLORS.muted, marginTop: 8 }}>
          one dev. every account. one quilt.
        </div>
      </div>

      {showCta && (
        <div
          style={{
            position: "absolute",
            top: 868,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: cta,
            transform: `translateY(${(1 - cta) * 14}px)`,
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 999,
              background: COLORS.stitch,
              color: COLORS.bg,
              fontFamily: MONO,
              fontSize: 26,
              fontWeight: 600,
            }}
          >
            stitch yours · quilt.jass.gg
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
