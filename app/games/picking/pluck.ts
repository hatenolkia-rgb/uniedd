/**
 * "Was that a guitar string?" — onset analysis for the picking & strumming game.
 *
 * Given a short stretch of raw microphone samples around a detected onset, decide whether
 * it sounds like a plucked/strummed string and (for single notes) which pitch it rang at.
 *
 * A plucked string has: a sharp attack (a few ms), then a steady decay with no swell, a
 * stable pitch right after the attack, and a tone that gets darker as it rings (high
 * harmonics die first). A voice has a slow onset, sustains or swells, glides and wobbles
 * in pitch (vibrato) and keeps the same brightness (formants). Claps, taps and speech
 * consonants are broadband bursts with no clear pitch and no ringing tail.
 *
 * Pure functions, no DOM, so they can be unit-tested with synthesized and recorded audio.
 */

export type PluckKind = "note" | "strum";

export type PluckVerdict = {
  ok: boolean;
  /** Why it was rejected ("" when ok). */
  reason: "" | "quiet" | "slow-attack" | "swell" | "no-decay" | "no-ring" | "no-pitch" | "unstable-pitch" | "no-darkening" | "noisy" | "voice";
  /** Fundamental frequency (Hz) for single notes. */
  f0: number | null;
  /** Fractional MIDI note number for `f0`. */
  midi: number | null;
  /** Diagnostics. */
  riseMs: number;
  jump: number;
  decay: number;
  wobbleCents: number;
  aperiodicity: number;
  darkening: number;
  windowMs: number;
};

export const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

/** "A2" for 45. */
export function noteLabel(midi: number) {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** Which open string a MIDI note is (for "Play the A string"). */
export function stringName(midi: number) {
  const names: Record<number, string> = { 40: "low E", 45: "A", 50: "D", 55: "G", 59: "B", 64: "high e" };
  return names[midi] ?? noteLabel(midi);
}

/**
 * Does `f0` hit `targetMidi` (same note AND same octave) within `tolCents`?
 * Returns the error in cents and whether only the octave or tuning is off.
 */
export function matchTarget(f0: number, targetMidi: number, tolCents = 50) {
  const cents = 1200 * Math.log2(f0 / midiToFreq(targetMidi));
  const ok = Math.abs(cents) <= tolCents;
  const nearestOctaves = Math.round(cents / 1200);
  const octaveOff = !ok && nearestOctaves !== 0 && Math.abs(cents - nearestOctaves * 1200) <= tolCents;
  const samePc = Math.round(cents / 100) % 12 === 0;
  return { ok, cents, octaveOff, samePc };
}

// ---------------------------------------------------------------- primitives

/** RMS envelope, one value per `hop` samples (window = 2 hops). */
export function envelope(x: Float32Array, hop: number) {
  const n = Math.max(0, Math.floor((x.length - 2 * hop) / hop) + 1);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const a = i * hop;
    for (let j = a; j < a + 2 * hop; j++) s += x[j] * x[j];
    env[i] = Math.sqrt(s / (2 * hop));
  }
  return env;
}

/** Halve the sample rate (2-tap average) to make pitch tracking cheaper. */
function decimate2(x: Float32Array, from: number, to: number) {
  const n = Math.max(0, Math.floor((to - from) / 2));
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = 0.5 * (x[from + 2 * i] + x[from + 2 * i + 1]);
  return y;
}

/**
 * YIN pitch estimate of x[start .. start+W) (plus lag). Returns f0 and the aperiodicity
 * (cumulative-mean-normalised difference at the chosen lag: ~0 = perfectly periodic, ~1 = noise).
 */
