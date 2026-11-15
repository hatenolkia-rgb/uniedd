/**
 * Pitch detection for the microphone mode (one note at a time).
 * YIN (de Cheveigné & Kawahara, 2002): difference function → cumulative-mean-normalised
 * difference → first dip under the threshold → parabolic interpolation.
 */

export type PitchResult = { freq: number; clarity: number; rms: number };

export function yin(
  buf: Float32Array,
  sampleRate: number,
  { minFreq = 60, maxFreq = 2200, threshold = 0.15 }: { minFreq?: number; maxFreq?: number; threshold?: number } = {},
): PitchResult | null {
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const W = buf.length - maxTau;
  if (W < 64 || maxTau <= minTau) return null;
  let energy = 0;
  for (let i = 0; i < W; i++) energy += buf[i] * buf[i];
  const rms = Math.sqrt(energy / W);
  if (rms < 0.002) return null;

  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      s += diff * diff;
    }
    d[tau] = s;
  }
  // cumulative mean normalised difference
  const c = new Float32Array(maxTau + 1);
  c[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    run += d[tau];
    c[tau] = run > 0 ? (d[tau] * tau) / run : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (c[t] < threshold) {
      while (t + 1 <= maxTau && c[t + 1] < c[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // no dip under the threshold: take the global minimum if it is still fairly periodic
    let best = minTau;
    for (let t = minTau; t <= maxTau; t++) if (c[t] < c[best]) best = t;
    if (c[best] > threshold * 2) return null;
    tau = best;
  }
  let refined = tau;
  if (tau > 1 && tau < maxTau) {
    const a = c[tau - 1];
    const b = c[tau];
    const e = c[tau + 1];
    const den = a + e - 2 * b;
    if (Math.abs(den) > 1e-12) refined = tau + (a - e) / (2 * den);
  }
  const freq = sampleRate / refined;
  if (freq < minFreq * 0.97 || freq > maxFreq * 1.03) return null;
  return { freq, clarity: 1 - c[tau], rms };
}

/** Nearest MIDI note and how far off it is in cents (A4 = 440 Hz = MIDI 69). */
export function freqToMidi(freq: number, a4 = 440): { midi: number; cents: number } {
  const exact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(exact);
  return { midi, cents: Math.round((exact - midi) * 100) };
}

export const midiToFreq = (m: number, a4 = 440) => a4 * Math.pow(2, (m - 69) / 12);

/**
 * Does a heard note count for an expected note? Exact match always does. With
 * `octaveTolerant` (mic mode) the same note name one octave up or down also counts,
 * because a microphone often hears a piano note's strong overtone as the "pitch".
 */
export function pitchMatches(heard: number, expected: number, octaveTolerant: boolean) {
  if (heard === expected) return true;
  return octaveTolerant && Math.abs(heard - expected) === 12;
}
