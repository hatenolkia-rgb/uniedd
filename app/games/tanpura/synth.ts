// Tanpura string synthesis — pure JS so every key and tuning is exact.
// Additive model of a jawari-bridge string: harmonic partials whose energy
// "blooms" upward then settles (the jawari sweep), slow beating between two
// string polarisations, a one-sided bridge-contact buzz and a soft finger pluck.
// The waveform stays strictly periodic, so the pitch is exactly `freq`.

export type PluckOpts = {
  sampleRate: number;
  /** Seconds of audio to render. */
  duration: number;
  /** 0..1 jawari (buzz / bloom) amount. */
  jawari: number;
  /** 0 = mellow male tanpura, 1 = brighter, lighter female tanpura. */
  brightness: number;
  /** Base decay time in seconds (amplitude e-folding of the fundamental). */
  decay: number;
  seed?: number;
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLOCK = 32;

export function renderPluck(freq: number, o: PluckOpts): Float32Array {
  const sr = o.sampleRate;
  const n = Math.max(1, Math.round(o.duration * sr));
  const out = new Float32Array(n);
  const rnd = mulberry32(o.seed ?? 1);
  const nyq = sr / 2;
  const maxK = Math.max(1, Math.min(Math.floor((nyq * 0.9) / freq), freq < 150 ? 64 : 48));
  const J = Math.max(0, Math.min(1, o.jawari));
  const B = Math.max(0, Math.min(1, o.brightness));
  const tilt = 0.85 - 0.25 * B; // spectral slope
  const pluckPos = 0.11 + 0.03 * rnd(); // finger pluck position along the string

  // Partials: two slightly detuned polarisations per harmonic (equal weights,
  // mirrored detune) so the average pitch stays exactly k*freq.
  type P = { k: number; amp: number; tau: number; c: number; s: number; dc: number; ds: number; beat: number; bphase: number };
  const parts: P[] = [];
  for (let k = 1; k <= maxK; k++) {
    const comb = Math.abs(Math.sin(Math.PI * k * pluckPos)) * 0.8 + 0.2;
    const amp = comb / Math.pow(k, tilt) * (k === 1 ? 1.0 : 1);
    const tau = o.decay / (1 + 0.045 * k * (1 + B));
    const w = (2 * Math.PI * k * freq) / sr;
    const ph = rnd() * 2 * Math.PI;
    parts.push({
      k, amp, tau,
      c: Math.cos(ph), s: Math.sin(ph), dc: Math.cos(w), ds: Math.sin(w),
      beat: (0.08 + 0.25 * rnd()) * (1 + k * 0.02), bphase: rnd() * 2 * Math.PI,
    });
  }

  // Jawari sweep: a spectral bump that climbs from harmonic ~3 to ~(6+22J) and slowly falls back.
  const sweepPeak = 4 + 22 * J;
  const sweepRise = 0.35 + 0.5 * (1 - J);
  const env = new Float32Array(parts.length);
  const envNext = new Float32Array(parts.length);
  const attack = Math.round(0.012 * sr);

  const amps = (t: number, dst: Float32Array) => {
    const rise = 1 - Math.exp(-t / sweepRise);
    const fall = Math.exp(-t / (o.decay * 1.4));
    const center = 2 + (sweepPeak - 2) * rise * fall;
    const width = 2.2 + 3 * J + center * 0.25;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const d = (p.k - center) / width;
      const bloom = 1 + J * 2.6 * Math.exp(-0.5 * d * d) * Math.min(1, t * 8);
      // the jawari slightly mutes the very first instant of upper partials
      const onset = p.k > 3 ? 1 - (0.55 * J) * Math.exp(-t / 0.05) : 1;
      dst[i] = p.amp * Math.exp(-t / p.tau) * bloom * onset * (1 + 0.32 * Math.sin(2 * Math.PI * p.beat * t + p.bphase));
    }
  };

  amps(0, env);
  for (let b = 0; b < n; b += BLOCK) {
    const len = Math.min(BLOCK, n - b);
    amps((b + len) / sr, envNext);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const a0 = env[i];
      const da = (envNext[i] - a0) / len;
      let c = p.c, s = p.s;
      const dc = p.dc, ds = p.ds;
      let a = a0;
      for (let j = 0; j < len; j++) {
        out[b + j] += a * s;
        const nc = c * dc - s * ds;
        s = s * dc + c * ds;
        c = nc;
        a += da;
      }
      // renormalise the rotating phasor to stop drift
      const m = 1 / Math.hypot(c, s);
      p.c = c * m;
      p.s = s * m;
      env[i] = envNext[i];
    }
  }

  // Normalise, add a gentle saturating buzz (keeps periodicity), soft pluck attack and tail fade.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const drive = 1 + 2.2 * J;
  const norm = peak > 0 ? 1 / peak : 1;
  const tn = Math.tanh(drive);
  const fadeLen = Math.min(n, Math.round(0.4 * sr));
  // One-sided bridge contact: when the string swings past the curved jawari bridge it
  // grazes it, clipping that side of the wave. The clipped part (differentiated, i.e.
  // its sharp edges) is the characteristic buzz. It depends on the string's amplitude,
  // so the buzz evolves and thins out as the note decays, as on a real tanpura.
  // It is a memoryless function of a periodic signal (+ a first difference), so the pitch stays exact.
  const theta = 0.16;
  const buzzAmt = 2.4 * J;
  let prevC = 0;
  for (let i = 0; i < n; i++) {
    const v = out[i] * norm;
    const contact = v > theta ? v - theta : 0;
    const buzz = (contact - prevC) * buzzAmt * 4;
    prevC = contact;
    let x = Math.tanh((v - contact * 0.7 * J) * drive) / tn + buzz;
    if (i < attack) x *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attack);
    if (i >= n - fadeLen) x *= 0.5 + 0.5 * Math.cos((Math.PI * (i - (n - fadeLen))) / fadeLen);
    out[i] = x * 0.9;
  }
  let pk2 = 0;
  for (let i = 0; i < n; i++) pk2 = Math.max(pk2, Math.abs(out[i]));
  if (pk2 > 0.9) for (let i = 0; i < n; i++) out[i] *= 0.9 / pk2;
  return out;
}

