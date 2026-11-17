// Karaoke Maker — pure audio helpers (no DOM), unit-tested in tests/karaoke.test.ts.

export const SAMPLE_RATE = 44100;
export const MIN_SEMITONES = -12;
export const MAX_SEMITONES = 12;
/** Songs longer than this get a "may be slow / run out of memory" warning. */
export const LONG_SONG_SECONDS = 10 * 60;
/** Hard limit — beyond this most browsers run out of memory. */
export const MAX_SONG_SECONDS = 30 * 60;

export function clampSemitones(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(MIN_SEMITONES, Math.min(MAX_SEMITONES, Math.round(n)));
}

/** Frequency ratio for a shift of n semitones (equal temperament). */
export function pitchRatio(semitones: number): number {
  return 2 ** (semitones / 12);
}

function stepsText(abs: number): string {
  const whole = Math.floor(abs / 2);
  const half = abs % 2 === 1;
  if (whole === 0) return "½ step";
  return `${whole}${half ? "½" : ""} ${whole === 1 && !half ? "whole step" : "whole steps"}`;
}

/** "+2 = 1 whole step up", "−1 = ½ step down", "+12 = 1 octave up", "0 = original key". */
export function semitoneLabel(n: number): string {
  const s = clampSemitones(n);
  if (s === 0) return "0 = original key";
  const sign = s > 0 ? "+" : "−";
  const dir = s > 0 ? "up" : "down";
  const abs = Math.abs(s);
  const desc = abs === 12 ? "1 octave" : stepsText(abs);
  return `${sign}${abs} = ${desc} ${dir}`;
}

// ---------------------------------------------------------------------------
// Quick mode: centre-channel cancellation that keeps the low end.
// Vocals are usually mixed dead centre, so the mid signal (L+R)/2 above the
// bass range is treated as the "vocal" part. Bass and kick (also centre, but
// low) are kept by splitting the mid with a complementary crossover.

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

function lowpassBiquad(freq: number, sr: number): Biquad {
  const w = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2); // Butterworth Q = 0.7071
  const a0 = 1 + alpha;
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function runBiquad(x: Float32Array, c: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

export type Stereo = { left: Float32Array; right: Float32Array };

/**
 * Estimate the vocal (centre, above `keepBelowHz`) part of a stereo mix.
 * karaoke = mix − vocals keeps the sides plus the centre bass.
 */
export function quickVocals(left: Float32Array, right: Float32Array, keepBelowHz = 150, sr = SAMPLE_RATE): Stereo {
  const n = Math.min(left.length, right.length);
  const mid = new Float32Array(n);
  for (let i = 0; i < n; i++) mid[i] = (left[i] + right[i]) * 0.5;
  const lp = lowpassBiquad(keepBelowHz, sr);
  // Two Butterworth stages = 4th-order Linkwitz–Riley low-pass.
  const low = runBiquad(runBiquad(mid, lp), lp);
  const voc = new Float32Array(n);
  for (let i = 0; i < n; i++) voc[i] = mid[i] - low[i];
  return { left: voc, right: voc };
}

/** Ratio of side to mid energy — near 0 means the file is (almost) mono. */
export function stereoWidth(left: Float32Array, right: Float32Array): number {
  let em = 0, es = 0;
  const step = Math.max(1, Math.floor(left.length / 400000));
  for (let i = 0; i < left.length; i += step) {
    const m = left[i] + right[i];
    const s = left[i] - right[i];
    em += m * m;
    es += s * s;
  }
  return em > 0 ? es / em : 0;
}

/** out = original − (1 − vocalLevel) · vocals, i.e. vocalLevel 0 = full karaoke, 1 = original. */
export function mixKaraoke(orig: Stereo, vocals: Stereo, vocalLevel: number): Stereo {
  const k = 1 - Math.max(0, Math.min(1, vocalLevel));
  const n = orig.left.length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    left[i] = orig.left[i] - k * vocals.left[i];
    right[i] = orig.right[i] - k * vocals.right[i];
  }
  return { left, right };
}

/** Scale down (never up) so the peak stays below 0.99. Returns the gain used. */
export function preventClipping(s: Stereo): number {
  let peak = 0;
  for (const ch of [s.left, s.right]) for (let i = 0; i < ch.length; i++) {
    const a = Math.abs(ch[i]);
    if (a > peak) peak = a;
  }
  if (peak <= 0.99) return 1;
  const g = 0.99 / peak;
  for (const ch of [s.left, s.right]) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  return g;
}

