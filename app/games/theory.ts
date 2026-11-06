export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const NOTE_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

export function midiToFreq(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToName(midi: number, flats = false) {
  const names = flats ? NOTE_FLAT : NOTE_NAMES;
  return names[((midi % 12) + 12) % 12];
}

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function normalizeNoteName(name: string) {
  return name.replace("♯", "#").replace("♭", "b").trim();
}

export function nameToPc(name: string) {
  const n = normalizeNoteName(name);
  const sharp = NOTE_NAMES.indexOf(n as (typeof NOTE_NAMES)[number]);
  if (sharp >= 0) return sharp;
  const flat = NOTE_FLAT.indexOf(n as (typeof NOTE_FLAT)[number]);
  if (flat >= 0) return flat;
  const letter = n[0]?.toUpperCase();
  if (!letter || NATURAL_PC[letter] === undefined) return -1;
  const rest = n.slice(1);
  let acc = 0;
  for (const ch of rest) {
    if (ch === "#") acc += 1;
    else if (ch === "b") acc -= 1;
  }
  return (((NATURAL_PC[letter] + acc) % 12) + 12) % 12;
}

export function areEnharmonic(a: string, b: string) {
  const pa = nameToPc(a);
  const pb = nameToPc(b);
  return pa >= 0 && pa === pb;
}

export function enharmonicLabel(name: string) {
  const pc = nameToPc(name);
  if (pc < 0) return name;
  const sharp = NOTE_NAMES[pc];
  const flat = NOTE_FLAT[pc];
  return sharp === flat ? sharp : `${sharp} / ${flat}`;
}

export const INTERVALS: { id: string; label: string; semitones: number; short: string }[] = [
  { id: "m2", label: "Minor 2nd", semitones: 1, short: "m2" },
  { id: "M2", label: "Major 2nd", semitones: 2, short: "M2" },
  { id: "m3", label: "Minor 3rd", semitones: 3, short: "m3" },
  { id: "M3", label: "Major 3rd", semitones: 4, short: "M3" },
  { id: "P4", label: "Perfect 4th", semitones: 5, short: "P4" },
  { id: "TT", label: "Tritone", semitones: 6, short: "TT" },
  { id: "P5", label: "Perfect 5th", semitones: 7, short: "P5" },
  { id: "m6", label: "Minor 6th", semitones: 8, short: "m6" },
  { id: "M6", label: "Major 6th", semitones: 9, short: "M6" },
  { id: "m7", label: "Minor 7th", semitones: 10, short: "m7" },
  { id: "M7", label: "Major 7th", semitones: 11, short: "M7" },
  { id: "P8", label: "Octave", semitones: 12, short: "P8" },
];

export const CIRCLE = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"] as const;

export const SHARP_ORDER = ["F#", "C#", "G#", "D#", "A#", "E#", "B#"] as const;
export const FLAT_ORDER = ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"] as const;

export type KeySignature = {
  name: string;
  count: number;
  kind: "natural" | "sharp" | "flat";
  accidentals: string[];
  relativeMinor: string;
};

export const KEY_SIGNATURES: KeySignature[] = [
  { name: "C", count: 0, kind: "natural", accidentals: [], relativeMinor: "A" },
  { name: "G", count: 1, kind: "sharp", accidentals: ["F#"], relativeMinor: "E" },
  { name: "D", count: 2, kind: "sharp", accidentals: ["F#", "C#"], relativeMinor: "B" },
  { name: "A", count: 3, kind: "sharp", accidentals: ["F#", "C#", "G#"], relativeMinor: "F#" },
  { name: "E", count: 4, kind: "sharp", accidentals: ["F#", "C#", "G#", "D#"], relativeMinor: "C#" },
  { name: "B", count: 5, kind: "sharp", accidentals: ["F#", "C#", "G#", "D#", "A#"], relativeMinor: "G#" },
  { name: "F#", count: 6, kind: "sharp", accidentals: ["F#", "C#", "G#", "D#", "A#", "E#"], relativeMinor: "D#" },
  { name: "C#", count: 7, kind: "sharp", accidentals: ["F#", "C#", "G#", "D#", "A#", "E#", "B#"], relativeMinor: "A#" },
  { name: "F", count: 1, kind: "flat", accidentals: ["Bb"], relativeMinor: "D" },
  { name: "Bb", count: 2, kind: "flat", accidentals: ["Bb", "Eb"], relativeMinor: "G" },
  { name: "Eb", count: 3, kind: "flat", accidentals: ["Bb", "Eb", "Ab"], relativeMinor: "C" },
  { name: "Ab", count: 4, kind: "flat", accidentals: ["Bb", "Eb", "Ab", "Db"], relativeMinor: "F" },
  { name: "Db", count: 5, kind: "flat", accidentals: ["Bb", "Eb", "Ab", "Db", "Gb"], relativeMinor: "Bb" },
  { name: "Gb", count: 6, kind: "flat", accidentals: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb"], relativeMinor: "Eb" },
  { name: "Cb", count: 7, kind: "flat", accidentals: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"], relativeMinor: "Ab" },
];

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  "major pentatonic": [0, 2, 4, 7, 9],
  "minor pentatonic": [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

export const SCALE_NOTE_PALETTE = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
] as const;

function spellPitch(letter: string, pc: number) {
  const natural = NATURAL_PC[letter];
  let diff = pc - natural;
  while (diff > 6) diff -= 12;
  while (diff < -6) diff += 12;
  if (diff === 0) return letter;
  if (diff > 0) return letter + "#".repeat(diff);
  return letter + "b".repeat(-diff);
}

function letterOffsetsForScale(intervals: number[]) {
  // Heptatonic scales and modes always use one of each letter name.
  if (intervals.length === 7) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  // Blues: 1, b3, 4, b5, 5, b7 — b5 and 5 share a letter name.
  if (intervals.length === 6 && intervals.includes(3) && intervals.includes(6) && intervals.includes(7)) {
    return [0, 2, 3, 4, 4, 6];
  }
  return intervals.map((st) => Math.round((st * 7) / 12));
}

export const SOLFEGE = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"] as const;
export const SOLFEGE_STEPS = [0, 2, 4, 5, 7, 9, 11];

/** MIDI of open strings, index 0 = string 1 (high E4), index 5 = string 6 (low E2). */
export const GUITAR_TUNING = [64, 59, 55, 50, 45, 40];
/** Standard player-view order, top to bottom: string 6 (low E) down to string 1 (high E). */
export const STRING_NUMBERS_TOP_TO_BOTTOM = [6, 5, 4, 3, 2, 1] as const;
export const FRET_MARKERS = [3, 5, 7, 9, 12] as const;
export const DOUBLE_FRET_MARKERS = [12] as const;
export const FRETBOARD_FRETS = 12;

export function stringNumberFromHigh(stringIndexFromHighE: number) {
  return stringIndexFromHighE + 1;
}

export function stringIndexFromNumber(stringNumber: number) {
  return stringNumber - 1;
}

/** Note sounding at a fret. String 1 = high E4, string 6 = low E2. */
export function noteAtFret(stringNumber: number, fret: number) {
  return GUITAR_TUNING[stringIndexFromNumber(stringNumber)] + fret;
}

export function fretNote(stringIndexFromHighE: number, fret: number) {
  return noteAtFret(stringNumberFromHigh(stringIndexFromHighE), fret);
}

export type ChordShape = {
  name: string;
  // strings 0=high E ... 5=low E; -1 mute, 0 open
  frets: number[];
};

export const OPEN_CHORDS: ChordShape[] = [
  { name: "C", frets: [0, 1, 0, 2, 3, -1] },
  { name: "G", frets: [3, 0, 0, 0, 2, 3] },
  { name: "D", frets: [2, 3, 2, 0, -1, -1] },
  { name: "A", frets: [0, 2, 2, 2, 0, -1] },
  { name: "E", frets: [0, 0, 1, 2, 2, 0] },
  { name: "Am", frets: [0, 1, 2, 2, 0, -1] },
  { name: "Em", frets: [0, 0, 0, 2, 2, 0] },
  { name: "Dm", frets: [1, 3, 2, 0, -1, -1] },
  { name: "F", frets: [1, 1, 2, 3, 3, 1] },
  { name: "E7", frets: [0, 0, 1, 0, 2, 0] },
  { name: "A7", frets: [0, 2, 0, 2, 0, -1] },
  { name: "D7", frets: [2, 1, 2, 0, -1, -1] },
];

export const CHORD_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
};

export function buildScale(root: string, type: keyof typeof SCALES) {
  const intervals = SCALES[type];
  const rootPc = nameToPc(root);
  const start = LETTERS.indexOf(root[0].toUpperCase() as (typeof LETTERS)[number]);
  const offsets = letterOffsetsForScale(intervals);
  return intervals.map((step, i) => {
    const letter = LETTERS[(start + offsets[i] + 7) % 7];
    return spellPitch(letter, (rootPc + step) % 12);
  });
}

export function staffDegree(letter: string, octave: number) {
  return octave * 7 + LETTERS.indexOf(letter as (typeof LETTERS)[number]);
}

/** Bottom line of the staff: E4 in treble, G2 in bass. */
export function staffBottomDegree(clef: "treble" | "bass") {
  return clef === "treble" ? staffDegree("E", 4) : staffDegree("G", 2);
}

export function staffStepsFromBottom(letter: string, octave: number, clef: "treble" | "bass") {
  return staffDegree(letter, octave) - staffBottomDegree(clef);
}

export function chordShapePitchClasses(shape: ChordShape) {
  return shape.frets
    .map((fret, stringFromHigh) => (fret < 0 ? null : (fretNote(stringFromHigh, fret) % 12 + 12) % 12))
    .filter((pc): pc is number => pc !== null);
}

export const OPEN_CHORD_TONES: Record<string, number[]> = {
  C: [0, 4, 7],
  G: [7, 11, 2],
  D: [2, 6, 9],
  A: [9, 1, 4],
  E: [4, 8, 11],
  Am: [9, 0, 4],
  Em: [4, 7, 11],
  Dm: [2, 5, 9],
  F: [5, 9, 0],
  E7: [4, 8, 11, 2],
  A7: [9, 1, 4, 7],
  D7: [2, 6, 9, 0],
};

export function pick<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Deterministic 0–1 value so challenge generation stays pure during render. */
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function pickAt<T>(arr: readonly T[], seed: number) {
  return arr[Math.floor(rand(seed) * arr.length) % arr.length];
}

export function shuffleAt<T>(arr: readonly T[], seed: number) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed + i * 17.13) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
