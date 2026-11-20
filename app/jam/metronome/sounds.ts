// Click sounds for the Jam metronome, synthesised once into sample buffers at the
// device's own sample rate (no oscillators created per beat, no aliasing square
// waves). Each kit has three distinct voices: accent (downbeat), beat and
// subdivision. Every buffer starts and ends at zero (no pops), is peak-normalised
// with headroom, and is pure maths, so tests/metronome.test.ts can check them.

import type { ClickKind } from "./timeline";

export type SoundKit = "click" | "woodblock" | "beep" | "cowbell" | "hihat" | "stick";

export const SOUND_KITS: { id: SoundKit; label: string }[] = [
  { id: "click", label: "Studio click" },
  { id: "woodblock", label: "Woodblock" },
  { id: "beep", label: "Beep" },
  { id: "stick", label: "Drumstick" },
  { id: "cowbell", label: "Cowbell" },
  { id: "hihat", label: "Hi-hat" },
];

/** Peak level per kind: accent stands out, subdivisions sit underneath. */
export const KIND_PEAK: Record<ClickKind, number> = { accent: 0.89, beat: 0.7, sub: 0.42 };

// --- tiny DSP helpers -------------------------------------------------------

/** Deterministic noise so every visitor hears exactly the same click. */
function noise(n: number, seed = 12345): Float32Array {
  const out = new Float32Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s / 2147483648 - 1;
  }
  return out;
}

type FilterType = "lowpass" | "highpass" | "bandpass";

