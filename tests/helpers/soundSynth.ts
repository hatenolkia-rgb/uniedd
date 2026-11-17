/**
 * Test sounds for the "is it a guitar string?" checks: a source-filter voice (speech and
 * singing), claps, taps, and a more realistic plucked string (pick noise, pitch settling,
 * body resonance, two detuned string polarisations).
 */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Two-pole resonator (formant / body mode), applied in place. */
function resonate(x: Float32Array, sr: number, f: number, bw: number, gain = 1) {
  const r = Math.exp((-Math.PI * bw) / sr);
  const a1 = 2 * r * Math.cos((2 * Math.PI * f) / sr);
  const a2 = -r * r;
  const g = (1 - r) * gain;
  let y1 = 0;
  let y2 = 0;
  const y = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    const v = g * x[n] + a1 * y1 + a2 * y2;
    y[n] = v;
    y2 = y1;
    y1 = v;
  }
  return y;
}

const VOWELS: Record<string, [number, number, number]> = {
  a: [800, 1200, 2600],
  e: [500, 1900, 2600],
  i: [300, 2300, 3000],
  o: [500, 900, 2500],
  u: [350, 800, 2400],
};

export type VoiceSeg = {
  /** f0 contour: start → end Hz (speech glides), plus vibrato. */
  f0: [number, number];
  seconds: number;
  vowel: keyof typeof VOWELS;
  attackMs?: number;
  releaseMs?: number;
  vibratoCents?: number;
  vibratoHz?: number;
  /** Consonant before the vowel. */
  consonant?: "t" | "d" | "s" | "p" | "k" | "m" | "l" | null;
  /** Amplitude curve: hold (default) or a pluck-like exponential decay (hard case). */
  decay?: number;
  amp?: number;
};

/** Glottal-pulse voice through three formants. */
export function voice(segs: VoiceSeg[], o: { sr?: number; seed?: number; gapS?: number; leadS?: number; noise?: number } = {}) {
  const sr = o.sr ?? 48000;
  const rand = rng(o.seed ?? 11);
  const total = segs.reduce((s, g) => s + g.seconds + (o.gapS ?? 0.12) + 0.1, o.leadS ?? 0.15);
  const out = new Float32Array(Math.ceil(total * sr));
  let t0 = Math.floor((o.leadS ?? 0.15) * sr);
  for (const g of segs) {
    const n = Math.floor(g.seconds * sr);
    let src = new Float32Array(n);
    let phase = 0;
    const att = ((g.attackMs ?? 60) / 1000) * sr;
    const rel = ((g.releaseMs ?? 60) / 1000) * sr;
    const vibHz = g.vibratoHz ?? 5.5;
    let jitter = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      jitter = jitter * 0.999 + rand() * 0.0008;
      const cents = (g.vibratoCents ?? 0) * Math.sin((2 * Math.PI * vibHz * i) / sr) + jitter * 1200 * 0.05;
      const f = (g.f0[0] + (g.f0[1] - g.f0[0]) * p) * Math.pow(2, cents / 1200);
      phase += f / sr;
      if (phase >= 1) phase -= 1;
      // Rosenberg-like glottal pulse derivative ≈ bright sawtooth with a soft close
      const glot = phase < 0.6 ? Math.sin((Math.PI * phase) / 0.6) ** 2 : 0;
      let a = 1;
      if (i < att) a = i / att;
      if (i > n - rel) a = Math.min(a, (n - i) / rel);
      if (g.decay) a *= Math.exp(-i / sr / g.decay);
      src[i] = (glot - 0.3) * a * (1 + rand() * 0.04) + rand() * 0.01 * a;
    }
    const [f1, f2, f3] = VOWELS[g.vowel];
    const v1 = resonate(src, sr, f1, 90, 4);
    const v2 = resonate(src, sr, f2, 110, 2.5);
    const v3 = resonate(src, sr, f3, 160, 1.2);
    src = new Float32Array(n);
    for (let i = 0; i < n; i++) src[i] = (v1[i] + v2[i] + v3[i]) * (g.amp ?? 0.6);
    // consonant
    let c0 = t0;
    if (g.consonant) {
      const cl = g.consonant;
      const len = Math.floor(sr * (cl === "s" ? 0.09 : cl === "m" || cl === "l" ? 0.07 : 0.025));
      let burst = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const e = cl === "m" || cl === "l" ? 0.3 : Math.exp(-i / (len / 3));
        burst[i] = (cl === "m" || cl === "l" ? Math.sin((2 * Math.PI * g.f0[0] * i) / sr) * 0.4 : rand()) * e * 0.5;
      }
      if (cl === "s") burst = resonate(burst, sr, 5500, 2500, 3);
      else if (cl === "t" || cl === "d") burst = resonate(burst, sr, 3500, 2000, 3);
      else if (cl === "k" || cl === "p") burst = resonate(burst, sr, 1500, 1200, 3);
      for (let i = 0; i < len && c0 + i < out.length; i++) out[c0 + i] += burst[i];
      c0 += len;
    }
    for (let i = 0; i < n && c0 + i < out.length; i++) out[c0 + i] += src[i];
    t0 = c0 + n + Math.floor((o.gapS ?? 0.12) * sr);
  }
  if (o.noise) addNoise(out, o.noise, rand);
  return out;
}