/** Short bright pluck for the swarmandal shimmer. */
export function renderSwarmandal(freq: number, sampleRate: number, seed = 7): Float32Array {
  return renderPluck(freq, { sampleRate, duration: 2.4, jawari: 0.15, brightness: 1, decay: 0.9, seed });
}

/** Estimate the fundamental frequency of a periodic signal (FFT peak near `guess`, refined by parabolic interpolation). Used by tests/QA. */
export function estimatePitch(x: Float32Array, sampleRate: number, guess: number, from = 0.3, len = 2.5): number {
  const start = Math.round(from * sampleRate);
  const N = 1 << Math.ceil(Math.log2(Math.min(x.length - start, Math.round(len * sampleRate))));
  const seg = new Float64Array(N);
  for (let i = 0; i < N && start + i < x.length; i++) seg[i] = x[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  // zero-pad 4x for resolution and evaluate a DFT only around the guess (Goertzel-style scan)
  const M = N * 4;
  const binHz = sampleRate / M;
  const lo = Math.floor((guess * 0.9) / binHz);
  const hi = Math.ceil((guess * 1.1) / binHz);
  const mags: number[] = [];
  for (let b = lo; b <= hi; b++) {
    const w = (2 * Math.PI * b) / M;
    let re = 0, im = 0;
    const cw = Math.cos(w), sw = Math.sin(w);
    let c = 1, s = 0;
    for (let i = 0; i < N; i++) {
      re += seg[i] * c;
      im -= seg[i] * s;
      const nc = c * cw - s * sw;
      s = s * cw + c * sw;
      c = nc;
    }
    mags.push(Math.log(1e-12 + re * re + im * im));
  }
  let bi = 1;
  for (let i = 1; i < mags.length - 1; i++) if (mags[i] > mags[bi]) bi = i;
  const a = mags[bi - 1], bm = mags[bi], cm = mags[bi + 1];
  const delta = (0.5 * (a - cm)) / (a - 2 * bm + cm || 1);
  return (lo + bi + delta) * binHz;
}
