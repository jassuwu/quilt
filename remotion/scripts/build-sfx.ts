// Procedurally synthesizes the demo's sound effects to WAV — no audio assets.
// Run with `bun run sfx` (also chained before `render:social`).
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
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

// fabric whoosh — lowpassed noise, fast in / slow out
function whoosh(): Float32Array {
  const n = secs(0.34);
  const out = new Float32Array(n);
  const rng = mulberry32(11);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    lp += (rng() * 2 - 1 - lp) * (0.04 + 0.25 * t);
    out[i] = lp * Math.sin(Math.PI * t) ** 1.5 * 0.6;
  }
  return out;
}

// slot-machine whirr — rising pitch + accelerating tremolo
function spin(): Float32Array {
  const n = secs(2.0);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 220 + 700 * t * t;
    const trem = 0.5 + 0.5 * Math.sin(TAU * (8 + 34 * t) * (i / SR));
    const e = Math.min(1, t * 6) * (1 - 0.2 * t);
    out[i] = Math.sin(TAU * freq * (i / SR)) * trem * e * 0.26;
  }
  return out;
}

// bright bell for the number landing
function ding(): Float32Array {
  const n = secs(0.6);
  const out = new Float32Array(n);
  const partials = [1320, 1980, 2640];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.exp(-6 * t);
    let s = 0;
    for (let p = 0; p < partials.length; p++) s += Math.sin(TAU * partials[p] * t) / (p + 1);
    out[i] = s * e * 0.3;
  }
  return out;
}

// sub-bass drop for the shape reveal
function boom(): Float32Array {
  const n = secs(0.7);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const freq = 90 - 50 * (i / n);
    out[i] = Math.tanh(Math.sin(TAU * freq * t) * 2.2) * Math.exp(-4 * t) * 0.5;
  }
  return out;
}

// scattered high pops as the letters stitch in
function sparkle(): Float32Array {
  const n = secs(1.4);
  const out = new Float32Array(n);
  const rng = mulberry32(7);
  for (let b = 0; b < 64; b++) {
    const start = Math.floor(rng() * (n - secs(0.06)));
    const freq = 1200 + rng() * 2600;
    const len = secs(0.04 + rng() * 0.05);
    for (let i = 0; i < len && start + i < n; i++) {
      out[start + i] += Math.sin(TAU * freq * (i / SR)) * Math.exp(-40 * (i / SR)) * 0.18;
    }
  }
  return out;
}

// payoff chord
function tada(): Float32Array {
  const n = secs(1.1);
  const out = new Float32Array(n);
  const chord = [523.25, 659.25, 783.99, 1046.5]; // C E G C
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, (i / n) * 8) * Math.exp(-1.6 * t);
    const vib = 1 + 0.004 * Math.sin(TAU * 6 * t);
    let s = 0;
    for (const f of chord) s += Math.sin(TAU * f * vib * t);
    out[i] = (s / chord.length) * e * 0.4;
  }
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
console.log("✓ sfx:", Object.keys(sfx).join(", "));