/** "down up down up" style speech: short syllables with gliding pitch. */
export function speech(words: string[], o: { sr?: number; seed?: number; f0?: number } = {}) {
  const rand = rng(o.seed ?? 5);
  const base = o.f0 ?? 130;
  const vowels: (keyof typeof VOWELS)[] = ["a", "o", "u", "e", "i"];
  const cons: VoiceSeg["consonant"][] = ["d", "t", "s", "p", "k", null, "l", "m"];
  return voice(
    words.map((_, i) => {
      const s = base * (1 + rand() * 0.15);
      return {
        f0: [s * 1.15, s * (0.85 + rand() * 0.1)] as [number, number],
        seconds: 0.18 + Math.abs(rand()) * 0.15,
        vowel: vowels[i % vowels.length],
        consonant: cons[(i * 3) % cons.length],
        attackMs: 15 + Math.abs(rand()) * 30,
        releaseMs: 40,
      };
    }),
    { sr: o.sr, seed: o.seed, gapS: 0.08 },
  );
}

/** Singing one note, e.g. a child singing the target note. */
export function sing(midi: number, o: Partial<VoiceSeg> & { sr?: number; seed?: number; noise?: number } = {}) {
  const f = mf(midi);
  return voice(
    [{ f0: [f, f], seconds: o.seconds ?? 1, vowel: o.vowel ?? "a", attackMs: o.attackMs ?? 80, releaseMs: 80, vibratoCents: o.vibratoCents ?? 40, vibratoHz: o.vibratoHz, consonant: o.consonant ?? null, decay: o.decay, amp: o.amp }],
    { sr: o.sr, seed: o.seed, noise: o.noise },
  );
}

/** Hand clap: a short broadband burst with a quick room tail. */
export function clap(o: { sr?: number; seed?: number; seconds?: number } = {}) {
  const sr = o.sr ?? 48000;
  const rand = rng(o.seed ?? 21);
  const out = new Float32Array(Math.floor(sr * (o.seconds ?? 0.6)));
  const s0 = Math.floor(0.1 * sr);
  let burst = new Float32Array(Math.floor(sr * 0.25));
  for (let i = 0; i < burst.length; i++) burst[i] = rand() * (Math.exp(-i / (sr * 0.006)) + 0.05 * Math.exp(-i / (sr * 0.05)));
  burst = resonate(burst, sr, 1200 + rand() * 600, 1500, 6);
  for (let i = 0; i < burst.length; i++) out[s0 + i] += burst[i];
  return out;
}

/** Knock/tap on a table or the guitar body: a damped low thump plus a click. */
export function tap(o: { sr?: number; seed?: number; f?: number } = {}) {
  const sr = o.sr ?? 48000;
  const rand = rng(o.seed ?? 31);
  const out = new Float32Array(Math.floor(sr * 0.6));
  const s0 = Math.floor(0.1 * sr);
  const f = o.f ?? 180;
  for (let i = 0; i < sr * 0.15; i++) {
    out[s0 + i] += 0.5 * Math.sin((2 * Math.PI * f * i) / sr) * Math.exp(-i / (sr * 0.018)) + rand() * 0.3 * Math.exp(-i / (sr * 0.002));
  }
  return out;
}

/**
 * A more realistic plucked string: KS with a pick-noise burst, stretched harmonics, the
 * pitch settling down a few cents after the attack, a second slightly detuned
 * polarisation, and body resonances.
 */