/** RBJ biquad, applied in place. */
function biquad(x: Float32Array, sr: number, type: FilterType, f: number, q = 0.707): Float32Array {
  const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
  const cs = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === "lowpass") [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
  else if (type === "highpass") [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
  else [b0, b1, b2] = [al, 0, -al];
  const a0 = 1 + al;
  const a1 = -2 * cs;
  const a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

/** Sum of exponentially decaying sine partials: [freq, amp, decay seconds]. */
function modal(n: number, sr: number, partials: [number, number, number][], pitchDrop = 0): Float32Array {
  const out = new Float32Array(n);
  for (const [f, a, tau] of partials) {
    if (f >= sr / 2) continue;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const fi = f * (1 + pitchDrop * Math.exp(-t / 0.004));
      ph += (2 * Math.PI * fi) / sr;
      out[i] += a * Math.sin(ph) * Math.exp(-t / tau);
    }
  }
  return out;
}

/** Band-limited square (odd harmonics below Nyquist) - the analog-style "808" source without aliasing. */
function blSquare(n: number, sr: number, f: number): Float32Array {
  const out = new Float32Array(n);
  for (let h = 1; h * f < sr * 0.45; h += 2) {
    const w = (2 * Math.PI * f * h) / sr;
    for (let i = 0; i < n; i++) out[i] += Math.sin(w * i) / h;
  }
  return out;
}

function decay(x: Float32Array, sr: number, tau: number, attack = 0): Float32Array {
  for (let i = 0; i < x.length; i++) {
    const t = i / sr;
    const atk = attack > 0 && t < attack ? t / attack : 1;
    x[i] *= atk * Math.exp(-t / tau);
  }
  return x;
}

function mix(...parts: [Float32Array, number][]): Float32Array {
  const out = new Float32Array(parts[0][0].length);
  for (const [p, g] of parts) for (let i = 0; i < out.length; i++) out[i] += p[i] * g;
  return out;
}

/** 0.25 ms raised-cosine fade-in (keeps the transient crisp but click-free at sample 0) and a smooth tail fade, then peak-normalise. */
function finish(x: Float32Array, sr: number, peak: number): Float32Array {
  const fi = Math.max(2, Math.round(sr * 0.00025));
  for (let i = 0; i < fi && i < x.length; i++) x[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fi);
  const fo = Math.min(x.length, Math.round(sr * 0.012));
  for (let i = 0; i < fo; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fo);
  x[0] = 0;
  x[x.length - 1] = 0;
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

// --- kits --------------------------------------------------------------------

function render(kit: SoundKit, kind: ClickKind, sr: number): Float32Array {
  const P = { accent: 0, beat: 1, sub: 2 }[kind];
  const sec = (s: number) => Math.round(sr * s);
  switch (kit) {
    case "click": {
      // Tight studio click: tuned sine "ping" + a very short filtered noise transient for definition.
      const f = [2093, 1568, 1175][P];
      const n = sec(0.07);
      const tone = modal(n, sr, [[f, 1, kind === "accent" ? 0.012 : 0.009], [f * 2.01, 0.25, 0.004]]);
      const tr = decay(biquad(noise(n, 7), sr, "bandpass", 5000, 0.9), sr, 0.0012);
      return mix([tone, 1], [tr, 0.6]);
    }
    case "woodblock": {
      // Two-mode wooden resonator struck with a short mallet noise.
      const f = [1180, 880, 740][P];
      const n = sec(0.12);
      const body = modal(n, sr, [[f, 1, 0.045], [f * 2.48, 0.38, 0.018], [f * 4.1, 0.12, 0.008]], 0.03);
      const strike = decay(biquad(noise(n, 11), sr, "bandpass", f * 3, 1.2), sr, 0.0015);
      return mix([body, 1], [strike, 0.35]);
    }
    case "beep": {
      // Classic electronic metronome beep with soft (2 ms) edges - pure, no harsh square.
      const f = [1760, 880, 660][P];
      const n = sec(0.08);
      const x = modal(n, sr, [[f, 1, 10], [f * 2, 0.06, 10]]);
      const a = sec(0.002), r = sec(0.02), hold = sec(kind === "sub" ? 0.03 : 0.05);
      for (let i = 0; i < n; i++) {
        const g = i < a ? i / a : i < hold ? 1 : Math.max(0, 1 - (i - hold) / r);
        x[i] *= g * g;
      }
      return x;
    }
    case "stick": {
      // Stick-on-stick / rim click: bright woody knock with a crack of noise.
      const f = [2400, 1900, 1650][P];
      const n = sec(0.08);
      const knock = modal(n, sr, [[f, 1, 0.014], [f * 1.53, 0.6, 0.009], [f * 0.52, 0.35, 0.02]]);
      const crack = decay(biquad(noise(n, 23), sr, "bandpass", 3800, 1.4), sr, 0.004);
      return mix([knock, 0.8], [crack, 0.9]);
    }
    case "cowbell": {
      // TR-808 cowbell: two band-limited squares through a band-pass, two-stage decay.
      const k = [1.12, 1, 0.9][P];
      const n = sec(kind === "sub" ? 0.12 : 0.22);
      const x = mix([blSquare(n, sr, 540 * k), 1], [blSquare(n, sr, 800 * k), 1]);
      biquad(x, sr, "bandpass", 2640 * k, 1.1);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        x[i] *= 0.65 * Math.exp(-t / 0.012) + 0.35 * Math.exp(-t / 0.075);
      }
      return x;
    }
    case "hihat": {
      // Closed hi-hat: metallic 808 partials + noise, high-passed, short decay.
      const n = sec(kind === "accent" ? 0.09 : 0.06);
      const metal = new Float32Array(n);
      for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
        const sq = blSquare(n, sr, f * 2);
        for (let i = 0; i < n; i++) metal[i] += sq[i];
      }
      const x = mix([metal, 0.5], [noise(n, 31), 1]);
      biquad(x, sr, "highpass", kind === "sub" ? 8000 : 7000, 0.8);
      biquad(x, sr, "highpass", 6000, 0.7);
      return decay(x, sr, [0.03, 0.018, 0.012][P]);
    }
  }
}

export function renderClick(kit: SoundKit, kind: ClickKind, sampleRate: number): Float32Array {
  return finish(render(kit, kind, sampleRate), sampleRate, KIND_PEAK[kind]);
}
