// Procedurally synthesizes the demo's score to stereo WAV — no audio assets.
//
// One key (A minor pentatonic), three acts, every cue motivated by picture:
//   bed     : a sub drone under act I that ducks into silence — the held breath
//   pluck1-3: A3/C4/E4, one per card — a broken chord, deliberately incomplete,
//             panned to each card's screen position (L / C / R)
//   riser   : noise + gliss that tightens through the converge and dies early
//   slam    : the impact — pitch-dropping sub + low fifth (A1+E2) + soft thump
//   roll    : count-up ticks decelerating while climbing the pentatonic ladder
//   ding    : A4+E5 at the top — the brightest note in the film, the chord whole
//   sweep   : stereo L→R airy swell tracking the green shimmer
//   word    : Am(add9) pluck-chord under the wordmark
//   step1-4 : theme switches — D4, E4, G4, then home to the tonic A3
//   resolve : the CTA cadence — A major (Picardy third: minor film, major ending)
//
// Heavy low-pass + soft attacks throughout; nothing bright or clicky except
// the ding, which is allowed to shine. Run with `bun run sfx`.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const TAU = Math.PI * 2;
const secs = (t: number) => Math.floor(SR * t);

// A minor pentatonic anchors
const A1 = 55;
const E2 = 82.41;
const A2 = 110;
const E3 = 164.81;
const A3 = 220;
const C4 = 261.63;
const CS4 = 277.18; // the Picardy third
const D4 = 293.66;
const E4 = 329.63;
const G4 = 392.0;
const A4 = 440;
const B4 = 493.88;
const E5 = 659.26;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Stereo = { l: Float32Array; r: Float32Array };
const stereo = (durSec: number): Stereo => ({ l: new Float32Array(secs(durSec)), r: new Float32Array(secs(durSec)) });

function toWav({ l, r }: Stereo): Buffer {
  const n = l.length;
  const out = Buffer.alloc(44 + n * 4);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + n * 4, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22); // stereo
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    out.writeInt16LE((Math.tanh(l[i]) * 32767) | 0, 44 + i * 4);
    out.writeInt16LE((Math.tanh(r[i]) * 32767) | 0, 46 + i * 4);
  }
  return out;
}

/** mix a mono source into a stereo bus at a pan position (-1 L … +1 R). */
function mixPan(dest: Stereo, src: Float32Array, atSec: number, pan = 0): void {
  const off = secs(atSec);
  const th = ((pan + 1) * Math.PI) / 4; // equal-power
  const gl = Math.cos(th);
  const gr = Math.sin(th);
  for (let i = 0; i < src.length; i++) {
    const j = off + i;
    if (j >= 0 && j < dest.l.length) {
      dest.l[j] += src[i] * gl;
      dest.r[j] += src[i] * gr;
    }
  }
}

/** one-pole low-pass for the muffled/creamy character (lower coef = darker). */
function muffle(s: Stereo, coef: number): Stereo {
  let ll = 0;
  let lr = 0;
  for (let i = 0; i < s.l.length; i++) {
    ll += (s.l[i] - ll) * coef;
    lr += (s.r[i] - lr) * coef;
    s.l[i] = ll;
    s.r[i] = lr;
  }
  return s;
}

/**
 * the room — a small Schroeder reverb (4 combs + 2 allpasses per channel,
 * R delays offset for width). Returns a longer buffer so tails breathe.
 */