export function realishPluck(midi: number, o: { sr?: number; seed?: number; seconds?: number; noise?: number; vol?: number; hum?: number; sustain?: number } = {}) {
  const sr = o.sr ?? 48000;
  const rand = rng(o.seed ?? 41);
  const len = Math.floor(sr * (o.seconds ?? 1));
  const out = new Float32Array(len);
  const s0 = Math.floor(0.1 * sr);
  for (const [detune, amp] of [[0, 1], [1.5, 0.5]] as const) {
    const f = mf(midi) * Math.pow(2, detune / 1200);
    const N = sr / f;
    const Ni = Math.floor(N);
    const frac = N - Ni;
    const size = Ni + 4;
    const line = new Float32Array(size);
    // excitation: noise lowpassed by pick position
    let lp = 0;
    for (let i = 0; i < size; i++) {
      lp = lp * 0.5 + rand() * 0.5;
      line[i] = lp * amp * 0.8;
    }
    let w = 0;
    let last = 0;
    // loss per period so the note falls to ~20 % in one second (like a real steel string),
    // or in `sustain` seconds (a long-ringing nylon / low string)
    const loss = Math.exp(Math.log(0.2) / (f * (o.sustain ?? 1)));
    for (let n = s0; n < len; n++) {
      // fractional delay with slight settling (tension decreases after the pluck)
      const t = (n - s0) / sr;
      const settle = 1 - 0.008 * Math.exp(-t / 0.03); // starts ~14 cents sharp
      const d = (Ni + frac) * settle;
      const di = Math.floor(d);
      const df = d - di;
      const r1 = line[(w - di + size * 4) % size];
      const r2 = line[(w - di - 1 + size * 4) % size];
      const y = r1 * (1 - df) + r2 * df;
      const filt = 0.5 * (y + last) * loss;
      last = y;
      line[w] = filt;
      w = (w + 1) % size;
      out[n] += y * (o.vol ?? 0.5);
    }
  }
  // pick click
  for (let i = 0; i < sr * 0.004; i++) out[s0 + i] += rand() * 0.15 * Math.exp(-i / (sr * 0.001));
  // body resonance
  const b1 = resonate(out, sr, 100, 30, 0.3);
  const b2 = resonate(out, sr, 205, 40, 0.2);
  for (let i = 0; i < len; i++) out[i] += b1[i] + b2[i];
  if (o.noise || o.hum) {
    addNoise(out, o.noise ?? 0, rand);
    if (o.hum) for (let i = 0; i < len; i++) out[i] += o.hum * 0.02 * Math.sin((2 * Math.PI * 50 * i) / sr);
  }
  return out;
}

/** White noise at `level` × the signal's RMS. */
export function addNoise(out: Float32Array, level: number, rand = rng(99)) {
  let rms = 0;
  for (const v of out) rms += v * v;
  rms = Math.sqrt(rms / out.length);
  for (let i = 0; i < out.length; i++) out[i] += rand() * level * rms * 1.7;
}

/** Mix b into a at sample offset (returns a new buffer long enough for both). */
export function mix(a: Float32Array, b: Float32Array, offset: number, gain = 1) {
  const out = new Float32Array(Math.max(a.length, offset + b.length));
  out.set(a);
  for (let i = 0; i < b.length; i++) out[offset + i] += b[i] * gain;
  return out;
}

/**
 * Several notes picked one after another. On the same string each new pluck stops the
 * old vibration (the pick touches the string); on different strings the old one rings on.
 */
export function pickedRun(notes: { midi: number; string: number; t: number }[], o: { sr?: number; seconds?: number; noise?: number; seed?: number } = {}) {
  const sr = o.sr ?? 48000;
  let out = new Float32Array(Math.floor(sr * (o.seconds ?? notes[notes.length - 1].t + 1)));
  notes.forEach((n, k) => {
    const nextSame = notes.slice(k + 1).find((m) => m.string === n.string);
    let note = realishPluck(n.midi, { sr, seed: (o.seed ?? 1) * 31 + k, seconds: 1.2, vol: 0.4 + (k % 3) * 0.05 });
    note = note.subarray(Math.floor(0.1 * sr)); // realishPluck starts at 0.1 s
    if (nextSame) {
      const cut = Math.floor((nextSame.t - n.t) * sr);
      const fade = Math.floor(0.004 * sr);
      note = note.slice(0, cut + fade);
      for (let i = 0; i < fade; i++) note[cut + i] *= 1 - i / fade;
    }
    out = mix(out, note, Math.floor(n.t * sr));
  });
  if (o.noise) addNoise(out, o.noise, rng(o.seed ?? 5));
  return out;
}
