/** Shared music helpers for Jam (tuner, backing tracks, fretboard, voice). */

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function noteNameFromMidi(midi: number): string {
  const n = ((Math.round(midi) % 12) + 12) % 12;
  return NOTE_NAMES[n];
}

export function formatNoteMidi(midi: number): string {
  const m = Math.round(midi);
  return `${noteNameFromMidi(m)}${Math.floor(m / 12) - 1}`;
}

export function centsOff(freq: number, targetFreq: number): number {
  if (freq <= 0 || targetFreq <= 0) return 0;
  return 1200 * Math.log2(freq / targetFreq);
}

export function nearestNote(freq: number): {
  name: string;
  midi: number;
  targetFreq: number;
  cents: number;
  octave: number;
} {
  const midiFloat = freqToMidi(freq);
  const midi = Math.round(midiFloat);
  const targetFreq = midiToFreq(midi);
  return {
    name: noteNameFromMidi(midi),
    midi,
    targetFreq,
    cents: centsOff(freq, targetFreq),
    octave: Math.floor(midi / 12) - 1,
  };
}

export const SCALES: Record<string, { label: string; intervals: number[] }> = {
  major: { label: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: "Natural Minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  "pentatonic-major": { label: "Pentatonic Major", intervals: [0, 2, 4, 7, 9] },
  "pentatonic-minor": { label: "Pentatonic Minor", intervals: [0, 3, 5, 7, 10] },
  blues: { label: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { label: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { label: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  "harmonic-minor": { label: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
};

export const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

const KEY_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function keyToPitchClass(key: string): number {
  return KEY_TO_PC[key] ?? 0;
}

export function scaleNotes(key: string, scaleId: string): string[] {
  const root = keyToPitchClass(key);
  const intervals = SCALES[scaleId]?.intervals ?? SCALES.major.intervals;
  return intervals.map((i) => NOTE_NAMES[(root + i) % 12]);
}

export type ChordQuality = "maj" | "min" | "dom7" | "min7" | "maj7" | "dim";
export type ProgressionChord = { degree: number; quality: ChordQuality; label: string };

export const PROGRESSIONS: Record<
  string,
  { label: string; chords: ProgressionChord[]; barsPerChord?: number }
> = {
  "I-IV-V": {
    label: "I – IV – V",
    chords: [
      { degree: 0, quality: "maj", label: "I" },
      { degree: 3, quality: "maj", label: "IV" },
      { degree: 4, quality: "maj", label: "V" },
      { degree: 0, quality: "maj", label: "I" },
    ],
  },
  "I-V-vi-IV": {
    label: "I – V – vi – IV",
    chords: [
      { degree: 0, quality: "maj", label: "I" },
      { degree: 4, quality: "maj", label: "V" },
      { degree: 5, quality: "min", label: "vi" },
      { degree: 3, quality: "maj", label: "IV" },
    ],
  },
  "12-bar-blues": {
    label: "12-bar blues",
    chords: [
      { degree: 0, quality: "dom7", label: "I7" },
      { degree: 0, quality: "dom7", label: "I7" },
      { degree: 0, quality: "dom7", label: "I7" },
      { degree: 0, quality: "dom7", label: "I7" },
      { degree: 3, quality: "dom7", label: "IV7" },
      { degree: 3, quality: "dom7", label: "IV7" },
      { degree: 0, quality: "dom7", label: "I7" },
      { degree: 0, quality: "dom7", label: "I7" },
      { degree: 4, quality: "dom7", label: "V7" },
      { degree: 3, quality: "dom7", label: "IV7" },
      { degree: 0, quality: "dom7", label: "I7" },
      { degree: 4, quality: "dom7", label: "V7" },
    ],
  },
  "ii-V-I": {
    label: "ii – V – I",
    chords: [
      { degree: 1, quality: "min7", label: "ii" },
      { degree: 4, quality: "dom7", label: "V7" },
      { degree: 0, quality: "maj7", label: "IΔ" },
      { degree: 0, quality: "maj7", label: "IΔ" },
    ],
  },
  "i-VI-III-VII": {
    label: "i – VI – III – VII",
    chords: [
      { degree: 0, quality: "min", label: "i" },
      { degree: 5, quality: "maj", label: "VI" },
      { degree: 2, quality: "maj", label: "III" },
      { degree: 6, quality: "maj", label: "VII" },
    ],
  },
};

const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export function chordRootMidi(key: string, degree: number, octave = 3): number {
  const root = keyToPitchClass(key);
  return 12 * (octave + 1) + ((root + DEGREE_SEMITONES[degree % 7]) % 12);
}

export function chordPitches(key: string, chord: ProgressionChord, octave = 3): number[] {
  const rootMidi = chordRootMidi(key, chord.degree, octave);
  switch (chord.quality) {
    case "maj":
      return [rootMidi, rootMidi + 4, rootMidi + 7];
    case "min":
      return [rootMidi, rootMidi + 3, rootMidi + 7];
    case "dom7":
      return [rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 10];
    case "min7":
      return [rootMidi, rootMidi + 3, rootMidi + 7, rootMidi + 10];
    case "maj7":
      return [rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 11];
    case "dim":
      return [rootMidi, rootMidi + 3, rootMidi + 6];
    default:
      return [rootMidi, rootMidi + 4, rootMidi + 7];
  }
}

export function chordDisplayName(key: string, chord: ProgressionChord): string {
  const root = NOTE_NAMES[(keyToPitchClass(key) + DEGREE_SEMITONES[chord.degree % 7]) % 12];
  const suffix: Record<ChordQuality, string> = {
    maj: "",
    min: "m",
    dom7: "7",
    min7: "m7",
    maj7: "maj7",
    dim: "dim",
  };
  return `${root}${suffix[chord.quality]}`;
}

export type TuningDef = { id: string; label: string; strings: { name: string; midi: number }[] };

export const TUNINGS: TuningDef[] = [
  {
    id: "standard",
    label: "Standard (E A D G B E)",
    strings: [
      { name: "E2", midi: 40 },
      { name: "A2", midi: 45 },
      { name: "D3", midi: 50 },
      { name: "G3", midi: 55 },
      { name: "B3", midi: 59 },
      { name: "E4", midi: 64 },
    ],
  },
  {
    id: "drop-d",
    label: "Drop D (D A D G B E)",
    strings: [
      { name: "D2", midi: 38 },
      { name: "A2", midi: 45 },
      { name: "D3", midi: 50 },
      { name: "G3", midi: 55 },
      { name: "B3", midi: 59 },
      { name: "E4", midi: 64 },
    ],
  },
  {
    id: "dadgad",
    label: "DADGAD",
    strings: [
      { name: "D2", midi: 38 },
      { name: "A2", midi: 45 },
      { name: "D3", midi: 50 },
      { name: "G3", midi: 55 },
      { name: "A3", midi: 57 },
      { name: "D4", midi: 62 },
    ],
  },
  {
    id: "open-g",
    label: "Open G (D G D G B D)",
    strings: [
      { name: "D2", midi: 38 },
      { name: "G2", midi: 43 },
      { name: "D3", midi: 50 },
      { name: "G3", midi: 55 },
      { name: "B3", midi: 59 },
      { name: "D4", midi: 62 },
    ],
  },
  {
    id: "half-step-down",
    label: "Half-step down (Eb Ab Db Gb Bb Eb)",
    strings: [
      { name: "Eb2", midi: 39 },
      { name: "Ab2", midi: 44 },
      { name: "Db3", midi: 49 },
      { name: "Gb3", midi: 54 },
      { name: "Bb3", midi: 58 },
      { name: "Eb4", midi: 63 },
    ],
  },
];

export function scaleFretMap(
  key: string,
  scaleId: string,
  frets = 12,
): { string: number; fret: number; note: string; isRoot: boolean }[] {
  const openMidis = [64, 59, 55, 50, 45, 40];
  const rootPc = keyToPitchClass(key);
  const pcs = new Set(scaleNotes(key, scaleId).map((n) => NOTE_NAMES.indexOf(n as NoteName)));
  const out: { string: number; fret: number; note: string; isRoot: boolean }[] = [];
  openMidis.forEach((open, s) => {
    for (let f = 0; f <= frets; f++) {
      const midi = open + f;
      const pc = midi % 12;
      if (pcs.has(pc)) {
        out.push({ string: s, fret: f, note: NOTE_NAMES[pc], isRoot: pc === rootPc });
      }
    }
  });
  return out;
}

/** Typical adult singing ranges (MIDI) for voice-type estimate. */
export const VOICE_TYPES: {
  id: string;
  label: string;
  low: number;
  high: number;
  group: "lower" | "higher";
}[] = [
  { id: "bass", label: "Bass", low: 28, high: 52, group: "lower" }, // E1–E3
  { id: "baritone", label: "Baritone", low: 33, high: 57, group: "lower" }, // A1–A3
  { id: "tenor", label: "Tenor", low: 36, high: 64, group: "lower" }, // C2–E4
  { id: "countertenor", label: "Countertenor", low: 45, high: 69, group: "higher" }, // A2–A4
  { id: "alto", label: "Alto / Contralto", low: 43, high: 67, group: "higher" }, // G2–G4
  { id: "mezzo", label: "Mezzo-soprano", low: 48, high: 72, group: "higher" }, // C3–C5
  { id: "soprano", label: "Soprano", low: 52, high: 76, group: "higher" }, // E3–E5
];

export function classifyVoiceType(lowMidi: number, highMidi: number): {
  best: (typeof VOICE_TYPES)[number];
  score: number;
  alternatives: { type: (typeof VOICE_TYPES)[number]; score: number }[];
} {
  const scored = VOICE_TYPES.map((t) => {
    const overlapLow = Math.max(lowMidi, t.low);
    const overlapHigh = Math.min(highMidi, t.high);
    const overlap = Math.max(0, overlapHigh - overlapLow);
    const range = Math.max(1, highMidi - lowMidi);
    const coverage = overlap / range;
    const centerUser = (lowMidi + highMidi) / 2;
    const centerType = (t.low + t.high) / 2;
    const centerDist = Math.abs(centerUser - centerType) / 12;
    const score = coverage * 0.7 + Math.max(0, 1 - centerDist) * 0.3;
    return { type: t, score };
  }).sort((a, b) => b.score - a.score);
  return { best: scored[0].type, score: scored[0].score, alternatives: scored.slice(1, 3) };
}
