/** Lightweight YIN-style pitch detector for guitar tuner and voice finder. */

export type PitchResult = { frequency: number; clarity: number } | null;

/**
 * Autocorrelation / McLeod-style pitch estimate on a time-domain buffer.
 * Returns null when signal is too quiet or unclear.
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  minFreq = 60,
  maxFreq = 1200,
): PitchResult {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return null;

  const minTau = Math.floor(sampleRate / maxFreq);
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), size - 2);

  // Difference function (YIN)
  const yin = new Float32Array(maxTau + 1);
  yin[0] = 1;
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < size - tau; i++) {
      const d = buffer[i] - buffer[i + tau];
      sum += d * d;
    }
    yin[tau] = sum;
  }

  // Cumulative mean normalized difference
  let running = 0;
  yin[0] = 1;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += yin[tau];
    yin[tau] = running === 0 ? 1 : (yin[tau] * tau) / running;
  }

  const threshold = 0.15;
  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (yin[tau] < threshold) {
      while (tau + 1 <= maxTau && yin[tau + 1] < yin[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate < 0) {
    // Fallback: absolute minimum
    let best = threshold;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (yin[tau] < best) {
        best = yin[tau];
        tauEstimate = tau;
      }
    }
    if (tauEstimate < 0) return null;
  }

  // Parabolic interpolation
  const x0 = tauEstimate > 0 ? yin[tauEstimate - 1] : yin[tauEstimate];
  const x1 = yin[tauEstimate];
  const x2 = tauEstimate + 1 <= maxTau ? yin[tauEstimate + 1] : yin[tauEstimate];
  const denom = 2 * (2 * x1 - x2 - x0);
  const betterTau = denom === 0 ? tauEstimate : tauEstimate + (x2 - x0) / denom;

  const frequency = sampleRate / betterTau;
  if (frequency < minFreq || frequency > maxFreq) return null;
  const clarity = Math.max(0, Math.min(1, 1 - yin[tauEstimate]));
  if (clarity < 0.7) return null;
  return { frequency, clarity };
}

/** Keep a rolling list of recent pitches and return a stable median when calm. */
export class PitchTracker {
  private history: number[] = [];
  private readonly maxLen: number;

  constructor(maxLen = 12) {
    this.maxLen = maxLen;
  }

  push(freq: number | null): number | null {
    if (freq == null || !Number.isFinite(freq)) return this.stable();
    this.history.push(freq);
    if (this.history.length > this.maxLen) this.history.shift();
    return this.stable();
  }

  stable(): number | null {
    if (this.history.length < 4) return null;
    const sorted = [...this.history].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    // Require relative stability
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (max / min > 1.06) return null; // ~100 cents spread
    return median;
  }

  clear() {
    this.history = [];
  }
}