function reverb(s: Stereo, wet: number, decaySec = 1.6): Stereo {
  const n = s.l.length + secs(decaySec);
  const out = stereo(n / SR + 0.01);
  const channel = (input: Float32Array, dest: Float32Array, offset: number) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => d + offset);
    const aps = [225, 556].map((d) => d + offset);
    const combBufs = combs.map((d) => new Float32Array(d));
    const fbs = combs.map((d) => Math.pow(10, (-3 * d) / (SR * decaySec)));
    const apBufs = aps.map((d) => new Float32Array(d));
    let idx = combs.map(() => 0);
    let apIdx = aps.map(() => 0);
    for (let i = 0; i < dest.length; i++) {
      const dry = i < input.length ? input[i] : 0;
      let acc = 0;
      for (let k = 0; k < combs.length; k++) {
        const buf = combBufs[k];
        const j = idx[k];
        const y = buf[j];
        buf[j] = dry + y * fbs[k];
        idx[k] = (j + 1) % buf.length;
        acc += y;
      }
      acc /= combs.length;
      for (let k = 0; k < aps.length; k++) {
        const buf = apBufs[k];
        const j = apIdx[k];
        const y = buf[j];
        const v = acc + y * 0.5;
        buf[j] = v;
        apIdx[k] = (j + 1) % buf.length;
        acc = y - v * 0.5;
      }
      dest[i] = dry * (1 - wet) + acc * wet;
    }
  };
  channel(s.l, out.l, 0);
  channel(s.r, out.r, 23);
  return out;
}

interface NoteOpts {
  gain?: number;
  attack?: number;
  decay?: number;
  partials?: [number, number][];
}
/** kalimba-ish pluck: a few soft partials, fast-but-soft attack, exp decay. */
function note(freq: number, durSec: number, opts: NoteOpts = {}): Float32Array {
  const { gain = 0.3, attack = 0.005, decay = durSec * 0.4 } = opts;
  const partials = opts.partials ?? [
    [1, 1],
    [2, 0.22],
    [3, 0.07],
  ];
  const out = new Float32Array(secs(durSec));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.exp(-t / decay);
    let s = 0;
    for (const [mult, amp] of partials) s += Math.sin(TAU * freq * mult * t) * amp;
    out[i] = s * env * gain;
  }
  return out;
}

// ---- act I ----

// sub drone that swells under the scatter, then ducks to dead silence
// ~170ms before the slam lands at 2.0s (frame 60 @ 30fps) — the held breath.
function bed(): Stereo {
  const out = stereo(2.0);
  for (let i = 0; i < out.l.length; i++) {
    const t = i / SR;
    const swell = Math.min(1, t / 1.1) * 0.16;
    const duck = t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 0.23);
    const s = (Math.sin(TAU * A1 * t) + 0.5 * Math.sin(TAU * A2 * 1.003 * t)) * swell * duck;
    out.l[i] = s;
    out.r[i] = s;
  }
  return muffle(out, 0.08);
}

function pluck(freq: number, pan: number): Stereo {
  const out = stereo(0.9);
  mixPan(out, note(freq, 0.85, { gain: 0.5, decay: 0.32 }), 0, pan);
  return reverb(muffle(out, 0.3), 0.15, 1.2);
}

// the spine — a quiet pulsing ostinato that builds through act I, vanishes
// into the held breath, and carries the rest of the film at a murmur.
// Pulses every 0.4s (12 frames), A2–E3–A3–E3, accent on the one.
function ostinato(): Stereo {
  const out = stereo(11.4);
  const pattern = [A2, E3, A3, E3];
  const env = (t: number): number => {
    if (t < 1.7) return 0.35 + 0.65 * (t / 1.7); // build
    if (t < 2.3) return 0; // the breath + the impact, untouched
    if (t < 4.6) return 0.55; // under the wind-up
    if (t < 6.1) return 0.45; // under the shimmer
    if (t < 10.0) return 0.34; // a murmur under acts III
    if (t < 10.7) return 0.34 * (1 - (t - 10.0) / 0.7); // bow out before the CTA
    return 0;
  };
  for (let k = 0; ; k++) {
    const at = k * 0.4;
    if (at >= 10.7) break;
    const g = env(at);
    if (g <= 0) continue;
    const accent = k % 4 === 0 ? 1.25 : 1;
    const p = note(pattern[k % 4], 0.34, {
      gain: 0.26 * g * accent,
      attack: 0.004,
      decay: 0.09,
      partials: [
        [1, 1],
        [2, 0.15],
      ],
    });
    mixPan(out, p, at, k % 2 === 0 ? -0.06 : 0.06);
  }
  const wet = reverb(muffle(out, 0.12), 0.12, 1.1);
  // keep the held breath truly silent: hard duck 1.78–2.05s post-reverb
  for (let i = secs(1.78); i < secs(2.05) && i < wet.l.length; i++) {
    const t = (i - secs(1.78)) / (secs(2.05) - secs(1.78));
    const g = t < 0.35 ? 1 - t / 0.35 : 0;
    wet.l[i] *= g;
    wet.r[i] *= g;
  }
  return wet;
}

