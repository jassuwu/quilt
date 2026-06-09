import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CTA_START,
  DENSIFY_END,
  EMBED_START,
  FAN_END,
  REVEAL_START,
  SLAM,
  SPIN_END,
  SPIN_START,
  WORD_START,
} from "./choreography";
import { COLORS, hexForLevel, type Level } from "./theme";

const { fontFamily: DISPLAY } = loadDisplay("normal", { weights: ["800"], subsets: ["latin"] });
const { fontFamily: MONO } = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] });

const COLS = 52;
const ROWS = 7;
const CELL = 22;
const GAP = 6;
const STEP = CELL + GAP;
const GRID_W = COLS * STEP - GAP;
const GRID_H = ROWS * STEP - GAP;
const TOTAL_CELLS = COLS * ROWS;
const TOTAL = 1337; // a subtle leet nod; the grid stays a real lush sample

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const shakeAt = (frame: number, at: number, mag: number) =>
  frame >= at && frame < at + 12 ? mag * Math.sin((frame - at) * 2) * Math.exp(-(frame - at) * 0.45) : 0;

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
    for (let c = 0; c < COLS; c++) row.push(rng() < density ? 1 + Math.floor(rng() * 5) : 0);
    grid.push(row);
  }
  return grid;
}

const ACCOUNTS = [
  { label: "@work", data: genAccount(7, 0.5) },
  { label: "@personal", data: genAccount(23, 0.55) },
  { label: "@side-project", data: genAccount(91, 0.42) },
];
const MERGED: number[][] = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => ACCOUNTS.reduce((s, a) => s + a.data[r][c], 0)),
);
const FAN = [
  { x: -380, y: -70, rot: -8 },
  { x: 40, y: 70, rot: 5 },
  { x: 360, y: -20, rot: 10 },
];

const ownLevel = (n: number): Level => (n <= 0 ? 0 : Math.min(4, n)) as Level;
const mergedLevel = (n: number): Level => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);

type CellStyle = { color: string; scale?: number; opacity?: number; glow?: string };

