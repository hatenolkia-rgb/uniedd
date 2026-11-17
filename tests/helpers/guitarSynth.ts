/** Test helpers: Karplus-Strong guitar strums + an AnalyserNode-like dB spectrum. */

const OPEN = [40, 45, 50, 55, 59, 64];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Plucked string (Karplus-Strong with a little stretch for brightness). */
function pluck(out: Float32Array, sr: number, midi: number, start: number, amp: number, rand: () => number, detuneCents = 0) {
  const f = 440 * Math.pow(2, (midi - 69 + detuneCents / 100) / 12);
  const N = Math.max(2, Math.round(sr / f));
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = rand() * amp;
  let idx = 0;
  const s0 = Math.floor(start * sr);
  for (let n = s0; n < out.length; n++) {
    const a = buf[idx];
    const b = buf[(idx + 1) % N];
    buf[idx] = 0.996 * 0.5 * (a + b);
    out[n] += a;
    idx = (idx + 1) % N;
  }
}

export type StrumOpts = { sr?: number; seconds?: number; noise?: number; seed?: number; dir?: "D" | "U"; hum?: number; detune?: number };

/** Strum a chord shape (frets low E → high e, -1 = muted). */
export function strumFrets(frets: number[], o: StrumOpts = {}) {
  const sr = o.sr ?? 48000;
  const out = new Float32Array(Math.floor(sr * (o.seconds ?? 1.2)));
  const rand = rng(o.seed ?? 7);
  const strings = frets.map((f, i) => (f < 0 ? null : OPEN[i] + f)).filter((m): m is number => m !== null);
  const order = o.dir === "U" ? [...strings].reverse() : strings;
  order.forEach((m, i) => pluck(out, sr, m, 0.02 + i * 0.012, 0.3, rand, ((rand() * 2 - 1) * (o.detune ?? 8))));
  addNoise(out, sr, o.noise ?? 0, o.hum ?? 0, rand);
  return out;
}

export function singleNote(midi: number, o: StrumOpts = {}) {
  const sr = o.sr ?? 48000;
  const out = new Float32Array(Math.floor(sr * (o.seconds ?? 1)));
  const rand = rng(o.seed ?? 3);
  pluck(out, sr, midi, 0.02, 0.4, rand);
  addNoise(out, sr, o.noise ?? 0, o.hum ?? 0, rand);
  return out;
}

/** Add white noise at `noise` × signal RMS, plus optional mains hum. */
function addNoise(out: Float32Array, sr: number, noise: number, hum: number, rand: () => number) {
  let rms = 0;
  for (const v of out) rms += v * v;
  rms = Math.sqrt(rms / out.length);
  for (let n = 0; n < out.length; n++) out[n] += rand() * noise * rms * 1.7 + hum * rms * Math.sin((2 * Math.PI * 50 * n) / sr);
}

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** Like AnalyserNode.getFloatFrequencyData: Blackman window, |X|/N in dB, frame ending at `endSample`. */
export function analyserDb(sig: Float32Array, endSample: number, fftSize: number) {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const start = endSample - fftSize;
  for (let i = 0; i < fftSize; i++) {
    const x = start + i >= 0 && start + i < sig.length ? sig[start + i] : 0;
    const a = 0.16;
    const w = (1 - a) / 2 - 0.5 * Math.cos((2 * Math.PI * i) / fftSize) + (a / 2) * Math.cos((4 * Math.PI * i) / fftSize);
    re[i] = x * w;
  }
  fft(re, im);
  const out = new Float32Array(fftSize / 2);
  for (let k = 0; k < fftSize / 2; k++) out[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / fftSize + 1e-12);
  return out;
}