// noise + gliss tightening through the converge; dies into baked-in silence
// so placing it at FAN_END leaves the gap before the slam.
function riser(): Stereo {
  const active = 0.78;
  const out = stereo(0.95);
  const rngL = mulberry32(11);
  const rngR = mulberry32(29);
  let nl = 0;
  let nr = 0;
  for (let i = 0; i < secs(active); i++) {
    const t = i / SR;
    const tn = t / active;
    const rise = Math.pow(tn, 1.7);
    const release = tn > 0.94 ? (1 - tn) / 0.06 : 1; // fast exhale at the top
    const coef = 0.03 + 0.17 * tn;
    nl += (rngL() * 2 - 1 - nl) * coef;
    nr += (rngR() * 2 - 1 - nr) * coef;
    const gliss = Math.sin(TAU * A2 * Math.pow(2, tn) * t) * 0.22;
    out.l[i] = (nl * 0.5 + gliss) * rise * release * 0.55;
    out.r[i] = (nr * 0.5 + gliss) * rise * release * 0.55;
  }
  return out;
}

// ---- act II ----

// the impact: pitch-dropping sub + a braam cluster + low fifth + soft thump
function slam(): Stereo {
  const out = stereo(2.2);
  const rng = mulberry32(3);
  let lp = 0;
  for (let i = 0; i < out.l.length; i++) {
    const t = i / SR;
    // sub drop 120 → 36 Hz
    const drop = 36 + 84 * Math.exp(-t / 0.16);
    const subEnv = Math.min(1, t / 0.006) * Math.exp(-t / 0.3);
    const sub = Math.tanh(Math.sin(TAU * drop * t) * 1.8) * subEnv * 0.8;
    // soft thump of contact
    lp += (rng() * 2 - 1 - lp) * 0.12;
    const thump = lp * Math.exp(-t / 0.045) * 0.5;
    // the braam — detuned saw cluster on A, swelling out of the hit,
    // domesticated by the heavy low-pass below
    const braamEnv = Math.min(1, t / 0.06) * Math.exp(-t / 0.55);
    let braam = 0;
    for (const det of [0.992, 1, 1.009]) {
      const f = A1 * 2 * det;
      braam += (2 * ((f * t) % 1) - 1) * 0.1;
    }
    braam *= braamEnv;
    out.l[i] = sub + thump + braam;
    out.r[i] = sub + thump + braam * 0.92;
  }
  // the low fifth blooms out of the impact, slightly detuned for width
  const cents = Math.pow(2, 2 / 1200);
  mixPan(out, note(A1, 1.8, { gain: 0.3, attack: 0.05, decay: 0.55 }), 0.02, -0.25);
  mixPan(out, note(A1 * cents, 1.8, { gain: 0.3, attack: 0.05, decay: 0.55 }), 0.02, 0.25);
  mixPan(out, note(E2, 1.7, { gain: 0.22, attack: 0.07, decay: 0.5 }), 0.05, 0);
  return reverb(muffle(out, 0.16), 0.2, 1.8);
}

// decelerating ticks that climb the pentatonic ladder — winding up to the ding
function roll(): Stereo {
  const dur = 1.55;
  const out = stereo(dur);
  const ladder = [A3, C4, D4, E4, G4, A4];
  const n = 26;
  for (let k = 0; k < n; k++) {
    const y = (k + 1) / n;
    const at = dur * (1 - Math.pow(1 - y, 1 / 3));
    const freq = ladder[Math.min(ladder.length - 1, Math.floor(y * ladder.length))];
    const tick = note(freq, 0.06, { gain: 0.42 + 0.12 * y, attack: 0.002, decay: 0.016, partials: [[1, 1]] });
    mixPan(out, tick, at, k % 2 === 0 ? -0.14 : 0.14);
  }
  return reverb(muffle(out, 0.3), 0.08, 0.9);
}