export function yin(x: Float32Array, start: number, W: number, sr: number, fmin = 70, fmax = 1100, threshold = 0.15) {
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const tauMax = Math.min(Math.ceil(sr / fmin), x.length - start - W - 1);
  if (tauMax <= tauMin + 2) return null;
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const v = x[start + j] - x[start + j + tau];
      s += v * v;
    }
    d[tau] = s;
  }
  const cm = new Float32Array(tauMax + 2);
  cm[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    run += d[tau];
    cm[tau] = run > 0 ? (d[tau] * tau) / run : 1;
  }
  let best = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cm[tau] < threshold) {
      while (tau + 1 <= tauMax && cm[tau + 1] < cm[tau]) tau++;
      best = tau;
      break;
    }
  }
  if (best > 0) {
    // the true period is the deepest dip nearby (a shallow neighbouring dip can cross first)
    let b2 = best;
    for (let tau = Math.max(tauMin, Math.floor(best * 0.92)); tau <= Math.min(tauMax, Math.ceil(best * 1.08)); tau++) if (cm[tau] < cm[b2]) b2 = tau;
    best = b2;
  }
  if (best < 0) {
    let mv = Infinity;
    for (let tau = tauMin; tau <= tauMax; tau++) if (cm[tau] < mv) {
      mv = cm[tau];
      best = tau;
    }
  }
  if (best <= tauMin - 1 || best >= tauMax) return { f0: sr / Math.max(best, 1), ap: 1 };
  const a = cm[best - 1];
  const b = cm[best];
  const c = cm[best + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? Math.max(-1, Math.min(1, (0.5 * (a - c)) / den)) : 0;
  return { f0: sr / (best + shift), ap: Math.max(0, b) };
}

/** In-place radix-2 FFT. */
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

/** Power spectrum (Hann window) of x[start .. start+n), zero-padded to `size` (powers of two). */
function powerSpectrum(x: Float32Array, start: number, n: number, size = n) {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < n; i++) {
    const v = x[start + i] ?? 0;
    re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  fft(re, im);
  const p = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return p;
}

/** Spectral centroid of bins within 40 dB of the loudest one (ignores the hiss floor). */
function gatedCentroid(p: Float64Array, sr: number, n: number, lo = 60, hi = 5000) {
  const a = Math.floor((lo * n) / sr);
  const b = Math.min(p.length - 1, Math.ceil((hi * n) / sr));
  let mx = 0;
  for (let i = a; i <= b; i++) mx = Math.max(mx, p[i]);
  let num = 0;
  let den = 0;
  for (let i = a; i <= b; i++) if (p[i] > mx * 1e-4) {
    const m = Math.sqrt(p[i]);
    num += m * ((i * sr) / n);
    den += m;
  }
  return den > 0 ? num / den : 0;
}

/** Spectral flatness (0 = pure tones, ~0.5+ = noise) of the power spectrum between lo and hi. */
function flatness(p: Float64Array, sr: number, n: number, lo = 80, hi = 2000) {
  const a = Math.floor((lo * n) / sr);
  const b = Math.min(p.length - 1, Math.ceil((hi * n) / sr));
  let logSum = 0;
  let sum = 0;
  let k = 0;
  for (let i = a; i <= b; i++) {
    const v = p[i] + 1e-14;
    logSum += Math.log(v);
    sum += v;
    k++;
  }
  return k ? Math.exp(logSum / k) / (sum / k) : 1;
}

