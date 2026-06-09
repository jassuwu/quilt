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
  FAN_END,
  MEME_TOTAL,
  SHAPE_START,
  SLAM,
  SPIN_END,
  SPIN_START,
  WORD_START,
} from "./choreography";
import { wordCells } from "./letters";
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

const LIT = wordCells("NO LIFE", COLS);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const hash = (n: number) => {
  const s = Math.sin(n * 43.123) * 9999;
  return s - Math.floor(s);
};
const shakeAt = (frame: number, at: number, mag: number) =>
  frame >= at && frame < at + 12 ? mag * Math.sin((frame - at) * 2.1) * Math.exp(-(frame - at) * 0.35) : 0;
const flashAt = (frame: number, at: number) =>
  frame >= at && frame < at + 7 ? 0.45 * Math.exp(-(frame - at) * 0.8) : 0;

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
  { label: "@4am-merges", data: genAccount(7, 0.16) },
  { label: "@grass-allergic", data: genAccount(23, 0.13) },
  { label: "@git-goblin", data: genAccount(91, 0.18) },
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
const mergedLevel = (n: number): Level => (n <= 0 ? 0 : n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 3 : 4);

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

const Stat: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: MONO, fontSize: 26, color: COLORS.muted }}>{children}</span>
);

export const QuiltShow: React.FC<{ sound?: boolean; showCta?: boolean }> = ({
  sound = false,
  showCta = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const gatherT = interpolate(frame, [FAN_END, SLAM], [0, 1], clamp);
  const mergedAppear = interpolate(frame, [SLAM - 8, SLAM + 8], [0, 1], clamp);
  const spinT = ease(interpolate(frame, [SPIN_START, SPIN_END], [0, 1], clamp));
  const settled = frame >= SPIN_END;
  const counter = settled
    ? MEME_TOTAL
    : Math.max(0, Math.round(MEME_TOTAL * spinT + (hash(frame) * 2 - 1) * (1 - spinT) * 60000));
  const counterOpacity = interpolate(frame, [SPIN_START - 6, SPIN_START + 6], [0, 1], clamp);
  const subOpacity = interpolate(frame, [SPIN_END + 4, SPIN_END + 22], [0, 1], clamp);
  const wm = spring({ frame: frame - WORD_START, fps, config: { damping: 200 } });
  const cta = interpolate(frame, [CTA_START, CTA_START + 26], [0, 1], clamp);

  const shakeX = shakeAt(frame, SLAM, 9) + shakeAt(frame, SPIN_END, 7) + shakeAt(frame, SHAPE_START, 14);
  const shakeY = shakeAt(frame, SLAM, 5) + shakeAt(frame, SHAPE_START, 9);
  const flash = Math.max(flashAt(frame, SPIN_END), flashAt(frame, SHAPE_START));

  const mergedCell = (r: number, c: number): CellStyle => {
    const idx = c * ROWS + r;
    const popStart = SLAM + (idx / TOTAL_CELLS) * (DENSIFY_END - SLAM) * 0.8;
    const pop = interpolate(frame, [popStart, popStart + 8], [0, 1], clamp);
    const morphStart = SHAPE_START + (c / COLS) * 16;
    const morph = interpolate(frame, [morphStart, morphStart + 12], [0, 1], clamp);

    if (morph <= 0) {
      return {
        color: hexForLevel(mergedLevel(MERGED[r][c])),
        opacity: mergedAppear * pop,
        scale: 0.45 + 0.55 * pop,
      };
    }
    const lit = LIT.has(`${r},${c}`);
    const target = lit ? 4 : 0;
    const bump = Math.sin(Math.min(1, morph) * Math.PI) * 0.25;
    const pulse = lit && morph >= 1 ? 0.1 * Math.sin(frame * 0.3) : 0;
    return {
      color: hexForLevel(morph > 0.4 ? target : mergedLevel(MERGED[r][c])),
      scale: 1 + bump + pulse,
      glow: lit && morph > 0.5 ? `0 0 ${6 + morph * 8}px rgba(57,211,83,0.9)` : "none",
    };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: DISPLAY }}>
      {sound && (
        <>
          {[0, 8, 16].map((f) => (
            <Sequence key={f} from={f}>
              <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
            </Sequence>
          ))}
          <Sequence from={FAN_END}>
            <Audio src={staticFile("sfx/whoosh.wav")} volume={0.85} />
          </Sequence>
          <Sequence from={SPIN_START}>
            <Audio src={staticFile("sfx/spin.wav")} volume={0.5} />
          </Sequence>
          <Sequence from={SPIN_END}>
            <Audio src={staticFile("sfx/ding.wav")} volume={0.8} />
          </Sequence>
          <Sequence from={SHAPE_START}>
            <Audio src={staticFile("sfx/boom.wav")} volume={0.9} />
          </Sequence>
          <Sequence from={SHAPE_START + 10}>
            <Audio src={staticFile("sfx/sparkle.wav")} volume={0.6} />
          </Sequence>
          {showCta && (
            <Sequence from={CTA_START}>
              <Audio src={staticFile("sfx/tada.wav")} volume={0.7} />
            </Sequence>
          )}
        </>
      )}

      <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
        <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", opacity: counterOpacity }}>
          <div style={{ fontFamily: MONO, fontSize: 112, fontWeight: 700, letterSpacing: -3, fontVariantNumeric: "tabular-nums" }}>
            {counter.toLocaleString("en-US")}
          </div>
          <div style={{ fontSize: 28, color: COLORS.muted }}>contributions</div>
        </div>

        <div style={{ position: "absolute", top: 268, left: 0, right: 0, textAlign: "center", opacity: subOpacity, display: "flex", justifyContent: "center", gap: 28 }}>
          <Stat>0 days touched grass</Stat>
          <Stat>·</Stat>
          <Stat>1,337 commits at 4am</Stat>
          <Stat>·</Stat>
          <Stat>0% sunlight</Stat>
        </div>

        <div style={{ position: "absolute", top: 372, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          {/* merged graph → NO LIFE */}
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
            <div style={{ position: "absolute", inset: 0 }}>
              <CellGrid cell={mergedCell} />
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", top: 636, left: 0, right: 0, textAlign: "center", opacity: wm, transform: `translateY(${(1 - wm) * 16}px)` }}>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -2 }}>
            quilt<span style={{ color: COLORS.stitch }}>.</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 26, color: COLORS.muted, marginTop: 8 }}>
            gg — you have no life. go touch grass.
          </div>
        </div>

        {showCta && (
          <div style={{ position: "absolute", top: 872, left: 0, right: 0, textAlign: "center", opacity: cta, transform: `translateY(${(1 - cta) * 14}px)` }}>
            <span style={{ display: "inline-block", padding: "14px 28px", borderRadius: 999, background: COLORS.stitch, color: COLORS.bg, fontFamily: MONO, fontSize: 26, fontWeight: 700 }}>
              stitch yours · quilt.jass.gg
            </span>
          </div>
        )}

        <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: flash, pointerEvents: "none" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
