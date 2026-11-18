// Tanpura tuning maths — pure functions (unit tested).

export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const KEY_LABELS = ["C", "C♯ / D♭", "D", "D♯ / E♭", "E", "F", "F♯ / G♭", "G", "G♯ / A♭", "A", "A♯ / B♭", "B"];

export type Voice = "male" | "female";
export type Temperament = "just" | "equal";

export type SwarId = "S" | "r" | "R" | "g" | "G" | "m" | "M" | "P" | "d" | "D" | "n" | "N";

/** The 12 swaras with natural (just) ratios and equal-tempered semitones. */
export const SWARAS: { id: SwarId; name: string; short: string; ratio: number; semis: number }[] = [
  { id: "S", name: "Sa", short: "Sa", ratio: 1, semis: 0 },
  { id: "r", name: "Komal Re", short: "re", ratio: 16 / 15, semis: 1 },
  { id: "R", name: "Re", short: "Re", ratio: 9 / 8, semis: 2 },
  { id: "g", name: "Komal Ga", short: "ga", ratio: 6 / 5, semis: 3 },
  { id: "G", name: "Ga", short: "Ga", ratio: 5 / 4, semis: 4 },
  { id: "m", name: "Ma", short: "Ma", ratio: 4 / 3, semis: 5 },
  { id: "M", name: "Tivra Ma", short: "Ma′", ratio: 45 / 32, semis: 6 },
  { id: "P", name: "Pa", short: "Pa", ratio: 3 / 2, semis: 7 },
  { id: "d", name: "Komal Dha", short: "dha", ratio: 8 / 5, semis: 8 },
  { id: "D", name: "Dha", short: "Dha", ratio: 5 / 3, semis: 9 },
  { id: "n", name: "Komal Ni", short: "ni", ratio: 9 / 5, semis: 10 },
  { id: "N", name: "Ni", short: "Ni", ratio: 15 / 8, semis: 11 },
];

export function swar(id: SwarId) {
  const s = SWARAS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown swar ${id}`);
  return s;
}

/** First-string tunings offered like a classic tanpura app. */
export const FIRST_STRING: { id: SwarId; label: string; hint: string }[] = [
  { id: "P", label: "Pa", hint: "Most ragas (Yaman, Bhairav, Kafi…)" },
  { id: "m", label: "Ma", hint: "Ragas without Pa (Malkauns, Marwa-style…)" },
  { id: "N", label: "Ni", hint: "Ragas without Pa and Ma (Marwa, Puriya…)" },
  { id: "n", label: "Komal Ni", hint: "Ragas using komal Ni without Pa" },
  { id: "S", label: "Sa", hint: "Plain Sa drone" },
];

export type StringSpec = { swar: SwarId; octave: -1 | 0 | 1; volume: number; cents: number; on: boolean };

/** Default string set for 4, 5 or 6 strings; string 1 is the selected first-string swar. */
export function defaultStrings(count: 4 | 5 | 6, first: SwarId): StringSpec[] {
  const s = (swarId: SwarId, octave: -1 | 0 | 1, volume = 0.8): StringSpec => ({ swar: swarId, octave, volume, cents: 0, on: true });
  const firstOct: -1 | 0 = first === "S" ? 0 : -1;
  if (count === 4) return [s(first, firstOct), s("S", 0), s("S", 0), s("S", -1, 0.9)];
  if (count === 5) return [s(first, firstOct), s(first === "N" ? "P" : "N", -1, 0.55), s("S", 0), s("S", 0), s("S", -1, 0.9)];
  return [s(first, firstOct), s(first === "N" ? "P" : "N", -1, 0.5), s("S", 0), s("S", 0), s("G", 0, 0.45), s("S", -1, 0.9)];
}

/** Octave of the Sa for each key so male/female tanpuras sit in a natural singing range. */
export function saOctave(keyIndex: number, voice: Voice): number {
  if (voice === "male") return keyIndex >= 9 ? 2 : 3; // A2 … G#3
  return keyIndex >= 4 ? 3 : 4; // E3 … D#4
}

export function midiToHz(midi: number, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Frequency of the tonic Sa (madhya saptak) for the selected key. */
export function saHz(keyIndex: number, voice: Voice, opts: { a4?: number; cents?: number; octaveShift?: number } = {}) {
  const { a4 = 440, cents = 0, octaveShift = 0 } = opts;
  const midi = 12 * (saOctave(keyIndex, voice) + 1 + octaveShift) + keyIndex;
  return midiToHz(midi, a4) * Math.pow(2, cents / 1200);
}

export function swarRatio(id: SwarId, temperament: Temperament) {
  const s = swar(id);
  return temperament === "just" ? s.ratio : Math.pow(2, s.semis / 12);
}

export function stringHz(sa: number, spec: Pick<StringSpec, "swar" | "octave" | "cents">, temperament: Temperament) {
  return sa * swarRatio(spec.swar, temperament) * Math.pow(2, spec.octave) * Math.pow(2, spec.cents / 1200);
}

export function centsBetween(f: number, ref: number) {
  return 1200 * Math.log2(f / ref);
}

/** Name a frequency as the nearest equal-tempered note, e.g. "C#3 +2¢". */
export function noteName(f: number, a4 = 440) {
  const m = 69 + 12 * Math.log2(f / a4);
  const r = Math.round(m);
  const c = Math.round((m - r) * 100);
  return `${KEYS[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}${c ? ` ${c > 0 ? "+" : "−"}${Math.abs(c)}¢` : ""}`;
}

/** Relative pluck times for one cycle (0..1). The last string gets a longer pause, like a real tanpura player. */
export function pluckOffsets(n: number): number[] {
  const gaps = Array.from({ length: n }, (_, i) => (i === n - 1 ? 1.7 : 1));
  const total = gaps.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let t = 0;
  for (const g of gaps) {
    out.push(t / total);
    t += g;
  }
  return out;
}

/** Playback-rate (and semitone shift) that tunes the tabla's dayan to Sa (or Pa) of the tanpura, kept within ±6 semitones. */
export function tablaRate(sa: number, dayanHz: number, target: "S" | "P" = "S") {
  const want = target === "P" ? sa * 1.5 : sa;
  let semis = 12 * Math.log2(want / dayanHz);
  semis -= 12 * Math.round(semis / 12);
  if (semis >= 6) semis -= 12;
  if (semis < -6) semis += 12;
  return { rate: Math.pow(2, semis / 12), semis };
}

/** Swarmandal scales (ascending swaras within one octave). */
export const SWARMANDAL_SCALES: { id: string; label: string; notes: SwarId[] }[] = [
  { id: "sapa", label: "Sa Pa (fits any raga)", notes: ["S", "P"] },
  { id: "bhupali", label: "Bhupali (Sa Re Ga Pa Dha)", notes: ["S", "R", "G", "P", "D"] },
  { id: "bilawal", label: "Bilawal (major)", notes: ["S", "R", "G", "m", "P", "D", "N"] },
  { id: "yaman", label: "Yaman", notes: ["S", "R", "G", "M", "P", "D", "N"] },
  { id: "kafi", label: "Kafi", notes: ["S", "R", "g", "m", "P", "D", "n"] },
  { id: "bhairav", label: "Bhairav", notes: ["S", "r", "G", "m", "P", "d", "N"] },
  { id: "malkauns", label: "Malkauns", notes: ["S", "g", "m", "d", "n"] },
];
