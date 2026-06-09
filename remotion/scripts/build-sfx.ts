// Procedurally synthesizes the demo's sound effects to WAV — no audio assets.
// Goal: warm, musical, satisfying — soft attacks, pentatonic notes, gentle low
// end, no harsh noise or clipping. Run with `bun run sfx` (chained into render:social).
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
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    // gentle tanh limiting keeps peaks soft instead of clipping harshly
    const s = Math.tanh(samples[i]);
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

const buf = (durSec: number) => new Float32Array(secs(durSec));

function mix(dest: Float32Array, src: Float32Array, atSec: number): void {
  const off = secs(atSec);
  for (let i = 0; i < src.length; i++) {
    const j = off + i;
    if (j >= 0 && j < dest.length) dest[j] += src[i];
  }
}

interface NoteOpts {
  gain?: number;
  attack?: number;
  decay?: number;
  partials?: [number, number][];
}

// a soft mallet/marimba-ish pluck: stacked partials, gentle attack, exp decay
function note(freq: number, durSec: number, opts: NoteOpts = {}): Float32Array {
  const { gain = 0.28, attack = 0.008, decay = durSec * 0.45 } = opts;
  const partials = opts.partials ?? [
    [1, 1],
    [2, 0.32],
    [3, 0.12],
  ];
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

// C-major pentatonic — any mix stays consonant
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const D6 = 1174.66;
const E6 = 1318.51;
const G6 = 1567.98;

// soft air swish for the fan-in / slam (lowpassed noise, smooth in/out, quiet)
function whoosh(): Float32Array {
  const out = buf(0.4);
  const rng = mulberry32(11);
  let lp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    lp += (rng() * 2 - 1 - lp) * 0.06;
    out[i] = lp * Math.sin(Math.PI * t) ** 2 * 0.22;
  }
  return out;
}

// an ascending pentatonic run for the count-up — satisfying, not a buzzy whirr
function spin(): Float32Array {
  const out = buf(1.0);
  [C5, D5, E5, G5, A5, C6].forEach((f, i) =>
    mix(out, note(f, 0.4, { gain: 0.15, attack: 0.006, decay: 0.16 }), i * 0.1),
  );
  return out;
}

// a warm bell for the number landing — the emotional peak
function ding(): Float32Array {
  const out = buf(0.9);
  mix(
    out,
    note(E5, 0.85, {
      gain: 0.34,
      attack: 0.004,
      decay: 0.42,
      partials: [
        [1, 1],
        [2, 0.5],
        [3, 0.22],
        [4.2, 0.08],
      ],
    }),
    0,
  );
  mix(out, note(G5 * 2, 0.6, { gain: 0.1, attack: 0.004, decay: 0.25 }), 0);
  return out;
}

// a soft low swell for the shimmer reveal — gentle, never startling
function boom(): Float32Array {
  const out = buf(0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.06) * Math.exp(-t / 0.5);
    out[i] = (Math.sin(TAU * 65.41 * t) + 0.3 * Math.sin(TAU * 130.82 * t)) * env * 0.32;
  }
  return out;
}

// soft high plucks sprinkled across the shimmer
function sparkle(): Float32Array {
  const out = buf(1.3);
  const rng = mulberry32(7);
  const hi = [C6, D6, E6, G6];
  for (let k = 0; k < 14; k++) {
    const f = hi[Math.floor(rng() * hi.length)];
    mix(out, note(f, 0.45, { gain: 0.06, attack: 0.005, decay: 0.16 }), rng() * 0.9);
  }
  return out;
}

// a warm major chord that resolves — the CTA / embed beat
function tada(): Float32Array {
  const out = buf(1.2);
  [C5, E5, G5, C6].forEach((f, i) =>
    mix(
      out,
      note(f, 1.1, { gain: 0.15, attack: 0.02, decay: 0.6, partials: [[1, 1], [2, 0.28]] }),
      i * 0.03,
    ),
  );
  return out;
}

const outDir = fileURLToPath(new URL("../public/sfx/", import.meta.url));
await mkdir(outDir, { recursive: true });
const sfx: Record<string, Float32Array> = {
  whoosh: whoosh(),
  spin: spin(),
  ding: ding(),
  boom: boom(),
  sparkle: sparkle(),
  tada: tada(),
};
for (const [name, samples] of Object.entries(sfx)) {
  await writeFile(join(outDir, `${name}.wav`), toWav(samples));
}
console.log("wrote sfx:", Object.keys(sfx).join(", "));