function median(v: number[]) {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const mean = (a: Float32Array, from: number, to: number) => {
  let s = 0;
  let n = 0;
  for (let i = Math.max(0, from); i < Math.min(a.length, to); i++, n++) s += a[i];
  return n ? s / n : 0;
};

// ---------------------------------------------------------------- the verdict

export type AnalyzeOpts = {
  kind: PluckKind;
  /** Minimum peak RMS (raw input units) — below this is treated as silence. */
  minLevel?: number;
  /** Sample index where the next onset starts (the window stops there). */
  end?: number;
};

/**
 * Analyse raw samples `x` (sample rate `sr`) around an onset near sample `hint`.
 * The buffer should contain ~100 ms before the onset and ≥ 200 ms after it.
 */
export function analyzeOnset(x: Float32Array, sr: number, hint: number, opts: AnalyzeOpts): PluckVerdict {
  const strum = opts.kind === "strum";
  const hop = Math.max(1, Math.round(sr * 0.005));
  const ms = (frames: number) => frames * 5;
  const env = envelope(x, hop);
  const out: PluckVerdict = { ok: false, reason: "quiet", f0: null, midi: null, riseMs: 0, jump: 0, decay: 1, wobbleCents: 0, aperiodicity: 1, darkening: 1, windowMs: 0 };
  if (env.length < 30) return out;

  // Smoothed envelope (25 ms) for level checks: low strings ripple at their own period.
  const envS = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    let sum = 0;
    let k = 0;
    for (let j = i - 2; j <= i + 2; j++) if (j >= 0 && j < env.length) {
      sum += env[j];
      k++;
    }
    envS[i] = sum / k;
  }

  // 1. Attack: the loudest frame near the hint, and how fast the level got there.
  const hf = Math.round(hint / hop);
  let P = -1;
  let peak = 0;
  // (a strum's strings come one after another: look further and on the smoothed level)
  const pk = strum ? envS : env;
  for (let i = Math.max(0, hf - 4); i <= Math.min(env.length - 1, hf + (strum ? 30 : 16)); i++) if (pk[i] > peak) {
    peak = pk[i];
    P = i;
  }
  if (P < 0 || peak < (opts.minLevel ?? 0.002)) return out;
  if (strum) {
    for (let i = Math.max(0, P - 2); i <= Math.min(env.length - 1, P + 2); i++) if (env[i] > env[P]) P = i;
    peak = env[P];
  }
  let A = P;
  let pre = peak;
  for (let i = P; i >= Math.max(0, P - 20); i--) if (env[i] < pre) {
    pre = env[i];
    A = i;
  }
  const base = Math.max(pre * 1.5, peak * 0.15);
  let S = A;
  while (S < P && env[S] <= base) S++;
  let R = S;
  while (R < P && env[R] < peak * 0.7) R++;
  out.riseMs = ms(R - S + 1);
  out.jump = peak / Math.max(pre, 1e-6);
  // The same jump on a pre-emphasised signal: a pick attack is bright even when the
  // previous note is still ringing loudly underneath.
  const hp = new Float32Array(x.length);
  for (let i = 1; i < x.length; i++) hp[i] = x[i] - 0.9 * x[i - 1];
  const envH = envelope(hp, hop);
  let peakH = 0;
  for (let i = Math.max(0, hf - 4); i <= Math.min(envH.length - 1, hf + 8); i++) peakH = Math.max(peakH, envH[i]);
  let preH = Infinity;
  for (let i = Math.max(0, hf - 12); i < Math.max(1, hf - 2); i++) preH = Math.min(preH, envH[i]);
  const jumpH = peakH / Math.max(Number.isFinite(preH) ? preH : 0, 1e-6);

  // 2. Usable window: until the next onset (fast picking) or the end of the buffer.
  let end = env.length - 1;
  if (opts.end !== undefined) end = Math.min(end, Math.floor(opts.end / hop) - 2);
  let runMin = peak;
  // (a strum is several strings in a row: the first ~150 ms belong to the same strum)
  for (let j = P + (strum ? 30 : 6); j < end; j++) {
    runMin = Math.min(runMin, envS[j]);
    if (envS[j] > runMin * 2 && envS[j] > envS[j - 2] * 1.4 && envS[j] > peak * 0.25) {
      end = Math.max(P + 6, j - 2);
      break;
    }
  }
  end = Math.max(end, P + 1);
  const W = end - P;
  out.windowMs = ms(W);
  // need enough ringing to judge: ~60 ms for a picked note, ~120 ms for a strum
  if (W < (strum ? 24 : 12)) return { ...out, reason: "no-ring" };

  if (out.riseMs > (strum ? 80 : 40) || (strum ? out.jump < 4 && jumpH < 4 : out.jump < 1.5 && jumpH < 3)) return { ...out, reason: "slow-attack" };
  // A new pluck must rise above what was ringing just before (not just recover from a brief
  // dip — the pick damping a string, a tremolo or a glitch): compare with the typical level
  // over the 15–100 ms before the onset.
  const med = (a: Float32Array, from: number, to: number) => {
    const v = Array.from(a.subarray(Math.max(0, from), Math.max(0, to))).sort((p, q) => p - q);
    return v.length ? v[v.length >> 1] : 0;
  };
  const ringBefore = med(envS, hf - 20, hf - 3);
  const ringBeforeH = med(envH, hf - 20, hf - 3);
  if (peak < ringBefore * RESTRIKE && peakH < ringBeforeH * RESTRIKE_H) return { ...out, reason: "slow-attack" };

  // 3. No swell: after the attack the (smoothed) level only goes down, give or take a ripple.
  let atk = 0;
  for (let i = Math.max(0, P - 1); i <= Math.min(end, P + 2); i++) atk = Math.max(atk, envS[i]);
  let maxAfter = 0;
  for (let i = P + 3; i <= end; i++) maxAfter = Math.max(maxAfter, envS[i]);
  if (maxAfter > atk * 1.12) return { ...out, reason: "swell" };
  const blk = 4;
  let prev = mean(envS, P + 2, P + 2 + blk);
  for (let b = P + 2 + blk; b + blk <= end; b += blk) {
    const cur = mean(envS, b, b + blk);
    if (cur > prev * (strum ? 1.3 : 1.18) && cur > peak * 0.05) return { ...out, reason: "swell" };
    prev = Math.min(prev, cur);
  }

  // 4. It keeps ringing (claps/taps die away almost at once) …
  if (W >= 20) {
    const ring = mean(envS, P + 12, P + 20) / Math.max(atk, 1e-9);
    if (ring < 0.05) return { ...out, reason: "no-ring" };
  }
  // … and it decays (a held voice note does not).
  if (W >= 24) {
    const early = mean(envS, P + 3, P + 11);
    const late = mean(envS, end - 8, end);
    out.decay = late / Math.max(early, 1e-9);
    if (out.decay > 0.95) return { ...out, reason: "no-decay" };
    // a ringing string does not vanish within a quarter of a second (a word ending does)
    if (out.decay < (strum ? 0.35 : 0.05)) return { ...out, reason: "no-ring" };
  }

  // 5. Pitch track after the attack: periodic, stable (no glide, no vibrato).
  const dec = decimate2(x, (P + 6) * hop, Math.min(x.length, (end + 2) * hop));
  const sr2 = sr / 2;
  const yinW = Math.round(sr2 * 0.03);
  const step = Math.round(sr2 * 0.01);
  const lag = Math.ceil(sr2 / 70);
  const track: { f0: number; ap: number }[] = [];
  for (let s = 0; s + yinW + lag + 2 < dec.length; s += step) {
    const r = yin(dec, s, yinW, sr2);
    if (r) track.push(r);
  }
  const aps = track.map((t) => t.ap);
  out.aperiodicity = track.length ? median(aps) : 1;

  if (!strum) {
    if (track.length < 1) return { ...out, reason: "no-pitch" };
    const voiced = track.filter((t) => t.ap < 0.25);
    if (voiced.length < Math.max(1, Math.ceil(track.length * 0.7)) || out.aperiodicity > 0.18) {
      // Another string may still be ringing (a string hop): look only at what the attack
      // ADDED to the spectrum, and require the same pitch in two windows.
      if (out.jump >= 6 || out.aperiodicity > 0.6 || jumpH < 3) return { ...out, reason: "no-pitch" };
      const onset = S * hop;
      const n4 = 4096;
      const a0 = (P + 6) * hop;
      const a1 = a0 + Math.round(0.06 * sr);
      const p1 = newestPitch(x, sr, onset, a0, n4);
      const p2 = a1 + n4 <= (end + 2) * hop ? newestPitch(x, sr, onset, a1, n4) : null;
      if (!p1 || !p2 || p1.growth < 2 || Math.abs(1200 * Math.log2(p2.f0 / p1.f0)) > 30) return { ...out, reason: "no-pitch" };
      out.f0 = p1.f0;
      out.midi = freqToMidi(p1.f0);
      out.wobbleCents = Math.abs(1200 * Math.log2(p2.f0 / p1.f0));
      // with two sounds mixed, also insist that the tone darkens like a string
      return finishNote(out, x, sr, P, end, hop, true);
    }
    // pitch from the clearly periodic frames (a few borderline frames can be off by a bit)
    const clean = voiced.filter((t) => t.ap < 0.12);
    const use = clean.length >= 2 ? clean : voiced;
    const f0 = median(use.map((t) => t.f0));
    const devs = use.map((t) => Math.abs(1200 * Math.log2(t.f0 / f0))).sort((a, b) => a - b);
    // allow one stray frame
    out.wobbleCents = devs.length > 3 ? devs[devs.length - 2] : devs[devs.length - 1];
    out.f0 = f0;
    out.midi = freqToMidi(f0);
    if (out.wobbleCents > 30) return { ...out, reason: "unstable-pitch" };
  }

  if (!strum) return finishNote(out, x, sr, P, end, hop);

  // 6. Brightness: a plucked string usually gets darker as it rings, a voice keeps its
  // formants. Nylon strings can start dark, so this only decides when the attack was not
  // clearly string-fast (≥ 30 ms to full level).
  const n = 2048;
  const e0 = (P + 4) * hop;
  const e1 = (end + 1) * hop - n;
  if (e1 >= e0 + n / 4) {
    const c0 = gatedCentroid(powerSpectrum(x, e0, n), sr, n);
    const c1 = gatedCentroid(powerSpectrum(x, e1, n), sr, n);
    out.darkening = c0 > 0 ? c1 / c0 : 1;
    if ((out.riseMs >= 30 && out.darkening > 0.95) || (strum && out.darkening > 1.0)) return { ...out, reason: "no-darkening" };
    // a chord mellows as it rings; a word whose vowel closes into "-ng"/"-m" goes dull at once
    if (strum && out.darkening < 0.45) return { ...out, reason: "voice" };
  } else if (strum) return { ...out, reason: "no-ring" };

  if (strum) {
    // Tonal, not noise …
    const n2 = 4096;
    const s0 = Math.min((P + 10) * hop, Math.max(0, x.length - n2));
    if (flatness(powerSpectrum(x, s0, n2), sr, n2) > 0.3) return { ...out, reason: "noisy" };
    // … not one single clean pitch (a voice, a hum or one string is not a chord) …
    if (track.length >= 3 && out.aperiodicity < 0.05) return { ...out, reason: "voice" };
    // … and not one gliding / wobbling sung, spoken or hummed pitch.
    const voiced = track.filter((t) => t.ap < 0.25);
    if (voiced.length >= 3 && voiced.length >= track.length * 0.6) {
      const clean = voiced.filter((t) => t.ap < 0.12);
      const use = clean.length >= 3 ? clean : voiced;
      const f0 = median(use.map((t) => t.f0));
      const devs = use.map((t) => Math.abs(1200 * Math.log2(t.f0 / f0))).sort((a, b) => a - b);
      const wob = devs.length > 3 ? devs[devs.length - 2] : devs[devs.length - 1];
      if (wob > 25) return { ...out, reason: "voice", wobbleCents: wob };
    }
  }

  return { ...out, ok: true, reason: "" };
}

