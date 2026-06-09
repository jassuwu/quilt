// Procedurally synthesizes the demo's sound effects to WAV — no audio assets.
// Design: creamy + muffled, each cue motivated by what's on screen —
//   place  : soft thud as a card drops in (and the merge slam)
//   roll   : a decelerating tick-roll while the number counts up
//   land   : a soft rounded settle when it stops
//   sweep  : a swept swell that tracks the green shimmer
//   resolve: a warm low chord for the CTA
// Heavy low-pass + soft attacks; nothing bright or clicky. Run with `bun run sfx`.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const TAU = Math.PI * 2;
const secs = (t: number) => Math.floor(SR * t);

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toWav(samples: Float32Array): Buffer {
  const n = samples.length;
  const out = Buffer.alloc(44 + n * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + n * 2, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE((Math.tanh(samples[i]) * 32767) | 0, 44 + i * 2);
  return out;
}

const buf = (durSec: number) => new Float32Array(secs(durSec));

function mix(dest: Float32Array, src: Float32Array, atSec: number): void {
  const off = secs(atSec);
  for (let i = 0; i < src.length; i++) {
    const j = off + i;
    if (j >= 0 && j < dest.length) dest[j] += src[i];
  }
}

/** one-pole low-pass for the muffled/creamy character (lower coef = darker). */
function muffle(s: Float32Array, coef: number): Float32Array {
  let lp = 0;
  for (let i = 0; i < s.length; i++) {
    lp += (s[i] - lp) * coef;
    s[i] = lp;
  }
  return s;
}

interface NoteOpts {
  gain?: number;
  attack?: number;
  decay?: number;
  partials?: [number, number][];
}
function note(freq: number, durSec: number, opts: NoteOpts = {}): Float32Array {
  const { gain = 0.3, attack = 0.012, decay = durSec * 0.5 } = opts;
  const partials = opts.partials ?? [[1, 1], [2, 0.16]];
  const out = buf(durSec);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.exp(-t / decay);
    let s = 0;
    for (const [mult, amp] of partials) s += Math.sin(TAU * freq * mult * t) * amp;
    out[i] = s * env * gain;
  }
  return out;
}

// soft muffled thud — a card dropping in / the merge slam
function place(): Float32Array {
  const out = buf(0.22);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.014) * Math.exp(-t / 0.09);
    out[i] = Math.sin(TAU * 150 * t) * env * 0.5;
  }
  return muffle(out, 0.35);
}

// decelerating tick-roll for the count-up — dense early, sparse as it lands
function roll(): Float32Array {
  const dur = 1.7;
  const out = buf(dur);
  const n = 28;
  for (let k = 0; k < n; k++) {
    const y = (k + 1) / n;
    const at = dur * (1 - Math.pow(1 - y, 1 / 3));
    const blip = buf(0.045);
    for (let i = 0; i < blip.length; i++) {
      const bt = i / SR;
      blip[i] = Math.sin(TAU * 140 * bt) * Math.min(1, bt / 0.003) * Math.exp(-bt / 0.018) * 0.4;
    }
    mix(out, blip, at);
  }
  return muffle(out, 0.16);
}

// soft rounded settle when the number stops
function land(): Float32Array {
  const out = buf(0.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.012) * Math.exp(-t / 0.2);
    out[i] = (Math.sin(TAU * 196 * t) + 0.4 * Math.sin(TAU * 294 * t)) * env * 0.45;
  }
  return muffle(out, 0.2);
}

// creamy swept swell that tracks the green shimmer
function sweep(): Float32Array {
  const dur = 1.2;
  const out = buf(dur);
  const rng = mulberry32(5);
  let lp = 0;
  for (let i = 0; i < out.length; i++) {
    const tn = i / out.length;
    lp += (rng() * 2 - 1 - lp) * 0.05;
    const env = Math.sin(Math.PI * tn) ** 2;
    const tone = Math.sin(TAU * (95 + 35 * tn) * (i / SR)) * 0.35;
    out[i] = (lp * 0.45 + tone) * env * 0.32;
  }
  return muffle(out, 0.1);
}

// warm low resolve chord for the CTA
function resolve(): Float32Array {
  const out = buf(1.1);
  [261.63, 329.63, 392.0, 523.25].forEach((f, i) =>
    mix(out, note(f, 1.0, { gain: 0.16, attack: 0.03, decay: 0.55 }), i * 0.035),
  );
  return muffle(out, 0.13);
}

const outDir = fileURLToPath(new URL("../public/sfx/", import.meta.url));
await mkdir(outDir, { recursive: true });
const sfx: Record<string, Float32Array> = {
  place: place(),
  roll: roll(),
  land: land(),
  sweep: sweep(),
  resolve: resolve(),
};
for (const [name, samples] of Object.entries(sfx)) {
  await writeFile(join(outDir, `${name}.wav`), toWav(samples));
}
console.log("wrote sfx:", Object.keys(sfx).join(", "));