// ---------------------------------------------------------------------------
// WAV encoding (16-bit PCM stereo).

export function encodeWav(s: Stereo, sr = SAMPLE_RATE): Blob {
  const n = s.left.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 4, true);
  const out = new Int16Array(buf, 44, n * 2);
  for (let i = 0; i < n; i++) {
    out[2 * i] = toInt16(s.left[i]);
    out[2 * i + 1] = toInt16(s.right[i]);
  }
  return new Blob([buf], { type: "audio/wav" });
}

export function toInt16(x: number): number {
  const c = x > 1 ? 1 : x < -1 ? -1 : x;
  return c < 0 ? Math.round(c * 32768) : Math.round(c * 32767);
}

export function floatToInt16(x: Float32Array, from = 0, to = x.length): Int16Array {
  const out = new Int16Array(to - from);
  for (let i = from; i < to; i++) out[i - from] = toInt16(x[i]);
  return out;
}

// ---------------------------------------------------------------------------
// Key detection (Krumhansl–Kessler profiles on a chromagram).

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NAMES_MAJOR = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const NAMES_MINOR = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];

export type MusicKey = { tonic: number; mode: "major" | "minor"; confidence: number };

export function keyName(k: MusicKey, shift = 0): string {
  const t = (((k.tonic + shift) % 12) + 12) % 12;
  return `${(k.mode === "major" ? NAMES_MAJOR : NAMES_MINOR)[t]} ${k.mode}`;
}

function fftInPlace(re: Float64Array, im: Float64Array) {
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
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
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

function correlate(a: number[], b: number[]): number {
  const ma = a.reduce((x, y) => x + y, 0) / 12;
  const mb = b.reduce((x, y) => x + y, 0) / 12;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Chroma (12 pitch-class energies) of a mono signal, sampling at most ~maxFrames frames. */
export function chroma(mono: Float32Array, sr = SAMPLE_RATE, maxFrames = 240): number[] {
  const N = 8192;
  const out = new Array(12).fill(0);
  if (mono.length < N) return out;
  const frames = Math.floor(mono.length / N);
  const step = Math.max(1, Math.floor(frames / maxFrames));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const kMin = Math.ceil((55 * N) / sr);
  const kMax = Math.floor((2000 * N) / sr);
  const pcOfBin: number[] = [];
  for (let k = 0; k <= kMax; k++) {
    const f = (k * sr) / N;
    pcOfBin[k] = k < kMin ? -1 : ((Math.round(12 * Math.log2(f / 440)) + 9) % 12 + 12) % 12;
  }
  for (let f = 0; f < frames; f += step) {
    const off = f * N;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const s = mono[off + i];
      re[i] = s * win[i];
      im[i] = 0;
      e += s * s;
    }
    if (e / N < 1e-6) continue; // silence
    fftInPlace(re, im);
    const frame = new Array(12).fill(0);
    let tot = 0;
    for (let k = kMin; k <= kMax; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      frame[pcOfBin[k]] += m;
      tot += m;
    }
    if (tot > 0) for (let p = 0; p < 12; p++) out[p] += frame[p] / tot;
  }
  return out;
}

export function detectKey(mono: Float32Array, sr = SAMPLE_RATE): MusicKey | null {
  const c = chroma(mono, sr);
  if (c.every((v) => v === 0)) return null;
  const scores: MusicKey[] = [];
  for (let t = 0; t < 12; t++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - t + 12) % 12]);
    scores.push({ tonic: t, mode: "major", confidence: correlate(c, rot(MAJOR)) });
    scores.push({ tonic: t, mode: "minor", confidence: correlate(c, rot(MINOR)) });
  }
  scores.sort((a, b) => b.confidence - a.confidence);
  return scores[0].confidence > 0.5 ? scores[0] : null;
}

export function toMono(s: Stereo): Float32Array {
  const m = new Float32Array(s.left.length);
  for (let i = 0; i < m.length; i++) m[i] = (s.left[i] + s.right[i]) * 0.5;
  return m;
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1e6)} MB`;
}

/** "My Song.mp3" → "My Song (karaoke, +2)" */
export function outputName(fileName: string, opts: { karaoke: boolean; semitones: number }): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, " ").trim() || "song";
  const parts: string[] = [];
  if (opts.karaoke) parts.push("karaoke");
  if (opts.semitones) parts.push(opts.semitones > 0 ? `+${opts.semitones}` : `${opts.semitones}`);
  return parts.length ? `${base} (${parts.join(", ")})` : base;
}