/** Brightness check for single notes (see step 6 in analyzeOnset), then accept. */
function finishNote(out: PluckVerdict, x: Float32Array, sr: number, P: number, end: number, hop: number, strict = false): PluckVerdict {
  const n = 2048;
  const e0 = (P + 4) * hop;
  const e1 = (end + 1) * hop - n;
  if (e1 >= e0 + n / 4) {
    const c0 = gatedCentroid(powerSpectrum(x, e0, n), sr, n);
    const c1 = gatedCentroid(powerSpectrum(x, e1, n), sr, n);
    out.darkening = c0 > 0 ? c1 / c0 : 1;
    if ((out.riseMs >= 30 && out.darkening > 0.95) || out.darkening > 1.5 || (strict && out.darkening > 0.95)) return { ...out, reason: "no-darkening" };
    // a breathy tone that doesn't get darker as it rings: a singer, not a string
    if (out.darkening > 0.95 && out.aperiodicity > 0.08) return { ...out, reason: "voice" };
  } else if (strict) return { ...out, reason: "no-pitch" };
  // A string sounds its fundamental or octave clearly; a high voice measured at a third or a
  // quarter of its pitch (an "undertone") only has every 3rd/4th harmonic.
  if (out.f0 && !missingLowHarmonics(x, sr, e0, out.f0)) return { ...out, ok: true, reason: "" };
  if (out.f0) return { ...out, reason: "voice" };
  return { ...out, ok: true, reason: "" };
}