// the peak — the broken chord made whole, allowed to shine
function ding(): Stereo {
  const out = stereo(1.3);
  mixPan(out, note(A4, 1.25, { gain: 0.4, attack: 0.006, decay: 0.42 }), 0, -0.2);
  mixPan(out, note(E5, 1.2, { gain: 0.26, attack: 0.006, decay: 0.38 }), 0.01, 0.25);
  mixPan(out, note(A4 * 2, 1.0, { gain: 0.07, attack: 0.006, decay: 0.3, partials: [[1, 1]] }), 0.01, 0);
  return reverb(muffle(out, 0.38), 0.32, 2.0);
}

// airy swell panning L→R with the shimmer
function sweep(): Stereo {
  const dur = 1.2;
  const out = stereo(dur);
  const rng = mulberry32(5);
  let lp = 0;
  for (let i = 0; i < out.l.length; i++) {
    const t = i / SR;
    const tn = t / dur;
    lp += (rng() * 2 - 1 - lp) * 0.06;
    const env = Math.sin(Math.PI * tn) ** 2;
    const tone = (Math.sin(TAU * E5 * t) * 0.12 + Math.sin(TAU * A4 * t) * 0.09) * env;
    const s = (lp * 0.4 * env + tone) * 0.5;
    const th = (tn * Math.PI) / 2; // equal-power L→R journey
    out.l[i] = s * Math.cos(th);
    out.r[i] = s * Math.sin(th);
  }
  return reverb(muffle(out, 0.14), 0.18, 1.4);
}

// ---- act III ----

// Am(add9) under the wordmark, gently strummed and spread
function word(): Stereo {
  const out = stereo(1.4);
  const chord: [number, number][] = [
    [A3, -0.3],
    [C4, -0.1],
    [E4, 0.1],
    [B4, 0.3],
  ];
  chord.forEach(([f, pan], i) => {
    mixPan(out, note(f, 1.2, { gain: 0.2, attack: 0.012, decay: 0.5 }), i * 0.035, pan);
  });
  return reverb(muffle(out, 0.25), 0.28, 1.8);
}

// theme switches: three steps out, then home to the tonic
function step(freq: number): Stereo {
  const out = stereo(0.5);
  mixPan(out, note(freq, 0.45, { gain: 0.42, attack: 0.003, decay: 0.12 }), 0, 0);
  return reverb(muffle(out, 0.22), 0.22, 1.2);
}

// the cadence — A major. minor film, major ending.
function resolve(): Stereo {
  const out = stereo(2.4);
  const chord: [number, number][] = [
    [A2, 0],
    [E3, -0.25],
    [A3, 0.25],
    [CS4, -0.12],
    [E4, 0.12],
  ];
  chord.forEach(([f, pan], i) => {
    mixPan(out, note(f, 2.1, { gain: 0.16, attack: 0.02, decay: 0.75 }), i * 0.04, pan);
  });
  return reverb(muffle(out, 0.15), 0.38, 2.4);
}

const outDir = fileURLToPath(new URL("../public/sfx/", import.meta.url));
await mkdir(outDir, { recursive: true });
const sfx: Record<string, Stereo> = {
  bed: bed(),
  ostinato: ostinato(),
  pluck1: pluck(A3, -0.6),
  pluck2: pluck(C4, 0.05),
  pluck3: pluck(E4, 0.6),
  riser: riser(),
  slam: slam(),
  roll: roll(),
  ding: ding(),
  sweep: sweep(),
  word: word(),
  step1: step(D4),
  step2: step(E4),
  step3: step(G4),
  step4: step(A3),
  resolve: resolve(),
};
for (const [name, samples] of Object.entries(sfx)) {
  let peak = 0;
  for (let i = 0; i < samples.l.length; i++) {
    const a = Math.abs(samples.l[i]);
    const b = Math.abs(samples.r[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  await writeFile(join(outDir, `${name}.wav`), toWav(samples));
  console.log(`wrote sfx/${name}.wav  peak ${peak.toFixed(2)}`);
}
