export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const NOTE_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

export function midiToFreq(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToName(midi: number, flats = false) {
  const names = flats ? NOTE_FLAT : NOTE_NAMES;
  return names[((midi % 12) + 12) % 12];
}

export function nameToPc(name: string) {
  const n = name.replace("♯", "#").replace("♭", "b");
  const sharp = NOTE_NAMES.indexOf(n as (typeof NOTE_NAMES)[number]);
  if (sharp >= 0) return sharp;
  return NOTE_FLAT.indexOf(n as (typeof NOTE_FLAT)[number]);
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

export const MAJOR_SHARPS: Record<string, string> = {
  C: "0 sharps / 0 flats",
  G: "1 sharp (F#)",
  D: "2 sharps (F#, C#)",
  A: "3 sharps (F#, C#, G#)",
  E: "4 sharps (F#, C#, G#, D#)",
  B: "5 sharps",
  F: "1 flat (Bb)",
  Bb: "2 flats (Bb, Eb)",
  Eb: "3 flats (Bb, Eb, Ab)",
  Ab: "4 flats",
};

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  "major pentatonic": [0, 2, 4, 7, 9],
  "minor pentatonic": [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

export const SOLFEGE = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"] as const;
export const SOLFEGE_STEPS = [0, 2, 4, 5, 7, 9, 11];

export const GUITAR_TUNING = [64, 59, 55, 50, 45, 40]; // high E to low E MIDI

export function fretNote(stringIndexFromHighE: number, fret: number) {
  return GUITAR_TUNING[stringIndexFromHighE] + fret;
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
  const pc = nameToPc(root);
  return SCALES[type].map((step) => NOTE_NAMES[(pc + step) % 12]);
}

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