const CellGrid: React.FC<{ cell: (r: number, c: number) => CellStyle }> = ({ cell }) => {
  const items = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const { color, scale = 1, opacity = 1, glow = "none" } = cell(r, c);
      items.push(
        <div
          key={c * ROWS + r}
          style={{ width: CELL, height: CELL, borderRadius: 5, background: color, transform: `scale(${scale})`, opacity, boxShadow: glow }}
        />,
      );
    }
  }
  return (
    <div
      style={{ display: "grid", gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`, gridAutoFlow: "column", columnGap: GAP, rowGap: GAP, width: GRID_W, height: GRID_H }}
    >
      {items}
    </div>
  );
};

export const QuiltShow: React.FC<{ sound?: boolean; showCta?: boolean }> = ({
  sound = false,
  showCta = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const gatherT = interpolate(frame, [FAN_END, SLAM], [0, 1], clamp);
  const mergedAppear = interpolate(frame, [SLAM - 8, SLAM + 8], [0, 1], clamp);
  const count = Math.round(TOTAL * ease(interpolate(frame, [SPIN_START, SPIN_END], [0, 1], clamp)));
  const countIn = interpolate(frame, [SPIN_START - 6, SPIN_START + 6], [0, 1], clamp);
  const brandT = spring({ frame: frame - WORD_START, fps, config: { damping: 200 } });
  const embedIn = interpolate(frame, [EMBED_START, EMBED_START + 22], [0, 1], clamp);
  const cta = interpolate(frame, [CTA_START, CTA_START + 26], [0, 1], clamp);

  const shakeX = shakeAt(frame, SLAM, 5);
  const shakeY = shakeAt(frame, SLAM, 3);

  // green shimmer sweeping across the finished quilt
  const wavePos = interpolate(frame, [REVEAL_START, REVEAL_START + 30], [-5, COLS + 5], clamp);
  // once the embed snippet is up, the quilt cycles hue — "your colors"
  const hue = interpolate(frame, [EMBED_START + 26, EMBED_START + 92], [0, 330], clamp);

  const mergedCell = (r: number, c: number): CellStyle => {
    const idx = c * ROWS + r;
    const popStart = SLAM + (idx / TOTAL_CELLS) * (DENSIFY_END - SLAM) * 0.8;
    const pop = interpolate(frame, [popStart, popStart + 8], [0, 1], clamp);
    const level = mergedLevel(MERGED[r][c]);
    const dist = wavePos - c;
    const bump = frame >= REVEAL_START ? Math.exp(-(dist * dist) / 6) : 0;
    return {
      color: hexForLevel(level),
      opacity: mergedAppear * pop,
      scale: 0.45 + 0.55 * pop + 0.22 * bump,
      glow: bump > 0.25 && level >= 2 ? `0 0 ${bump * 10}px rgba(57,211,83,${0.55 * bump})` : "none",
    };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: DISPLAY }}>
      {sound && (
        <>
          {[0, 8, 16].map((f) => (
            <Sequence key={f} from={f}>
              <Audio src={staticFile("sfx/place.wav")} volume={0.3} />
            </Sequence>
          ))}
          <Sequence from={FAN_END}>
            <Audio src={staticFile("sfx/place.wav")} volume={0.5} />
          </Sequence>
          <Sequence from={SPIN_START}>
            <Audio src={staticFile("sfx/roll.wav")} volume={0.4} />
          </Sequence>
          <Sequence from={SPIN_END}>
            <Audio src={staticFile("sfx/land.wav")} volume={0.6} />
          </Sequence>
          <Sequence from={REVEAL_START}>
            <Audio src={staticFile("sfx/sweep.wav")} volume={0.5} />
          </Sequence>
          <Sequence from={EMBED_START}>
            <Audio src={staticFile("sfx/place.wav")} volume={0.3} />
          </Sequence>
          {showCta && (
            <Sequence from={CTA_START}>
              <Audio src={staticFile("sfx/resolve.wav")} volume={0.55} />
            </Sequence>
          )}
        </>
      )}

      <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
        {/* top zone: number → wordmark */}
        <div style={{ position: "absolute", top: 108, left: 0, right: 0, textAlign: "center", opacity: countIn * (1 - brandT) }}>
          <div style={{ fontFamily: MONO, fontSize: 112, fontWeight: 700, letterSpacing: -3, fontVariantNumeric: "tabular-nums" }}>
            {count.toLocaleString("en-US")}
          </div>
          <div style={{ fontSize: 26, color: COLORS.muted, marginTop: 4 }}>contributions</div>
        </div>
        <div style={{ position: "absolute", top: 132, left: 0, right: 0, textAlign: "center", opacity: brandT, transform: `translateY(${(1 - brandT) * 14}px)` }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>
            quilt<span style={{ color: COLORS.stitch }}>.</span>
          </div>
        </div>

        {/* center: the quilt */}
        <div style={{ position: "absolute", top: 360, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: GRID_W, height: GRID_H }}>
            {ACCOUNTS.map((acc, i) => {
              const appear = interpolate(frame, [i * 6, i * 6 + 18], [0, 1], clamp);
              const fade = interpolate(frame, [SLAM - 10, SLAM], [1, 0], clamp);
              const x = FAN[i].x * (1 - gatherT);
              const y = FAN[i].y * (1 - gatherT) + (1 - appear) * 60;
              const rot = FAN[i].rot * (1 - gatherT);
              return (
                <div
                  key={acc.label}
                  style={{ position: "absolute", inset: 0, opacity: appear * fade, transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`, transformOrigin: "center" }}
                >
                  <div style={{ position: "absolute", top: -44, left: 0, fontFamily: MONO, fontSize: 22, color: COLORS.muted }}>
                    {acc.label}
                  </div>
                  <CellGrid cell={(r, c) => ({ color: hexForLevel(ownLevel(acc.data[r][c])) })} />
                </div>
              );
            })}
            <div style={{ position: "absolute", inset: 0, filter: `hue-rotate(${hue}deg)` }}>
              <CellGrid cell={mergedCell} />
            </div>
          </div>
        </div>

        {/* below zone: tagline → embed snippet */}
        <div style={{ position: "absolute", top: 648, left: 0, right: 0, textAlign: "center", opacity: brandT * (1 - embedIn), fontFamily: MONO, fontSize: 26, color: COLORS.muted }}>
          every account, one quilt.
        </div>
        <div style={{ position: "absolute", top: 624, left: 0, right: 0, textAlign: "center", opacity: embedIn, transform: `translateY(${(1 - embedIn) * 12}px)` }}>
          <div style={{ fontFamily: MONO, fontSize: 22, color: COLORS.muted, marginBottom: 14 }}>
            embed it anywhere, in your colors
          </div>
          <div style={{ display: "inline-block", padding: "16px 24px", borderRadius: 14, background: COLORS.surface, border: `1px solid ${COLORS.seam}`, fontFamily: MONO, fontSize: 28, color: COLORS.text }}>
            {"![my quilt]("}
            <span style={{ color: COLORS.stitch }}>quilt.jass.gg/u/you.svg</span>
            {")"}
          </div>
        </div>

        {showCta && (
          <div style={{ position: "absolute", top: 820, left: 0, right: 0, textAlign: "center", opacity: cta, transform: `translateY(${(1 - cta) * 14}px)` }}>
            <span style={{ display: "inline-block", padding: "14px 28px", borderRadius: 999, background: COLORS.stitch, color: COLORS.bg, fontFamily: MONO, fontSize: 26, fontWeight: 700 }}>
              stitch yours · quilt.jass.gg
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