function missingLowHarmonics(x: Float32Array, sr: number, start: number, f0: number) {
  const n = 4096;
  if (start + n > x.length) return false;
  const N = n * 4;
  const p = powerSpectrum(x, start, n, N);
  const amp = (f: number) => {
    const c = (f * N) / sr;
    const w = Math.max(2, Math.round(c * 0.02));
    let m = 0;
    for (let i = Math.max(1, Math.floor(c - w)); i <= Math.min(p.length - 2, Math.ceil(c + w)); i++) m = Math.max(m, p[i]);
    return Math.sqrt(m);
  };
  const low = Math.max(amp(f0), amp(2 * f0));
  let high = 0;
  for (let k = 3; k <= 8 && k * f0 < sr / 2 - 100; k++) high = Math.max(high, amp(k * f0));

  return low < high * 0.1;
}

/**
 * When two strings ring together (a string hop), find the pitch that was just plucked:
 * harmonic-sum candidates in the spectrum after the onset, then the one whose harmonics
 * GREW the most compared with just before the onset (the old string only decays).
 */
export function newestPitch(x: Float32Array, sr: number, onset: number, from: number, n = 4096) {
  if (onset - n < 0 || from + n > x.length) return null;
  const N = n * 4; // zero-padded for finer peak positions
  const before = powerSpectrum(x, onset - n, n, N);
  const after = powerSpectrum(x, from, n, N);
  const lo = Math.floor((70 * N) / sr);
  const hi = Math.min(after.length - 1, Math.ceil((4000 * N) / sr));
  let total = 0;
  for (let i = lo; i <= hi; i++) total += after[i];
  if (total <= 0) return null;
  // strongest bin within ±12 cents of f
  const peak = (p: Float64Array, f: number) => {
    const c = (f * N) / sr;
    const w = Math.max(1, Math.round(c * 0.007));
    let m = 0;
    for (let i = Math.max(1, Math.floor(c - w)); i <= Math.min(p.length - 2, Math.ceil(c + w)); i++) m = Math.max(m, p[i]);
    return m;
  };
  const grid: { f: number; sc: number }[] = [];
  for (let midi = 38; midi <= 80; midi += 0.125) {
    const f = midiToFreq(midi);
    let sc = 0;
    for (let k = 1; k <= 10 && k * f < 4000; k++) sc += Math.sqrt(peak(after, k * f)) / Math.sqrt(k);
    for (let k = 1; k <= 5 && (k + 0.5) * f < 4000; k++) sc -= 0.5 * Math.sqrt(peak(after, (k + 0.5) * f)) / Math.sqrt(k);
    grid.push({ f, sc });
  }
  const max = Math.max(...grid.map((g) => g.sc));
  if (!(max > 0)) return null;
  const cands = grid.filter((g, i) => g.sc >= max * 0.4 && (i === 0 || g.sc > grid[i - 1].sc) && (i === grid.length - 1 || g.sc >= grid[i + 1].sc));
  let best: { f: number; growth: number; share: number } | null = null;
  for (const c of cands) {
    let ea = 0;
    let eb = 0;
    for (let k = 1; k <= 8 && k * c.f < 4000; k++) {
      ea += peak(after, k * c.f);
      eb += peak(before, k * c.f);
    }
    const growth = ea / Math.max(eb, 1e-12);
    const share = ea / total;
    if (share >= 0.05 && (!best || growth > best.growth)) best = { f: c.f, growth, share };
  }
  if (!best || best.growth < 1.2) return null;
  // refine: parabolic interpolation on the fundamental's padded peak
  const c0 = Math.round((best.f * N) / sr);
  let at = c0;
  for (let i = c0 - 3; i <= c0 + 3; i++) if (after[i] > after[at]) at = i;
  const a = after[at - 1];
  const b = after[at];
  const c = after[at + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
  const fr = ((at + shift) * sr) / N;
  return { f0: Math.abs(1200 * Math.log2(fr / best.f)) < 40 ? fr : best.f, growth: best.growth, share: best.share };
}

/** Onsets this close after the previous one are the same strum (one string after another). */
export const STRUM_MERGE_S = 0.15;

/** A short, child-friendly label for why a sound was ignored. */
export function rejectLabel(reason: PluckVerdict["reason"]) {
  switch (reason) {
    case "slow-attack":
    case "swell":
    case "no-decay":
    case "unstable-pitch":
    case "no-darkening":
    case "voice":
      return "that sounded like a voice";
    case "no-ring":
    case "noisy":
    case "no-pitch":
      return "that wasn't a guitar string";
    default:
      return "";
  }
}

// ---------------------------------------------------------------- broadband onset tracker

/**
 * Finds sudden rises in loudness in a continuous stream of raw samples (fed in chunks).
 * Works on a pre-emphasised signal, so pick attacks stand out and hum/rumble does not.
 * Onsets are absolute sample indices; every one is then checked by `analyzeOnset`.
 */
// the noise floor creeps up slowly (~10 s) so a long ringing note is not mistaken for room noise
const FLOOR_UP = 0.0005;
const DIP = 2.5;
/** A re-pluck must rise this much above the level that was already ringing (plain / bright). */
const RESTRIKE = 1.35;
const RESTRIKE_H = 2;
export class OnsetTracker {
  private hop: number;
  private accH = 0;
  private accP = 0;
  private accN = 0;
  private prevX = 0;
  private idx = 0;
  private last = -1e12;
  private sens = 0.6;
  // two views: the bright (pre-emphasised) signal shows pick attacks even over a ringing
  // string; the plain one keeps soft low notes visible in a noisy room
  private bands = [
    { hist: [] as number[], floor: 0.002, hold: 0, holdDecay: 0.985, holdRatio: 1.15, restrike: RESTRIKE_H, sincePeak: 0 },
    { hist: [] as number[], floor: 0.002, hold: 0, holdDecay: 0.993, holdRatio: 1.25, restrike: RESTRIKE, sincePeak: 0 },
  ];
  constructor(private sr: number) {
    this.hop = Math.max(1, Math.round(sr * 0.005));
  }
  setSensitivity(s: number) {
    this.sens = Math.max(0, Math.min(1, s));
  }
  /** Feed the next chunk of samples; returns onsets (absolute sample indices) found in it. */
  push(chunk: Float32Array): number[] {
    const found: number[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const x = chunk[i];
      const y = x - 0.9 * this.prevX;
      this.prevX = x;
      this.accH += y * y;
      this.accP += x * x;
      this.accN++;
      this.idx++;
      if (this.accN < this.hop) continue;
      const es = [Math.sqrt(this.accH / this.accN), Math.sqrt(this.accP / this.accN)];
      this.accH = 0;
      this.accP = 0;
      this.accN = 0;
      const ratio = 2.5 + (1 - this.sens) * 6;
      const absMin = 0.0015 + (1 - this.sens) * 0.01;
      let hit = false;
      es.forEach((e, b) => {
        const band = this.bands[b];
        const h = band.hist;
        const thr = Math.max(band.floor * ratio, absMin);
        const recentMin = h.length ? Math.min(...h.slice(-6)) : e;
        const rising = h.length >= 2 && e > h[h.length - 1] * 1.15;
        // a new attack must clearly beat the (slowly decaying) level of what is already
        // ringing, so tremolo, beating and vibrato never re-trigger
        // …unless the level just dipped (the pick damping the ringing string before a re-pluck)
        const dip = h.length >= 4 ? Math.min(...h.slice(-4)) : Infinity;
        const holdPrev = Math.min(band.hold, dip * DIP);
        band.hold = Math.max(e, band.hold * band.holdDecay);
        // …and rise clearly above what was ringing 15–100 ms ago (not just recover from a dip)
        const ring = h.length >= 8 ? h.slice(-20, -3).sort((p, q) => p - q)[(Math.min(h.length, 20) - 3) >> 1] : 0;
        // (just after an onset the "before" level is still the silence before it: compare with
        // the attack itself instead, so a note's own wobble can't fire a second onset)
        const ref = this.idx - this.last < 0.1 * this.sr ? Math.max(ring, band.sincePeak) : ring;
        if (e > thr && e > recentMin * 2.2 && e > holdPrev * band.holdRatio && e > ref * band.restrike && rising) hit = true;
        band.sincePeak = Math.max(band.sincePeak, e);
        if (this.idx - this.last > 0.3 * this.sr || e < band.floor) {
          band.floor += (e - band.floor) * (e > band.floor ? FLOOR_UP : 0.08);
          band.floor = Math.max(0.0003, band.floor);
        }
        h.push(e);
        if (h.length > 20) h.shift();
      });
      if (hit && this.idx - this.last > 0.06 * this.sr) {
        this.last = this.idx;
        for (let b = 0; b < 2; b++) this.bands[b].sincePeak = es[b];
        found.push(this.idx - this.hop);
      }
    }
    return found;
  }
  /** Total samples consumed so far. */
  get position() {
    return this.idx;
  }
}
