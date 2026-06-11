import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CARD_STAGGER,
  CTA_START,
  EMBED_START,
  FAN_END,
  GATHER_END,
  MERGE_START,
  THEME_HOME,
  THEME_STEPS,
  WORD_START,
} from "./choreography";
import {
  COLORS,
  DEMO_THEMES,
  HOME_THEME,
  hexForLevel,
  type DemoTheme,
  type Level,
} from "./theme";

const { fontFamily: DISPLAY } = loadDisplay("normal", { weights: ["800"], subsets: ["latin"] });
const { fontFamily: MONO } = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] });

const COLS = 52;
const ROWS = 7;
const CELL = 22;
const GAP = 6;
const STEP = CELL + GAP;
const GRID_W = COLS * STEP - GAP;
const GRID_H = ROWS * STEP - GAP;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

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

type CellStyle = { color: string; scale?: number; opacity?: number };

const CellGrid: React.FC<{ cell: (r: number, c: number) => CellStyle }> = ({ cell }) => {
  const items = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const { color, scale = 1, opacity = 1 } = cell(r, c);
      items.push(
        <div
          key={c * ROWS + r}
          style={{ width: CELL, height: CELL, borderRadius: 5, background: color, transform: `scale(${scale})`, opacity }}
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

/** which theme the world is wearing at this frame, with a crossfade t. */
function themeAt(frame: number): { from: DemoTheme; to: DemoTheme; t: number } {
  const stops: { at: number; theme: DemoTheme }[] = [
    ...THEME_STEPS.map((at, i) => ({ at, theme: DEMO_THEMES[i] })),
    { at: THEME_HOME, theme: HOME_THEME },
  ];
  let from = HOME_THEME;
  for (const stop of stops) {
    if (frame >= stop.at) {
      const t = interpolate(frame, [stop.at, stop.at + 12], [0, 1], clamp);
      if (t < 1) {
        return { from, to: stop.theme, t: easeInOut(t) };
      }
      from = stop.theme;
    }
  }
  return { from, to: from, t: 1 };
}

const lerpColor = (t: number, a: string, b: string) =>
  t >= 1 ? b : t <= 0 ? a : interpolateColors(t, [0, 1], [a, b]);

export const QuiltShow: React.FC<{
  sound?: boolean;
  showCta?: boolean;
}> = ({ sound = false, showCta = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---- beat 1: scatter → converge → one quilt (a cross-fade, not an impact) ----
  const gatherT = easeInOut(interpolate(frame, [FAN_END, GATHER_END], [0, 1], clamp));
  const cardFade = interpolate(frame, [MERGE_START, MERGE_START + 14], [1, 0], clamp);

  // ---- beat 2: wordmark + stitch seam + tagline ----
  const brandT = spring({ frame: frame - WORD_START, fps, config: { damping: 200 } });
  const stitchT = spring({ frame: frame - WORD_START - 8, fps, config: { damping: 30, stiffness: 90 } });

  // ---- beat 3: the embed snippet, re-colored live ----
  const embedIn = interpolate(frame, [EMBED_START, EMBED_START + 22], [0, 1], clamp);
  const ctaT = spring({ frame: frame - CTA_START, fps, config: { damping: 13, stiffness: 150 } });

  const { from: themeFrom, to: themeTo, t: themeT } = themeAt(frame);
  const bg = lerpColor(themeT, themeFrom.bg, themeTo.bg);
  const surface = lerpColor(themeT, themeFrom.surface, themeTo.surface);

  const mergedCell = (r: number, c: number): CellStyle => {
    // the quilt stitches itself together — a gentle diagonal wave, the same
    // language as the account cards assembling
    const wave = MERGE_START + c * 0.25 + r * 0.5;
    const cellT = interpolate(frame, [wave, wave + 8], [0, 1], clamp);
    const level = mergedLevel(MERGED[r][c]);
    // theme changes wipe across the quilt L→R — a restyle is a material
    // change, never a uniform crossfade
    const wipeFront = themeT * (COLS + 10) - 5;
    const wipeT = themeT >= 1 ? 1 : interpolate(c, [wipeFront - 5, wipeFront], [1, 0], clamp);
    return {
      color: lerpColor(wipeT, themeFrom.levels[level], themeTo.levels[level]),
      opacity: cellT,
      scale: 0.7 + 0.3 * cellT,
    };
  };

  // the ?theme= param types itself in as the wipe crosses the quilt
  const paramTarget = themeTo.name ? `?theme=${themeTo.name}` : "";
  const paramPrev = themeFrom.name ? `?theme=${themeFrom.name}` : "";
  const themeParam =
    themeT >= 1
      ? paramTarget
      : paramTarget
        ? paramTarget.slice(0, Math.round(themeT * 1.6 * paramTarget.length))
        : paramPrev.slice(0, Math.round((1 - themeT * 1.6) * paramPrev.length));
  const themeAccent = themeT < 0.5 ? themeFrom.color : themeTo.color;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, color: COLORS.text, fontFamily: DISPLAY }}>
      {sound && (
        <>
          {/* the musical floor, then one quiet cue per beat */}
          <Sequence>
            <Audio src={staticFile("sfx/bed.wav")} volume={0.55} />
          </Sequence>
          <Sequence>
            <Audio src={staticFile("sfx/ostinato.wav")} volume={0.5} />
          </Sequence>
          {[1, 2, 3].map((n) => (
            <Sequence key={n} from={(n - 1) * CARD_STAGGER}>
              <Audio src={staticFile(`sfx/pluck${n}.wav`)} volume={0.4} />
            </Sequence>
          ))}
          <Sequence from={MERGE_START}>
            <Audio src={staticFile("sfx/sweep.wav")} volume={0.5} />
          </Sequence>
          <Sequence from={WORD_START}>
            <Audio src={staticFile("sfx/word.wav")} volume={0.45} />
          </Sequence>
          <Sequence from={EMBED_START}>
            <Audio src={staticFile("sfx/pluck2.wav")} volume={0.28} />
          </Sequence>
          {[...THEME_STEPS, THEME_HOME].map((at, i) => (
            <Sequence key={at} from={at}>
              <Audio src={staticFile(`sfx/step${i + 1}.wav`)} volume={0.34} />
              <Audio src={staticFile("sfx/flip.wav")} volume={0.3} />
            </Sequence>
          ))}
          {showCta && (
            <Sequence from={CTA_START}>
              <Audio src={staticFile("sfx/resolve.wav")} volume={0.62} />
            </Sequence>
          )}
        </>
      )}

      {/* top zone: the wordmark, once the quilt exists */}
      <div style={{ position: "absolute", top: 132, left: 0, right: 0, textAlign: "center", opacity: brandT, transform: `translateY(${(1 - brandT) * 14}px)` }}>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: 6 - 8 * brandT }}>
          quilt<span style={{ color: COLORS.stitch }}>.</span>
        </div>
        {/* the seam sews itself under the wordmark */}
        <div style={{ width: 168, margin: "10px auto 0", height: 3 }}>
          <div
            style={{
              width: `${Math.max(0, Math.min(1, stitchT)) * 100}%`,
              borderTop: `3px dashed ${COLORS.stitch}`,
              opacity: 0.85,
            }}
          />
        </div>
      </div>

      {/* center: the quilt */}
      <div style={{ position: "absolute", top: 360, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: GRID_W, height: GRID_H }}>
          {ACCOUNTS.map((acc, i) => {
            const start = i * CARD_STAGGER;
            const appear = ease(interpolate(frame, [start, start + 20], [0, 1], clamp));
            const x = FAN[i].x * (1 - gatherT);
            const y = FAN[i].y * (1 - gatherT) + (1 - appear) * 60;
            const rot = FAN[i].rot * (1 - gatherT);
            const cardScale = 0.96 + 0.04 * appear;
            // the label types itself, like a username going into the input
            const typed = Math.round(
              interpolate(frame, [start + 2, start + 16], [0, acc.label.length], clamp),
            );
            const cursorOn = frame < start + 22 && frame % 8 < 5;
            return (
              <div
                key={acc.label}
                style={{ position: "absolute", inset: 0, opacity: appear * cardFade, transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${cardScale})`, transformOrigin: "center" }}
              >
                <div style={{ position: "absolute", top: -44, left: "50%", transform: "translateX(-50%)", fontFamily: MONO, fontSize: 22, color: COLORS.muted, opacity: 1 - gatherT, whiteSpace: "nowrap" }}>
                  {acc.label.slice(0, typed)}
                  {cursorOn && <span style={{ color: COLORS.stitch }}>▍</span>}
                </div>
                <CellGrid
                  cell={(r, c) => {
                    // each account stitches itself together — a fast
                    // diagonal wave of patches, the material assembling
                    const wave = start + 2 + c * 0.16 + r * 0.5;
                    const cellT = interpolate(frame, [wave, wave + 5], [0, 1], clamp);
                    return {
                      color: hexForLevel(ownLevel(acc.data[r][c])),
                      opacity: cellT,
                      scale: 0.4 + 0.6 * cellT,
                    };
                  }}
                />
              </div>
            );
          })}
          <div style={{ position: "absolute", inset: 0 }}>
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
        <div style={{ display: "inline-block", padding: "16px 24px", borderRadius: 14, background: surface, border: `1px solid rgba(255,255,255,0.08)`, fontFamily: MONO, fontSize: 28, color: COLORS.text }}>
          {"![my quilt]("}
          <span style={{ color: COLORS.stitch }}>quilt.jass.gg/u/you.svg</span>
          <span style={{ color: themeAccent }}>{themeParam}</span>
          {")"}
        </div>
      </div>

      {showCta && (
        <div style={{ position: "absolute", top: 820, left: 0, right: 0, textAlign: "center", opacity: Math.min(1, ctaT * 1.4), transform: `scale(${0.9 + 0.1 * ctaT})` }}>
          <span style={{ display: "inline-block", padding: "14px 28px", borderRadius: 999, background: COLORS.stitch, color: COLORS.bg, fontFamily: MONO, fontSize: 26, fontWeight: 700 }}>
            stitch yours · quilt.jass.gg
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
