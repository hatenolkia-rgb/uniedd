/**
 * Chord & note recognition for the picking & strumming game.
 *
 * spectrum (dB, from an AnalyserNode) → peak-whitened magnitudes → 12-bin chromagram
 * (pitch-class profile) → cosine match against harmonic-aware chord templates.
 * Pure functions, no DOM, so they can be unit-tested with synthesized strums.
 */

export const PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const PC_SPOKEN = ["C", "C sharp", "D", "E flat", "E", "F", "F sharp", "G", "A flat", "A", "B flat", "B"];
const NAME_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export type Quality = "maj" | "min" | "7";
const INTERVALS: Record<Quality, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], "7": [0, 4, 7, 10] };

export type ChordLabel = { root: number; quality: Quality };

/** "F#m" → { root: 6, quality: "min" } */
export function parseChord(name: string): ChordLabel | null {
  const m = /^([A-G](?:#|b)?)(m|7)?$/.exec(name);
  if (!m) return null;
  const root = NAME_TO_PC[m[1]];
  if (root === undefined) return null;
  return { root, quality: m[2] === "m" ? "min" : m[2] === "7" ? "7" : "maj" };
}

export function chordName(l: ChordLabel) {
  return PC_NAMES[l.root] + (l.quality === "min" ? "m" : l.quality === "7" ? "7" : "");
}

export function chordSpoken(l: ChordLabel) {
  return `${PC_SPOKEN[l.root]} ${l.quality === "min" ? "minor" : l.quality === "7" ? "seven" : "major"}`;
}

// Harmonics fold onto pitch classes: h1,h2,h4 → root; h3,h6 → +7; h5 → +4.
const HARMONIC_FOLD: [number, number][] = [
  [0, 1 + 0.6 + 0.36],
  [7, 0.5 + 0.22],
  [4, 0.28],
];

function templateFor(pcs: number[], weights?: number[]): number[] {
  const t = new Array(12).fill(0);
  pcs.forEach((pc, i) => {
    const w = weights?.[i] ?? 1;
    for (const [shift, hw] of HARMONIC_FOLD) t[(pc + shift) % 12] += w * hw;
  });
  return normalize(t);
}

function normalize(v: number[]) {
  const n = Math.hypot(...v);
  return n > 0 ? v.map((x) => x / n) : v.slice();
}

function cosine(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += a[i] * b[i];
  return s;
}

export type Template = { label: ChordLabel; name: string; vec: number[] };

export const CHORD_TEMPLATES: Template[] = (() => {
  const out: Template[] = [];
  for (let root = 0; root < 12; root++) {
    for (const quality of ["maj", "min", "7"] as Quality[]) {
      const pcs = INTERVALS[quality].map((i) => (root + i) % 12);
      // the root (and bass) usually rings loudest on guitar; the 7th is lighter
      const weights = INTERVALS[quality].map((i) => (i === 0 ? 1.25 : i === 10 ? 0.75 : 1));
      out.push({ label: { root, quality }, name: chordName({ root, quality }), vec: templateFor(pcs, weights) });
    }
  }
  return out;
})();

const NOTE_TEMPLATES: number[][] = Array.from({ length: 12 }, (_, pc) => templateFor([pc]));

/**
 * Chromagram from an AnalyserNode-style dB spectrum.
 * Only spectral peaks (bins standing out from their neighbourhood) count, so broadband
 * noise and pick scrape contribute little. Returns { chroma (unit length), energy }.
 */
export function chromaFromSpectrum(db: ArrayLike<number>, sampleRate: number, fftSize: number, fMin = 70, fMax = 2200) {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(2, Math.floor(fMin / binHz));
  const hi = Math.min(db.length - 3, Math.ceil(fMax / binHz));
  const mag = new Float32Array(hi + 4);
  for (let i = lo - 2; i <= hi + 2; i++) {
    const v = db[i];
    mag[i] = Number.isFinite(v) ? Math.pow(10, v / 20) : 0;
  }
  // local mean over ±W bins (≈ ±30 Hz) for whitening
  const W = Math.max(4, Math.round(30 / binHz));
  const chroma = new Array(12).fill(0);
  let energy = 0;
  let maxPeak = 0;
  for (let i = lo; i <= hi; i++) if (mag[i] > maxPeak) maxPeak = mag[i];
  if (maxPeak <= 0) return { chroma, energy: 0 };
  for (let i = lo; i <= hi; i++) {
    const m = mag[i];
    if (!(m > mag[i - 1] && m >= mag[i + 1])) continue; // local maximum
    if (m < maxPeak * 0.02) continue; // ~34 dB below the strongest peak: ignore
    let sum = 0;
    let n = 0;
    for (let k = Math.max(lo - 2, i - W); k <= Math.min(hi + 2, i + W); k++) {
      sum += mag[k];
      n++;
    }
    const excess = m - (sum / n) * 1.5;
    if (excess <= 0) continue;
    // parabolic interpolation for a sharper frequency estimate
    const a = mag[i - 1];
    const b = m;
    const c = mag[i + 1];
    const denom = a - 2 * b + c;
    const delta = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const f = (i + Math.max(-0.5, Math.min(0.5, delta))) * binHz;
    const midi = 69 + 12 * Math.log2(f / 440);
    const near = Math.round(midi);
    const dev = Math.abs(midi - near);
    if (dev > 0.4) continue; // between notes (noise / inharmonic)
    const w = Math.cos((dev / 0.4) * (Math.PI / 2)) ** 2;
    // lower notes get a little extra weight (they carry the chord's bass)
    const lowBoost = f < 330 ? 1.3 : f < 700 ? 1 : 0.7;
    const contrib = Math.sqrt(excess / maxPeak) * w * lowBoost;
    chroma[((near % 12) + 12) % 12] += contrib;
    energy += excess;
  }
  return { chroma: normalize(chroma), energy };
}

export type ChordGuess = { name: string; label: ChordLabel; score: number; runnerUp: number };

/** Best chord template for a chroma vector. */
export function bestChord(chroma: number[]): ChordGuess | null {
  if (!chroma.some((x) => x > 0)) return null;
  let best: Template | null = null;
  let bs = -1;
  let second = -1;
  for (const t of CHORD_TEMPLATES) {
    const s = cosine(chroma, t.vec);
    if (s > bs) {
      second = bs;
      bs = s;
      best = t;
    } else if (s > second) second = s;
  }
  return best ? { name: best.name, label: best.label, score: bs, runnerUp: second } : null;
}

export function chordScore(chroma: number[], name: string) {
  const l = parseChord(name);
  if (!l) return 0;
  const t = CHORD_TEMPLATES.find((x) => x.label.root === l.root && x.label.quality === l.quality);
  return t ? cosine(chroma, t.vec) : 0;
}

/** Same chord for the game's purposes: exact, or a 7th chord vs its plain major. */
export function sameChord(a: ChordLabel, b: ChordLabel) {
  if (a.root !== b.root) return false;
  if (a.quality === b.quality) return true;
  return (a.quality === "7" && b.quality === "maj") || (a.quality === "maj" && b.quality === "7");
}

export const MATCH_MIN_SCORE = 0.72;

/**
 * Does this frame sound like the target chord? Forgiving: the target only has to be
 * the best guess or within a hair of it (guitar voicings double notes and add colour).
 */
export function frameMatches(chroma: number[], target: string): { match: boolean; guess: ChordGuess | null; targetScore: number } {
  const guess = bestChord(chroma);
  const tl = parseChord(target);
  const targetScore = chordScore(chroma, target);
  if (!guess || !tl) return { match: false, guess, targetScore };
  const best = sameChord(guess.label, tl);
  const close = targetScore >= guess.score - 0.015;
  return { match: targetScore >= MATCH_MIN_SCORE && (best || close), guess, targetScore };
}

/** Most likely single note (pitch class) for a chroma vector, for picking feedback. */
export function bestNote(chroma: number[]): { pc: number; name: string; score: number } | null {
  if (!chroma.some((x) => x > 0)) return null;
  let pc = 0;
  let bs = -1;
  NOTE_TEMPLATES.forEach((t, i) => {
    const s = cosine(chroma, t);
    if (s > bs) {
      bs = s;
      pc = i;
    }
  });
  return { pc, name: PC_NAMES[pc], score: bs };
}

/**
 * Hold-to-confirm: a chord counts once it has matched for `need` seconds in total
 * (short gaps only slowly drain the meter, so a natural strum decay still counts).
 */
export class SustainMeter {
  value = 0;
  constructor(public need = 0.6) {}
  update(match: boolean, dt: number) {
    const d = Math.min(0.2, Math.max(0, dt));
    this.value = match ? this.value + d : Math.max(0, this.value - d * 0.4);
    return this.value >= this.need;
  }
  get progress() {
    return Math.min(1, this.value / this.need);
  }
  reset() {
    this.value = 0;
  }
}
