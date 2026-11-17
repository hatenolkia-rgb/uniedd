/**
 * Alternate Picking & Strumming Coach — levels, patterns, chords and the timing judge.
 * Pure data + logic (no DOM) so it can be unit-tested.
 *
 * Pattern notation, one character per grid slot:
 *   d / u  = down / up stroke      D / U = accented down / up stroke
 *   -      = rest (the hand keeps moving but does not hit the strings)
 * A pattern is a list of segments, each one beat-aligned with `grid` slots per beat
 * (2 = 8th notes, 3 = triplets, 4 = 16th notes, 6 = sextuplets).
 */

export type Dir = "D" | "U";
export type Mode = "picking" | "chords";
export type Level = "beginner" | "expert" | "pro";

export type Segment = { grid: 1 | 2 | 3 | 4 | 6; s: string };

export type PickPattern = {
  id: string;
  title: string;
  /** What the hand does (strings, accents...) — shown under the arrows. */
  desc: string;
  /** What the coach says out loud. */
  say: string;
  segs: Segment[];
  /** How many times the pattern repeats in one go. */
  reps: number;
  /** Open strings (MIDI) for the demo, changing every `per` strokes. Default: open A. */
  strings?: { seq: number[]; per: number };
};

export type ChordShape = {
  name: string;
  /** Spoken name, e.g. "G major". */
  spoken: string;
  /** Frets low E -> high e. -1 = don't play (X), 0 = open. */
  frets: number[];
  /** Finger numbers (1 index … 4 pinky), 0 = none. */
  fingers: number[];
  /** Barre: fret + lowest/highest string index covered by finger 1. */
  barre?: { fret: number; from: number; to: number };
  /** First fret shown in the diagram (for barre chords up the neck). */
  base?: number;
};

export type StrumExercise = {
  id: string;
  title: string;
  desc: string;
  segs: Segment[];
  /** Chord per beat range: [chordName, beats] in order; repeats with the pattern. */
  chords: [string, number][];
  reps: number;
};

export type LevelInfo = {
  id: Level;
  label: string;
  emoji: string;
  blurb: string;
  /** Leaderboard multiplier. */
  mult: number;
};

export const LEVELS: Record<Mode, LevelInfo[]> = {
  picking: [
    { id: "beginner", label: "Beginner", emoji: "🐣", blurb: "Downs and down-ups on one string", mult: 0.6 },
    { id: "expert", label: "Expert", emoji: "🚀", blurb: "Triplets, accents, string crossing and first 16ths", mult: 0.8 },
    { id: "pro", label: "Pro", emoji: "🔥", blurb: "Long 16th runs, gallops, sextuplets and string skipping", mult: 1 },
  ],
  chords: [
    { id: "beginner", label: "Beginner", emoji: "🐣", blurb: "Open G, C, D, Em and Am — one or two chords at a time", mult: 0.6 },
    { id: "expert", label: "Expert", emoji: "🚀", blurb: "Adds A, E, Dm and 7th chords, 4-chord changes", mult: 0.8 },
    { id: "pro", label: "Pro", emoji: "🔥", blurb: "Barre chords (F, Bm, F#m, Bb, Cm, Gm) and quick changes", mult: 1 },
  ],
};

export function levelInfo(mode: Mode, level: Level) {
  return LEVELS[mode].find((l) => l.id === level)!;
}

// ---------------------------------------------------------------- picking patterns

export const PICKING: Record<Level, PickPattern[]> = {
  beginner: [
    { strings: { seq: [40], per: 1 }, id: "b-downs", title: "Steady Downs", desc: "Open low E string · 4 down strokes", say: "down, down, down, down", segs: [{ grid: 1, s: "dddd" }], reps: 2 },
    { strings: { seq: [40], per: 1 }, id: "b-du", title: "Down-Up Train", desc: "Open low E string · 8th notes", say: "down up, down up, down up, down up", segs: [{ grid: 2, s: "dudududu" }], reps: 2 },
    { id: "b-mix", title: "Walk and Run", desc: "Open A string · two slow downs, then down-ups", say: "down, down, down up, down up", segs: [{ grid: 1, s: "dd" }, { grid: 2, s: "dudu" }], reps: 2 },
    { strings: { seq: [50], per: 1 }, id: "b-rest", title: "Take a Breath", desc: "Open D string · the up stroke on beat 3 is a silent air-pick", say: "down up, down up, down, rest, down up", segs: [{ grid: 2, s: "dudud-du" }], reps: 2 },
    { id: "b-hop", title: "String Hop", desc: "4 notes on the low E string, then 4 on the A string", say: "down up, down up, hop! down up, down up", segs: [{ grid: 2, s: "dudududu" }], reps: 2, strings: { seq: [40, 45], per: 4 } },
    { strings: { seq: [55], per: 1 }, id: "b-accent", title: "Loud and Soft", desc: "Open G string · play beats 1 and 3 a bit louder", say: "DOWN up, down up, DOWN up, down up", segs: [{ grid: 2, s: "DuduDudu" }], reps: 2 },
  ],
  expert: [
    { strings: { seq: [50], per: 1 }, id: "e-trip", title: "Triplet Roll", desc: "Open D string · 3 notes per beat — downs and ups swap every beat", say: "down up down, up down up, down up down, up down up", segs: [{ grid: 3, s: "dudududududu" }], reps: 2 },
    { id: "e-cross", title: "Stair Climber", desc: "2 notes on each string, low E up to high e (E A D G B e), then 2 more", say: "down up on every string, climbing up", segs: [{ grid: 2, s: "dudududu" }, { grid: 2, s: "dudududu" }], reps: 1, strings: { seq: [40, 45, 50, 55, 59, 64, 59, 55], per: 2 } },
    { id: "e-acc3", title: "Accent Hopper", desc: "8th notes · accent every 3rd note — it hops between down and up", say: "DOWN up down, UP down up, DOWN up", segs: [{ grid: 2, s: "DudUduDu" }], reps: 2 },
    { id: "e-16half", title: "Speed Burst", desc: "Open A string · 16th notes, then 8th notes to rest the hand", say: "down up down up, down up down up, down up, down up", segs: [{ grid: 4, s: "dudududu" }, { grid: 2, s: "dudu" }], reps: 2 },
    { id: "e-tripacc", title: "Triplet Bounce", desc: "Triplets · accent the first note of every beat", say: "DOWN up down, UP down up, DOWN up down, UP down up", segs: [{ grid: 3, s: "DudUduDudUdu" }], reps: 2 },
    { strings: { seq: [40], per: 1 }, id: "e-burst", title: "Pop-Pop Bursts", desc: "Open low E · a quick 16th burst, then a long note", say: "down up down up, down. down up down up, down", segs: [{ grid: 4, s: "dudud---dudud---" }], reps: 2 },
  ],
  pro: [
    { strings: { seq: [40], per: 1 }, id: "p-16", title: "Sixteenth Sprint", desc: "Low E string · 16 even 16th notes", say: "down up down up, four times", segs: [{ grid: 4, s: "dudududududududu" }], reps: 2 },
    { id: "p-acc3", title: "Accent Shifter", desc: "16th notes · accent every 3rd note", say: "DOWN up down, UP down up, DOWN up down, UP down up, DOWN up, down up", segs: [{ grid: 4, s: "DudUduDudUduDudu" }], reps: 2 },
    { strings: { seq: [40], per: 1 }, id: "p-gallop", title: "Gallop", desc: "Low E · 8th + two 16ths (the up after the 8th is an air-pick)", say: "down, down up. down, down up. down, down up. down, down up", segs: [{ grid: 4, s: "d-dud-dud-dud-du" }], reps: 2 },
    { strings: { seq: [50], per: 1 }, id: "p-six", title: "Sextuplet Storm", desc: "Open D string · 6 notes per beat, then 8ths", say: "down up down up down up, twice, then down up, down up", segs: [{ grid: 6, s: "dudududududu" }, { grid: 2, s: "dudu" }], reps: 2 },
    { id: "p-skip", title: "String Skipper", desc: "16ths · alternate the D string and the high e string every 2 notes", say: "down up, skip, down up, skip — all sixteenths", segs: [{ grid: 4, s: "dudududududududu" }], reps: 2, strings: { seq: [50, 64], per: 2 } },
    { id: "p-mix", title: "Shape Shifter", desc: "16ths, then triplets, then 16ths", say: "sixteenths, triplets, sixteenths", segs: [{ grid: 4, s: "Dudu" }, { grid: 3, s: "DudUdu" }, { grid: 4, s: "Dudu" }], reps: 2 },
  ],
};

// ---------------------------------------------------------------- chords

const c = (name: string, spoken: string, frets: number[], fingers: number[], extra: Partial<ChordShape> = {}): ChordShape => ({
  name,
  spoken,
  frets,
  fingers,
  ...extra,
});

export const CHORDS: Record<string, ChordShape> = {
  G: c("G", "G major", [3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]),
  C: c("C", "C major", [-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]),
  D: c("D", "D major", [-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]),
  Em: c("Em", "E minor", [0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]),
  Am: c("Am", "A minor", [-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]),
  A: c("A", "A major", [-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]),
  E: c("E", "E major", [0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]),
  Dm: c("Dm", "D minor", [-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]),
  E7: c("E7", "E seven", [0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]),
  A7: c("A7", "A seven", [-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]),
  D7: c("D7", "D seven", [-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]),
  G7: c("G7", "G seven", [3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]),
  F: c("F", "F major", [1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1], { barre: { fret: 1, from: 0, to: 5 } }),
  Bm: c("Bm", "B minor", [-1, 2, 4, 4, 3, 2], [0, 1, 3, 4, 2, 1], { barre: { fret: 2, from: 1, to: 5 } }),
  "F#m": c("F#m", "F sharp minor", [2, 4, 4, 2, 2, 2], [1, 3, 4, 1, 1, 1], { barre: { fret: 2, from: 0, to: 5 } }),
  Bb: c("Bb", "B flat major", [-1, 1, 3, 3, 3, 1], [0, 1, 2, 3, 4, 1], { barre: { fret: 1, from: 1, to: 5 } }),
  Cm: c("Cm", "C minor", [-1, 3, 5, 5, 4, 3], [0, 1, 3, 4, 2, 1], { barre: { fret: 3, from: 1, to: 5 }, base: 3 }),
  Gm: c("Gm", "G minor", [3, 5, 5, 3, 3, 3], [1, 3, 4, 1, 1, 1], { barre: { fret: 3, from: 0, to: 5 }, base: 3 }),
  B7: c("B7", "B seven", [-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4]),
};

export const STRUMS: Record<Level, StrumExercise[]> = {
  beginner: [
    { id: "cb-g", title: "Gentle G", desc: "4 slow down strums on G", segs: [{ grid: 1, s: "dddd" }], chords: [["G", 4]], reps: 2 },
    { id: "cb-em", title: "Easy Em", desc: "4 slow down strums on E minor", segs: [{ grid: 1, s: "dddd" }], chords: [["Em", 4]], reps: 2 },
    { id: "cb-c", title: "C Swing", desc: "Down, down up, down, down up", segs: [{ grid: 2, s: "d-dud-du" }], chords: [["C", 4]], reps: 2 },
    { id: "cb-d", title: "D Dance", desc: "Down, down up, down, down up", segs: [{ grid: 2, s: "d-dud-du" }], chords: [["D", 4]], reps: 2 },
    { id: "cb-gc", title: "G to C", desc: "One bar of G, one bar of C", segs: [{ grid: 1, s: "dddd" }], chords: [["G", 4], ["C", 4]], reps: 1 },
    { id: "cb-ema", title: "Em to Am", desc: "Em for one bar, Am for one bar", segs: [{ grid: 2, s: "d-d-d-du" }], chords: [["Em", 4], ["Am", 4]], reps: 1 },
  ],
  expert: [
    { id: "ce-of", title: "Campfire Strum", desc: "Down, down up, up down up — on G then D", segs: [{ grid: 2, s: "d-du-udu" }], chords: [["G", 4], ["D", 4]], reps: 1 },
    { id: "ce-8", title: "Eighth-Note Express", desc: "Steady down-ups · A, D, E, A — a new chord every bar", segs: [{ grid: 2, s: "dudududu" }], chords: [["A", 4], ["D", 4], ["E", 4], ["A", 4]], reps: 1 },
    { id: "ce-pop", title: "Pop Song Loop", desc: "Campfire strum · G, D, Em, C", segs: [{ grid: 2, s: "d-du-udu" }], chords: [["G", 4], ["D", 4], ["Em", 4], ["C", 4]], reps: 1 },
    { id: "ce-min", title: "Minor Mood", desc: "Accent beats 2 and 4 · Am, Dm, E7, Am", segs: [{ grid: 2, s: "duDuduDu" }], chords: [["Am", 4], ["Dm", 4], ["E7", 4], ["Am", 4]], reps: 1 },
    { id: "ce-blues", title: "Seventh Heaven", desc: "Down, down up, down, down up · A7, D7, E7, A7", segs: [{ grid: 2, s: "d-dud-du" }], chords: [["A7", 4], ["D7", 4], ["E7", 4], ["A7", 4]], reps: 1 },
    { id: "ce-g7", title: "Quick Pairs", desc: "Two chords in every bar · C G7, C G7", segs: [{ grid: 2, s: "d-dud-du" }], chords: [["C", 2], ["G7", 2], ["C", 2], ["G7", 2]], reps: 1 },
  ],
  pro: [
    { id: "cp-f", title: "Barre Boss", desc: "F barre chord · syncopated 16ths", segs: [{ grid: 4, s: "d-du-ud-d-du-udu" }], chords: [["F", 4], ["C", 4]], reps: 1 },
    { id: "cp-bm", title: "Bm Bounce", desc: "Bm, G, D, A — 2 beats each · 16th strum", segs: [{ grid: 4, s: "D-duD-du" }], chords: [["Bm", 2], ["G", 2], ["D", 2], ["A", 2]], reps: 2 },
    { id: "cp-fsm", title: "Island Groove", desc: "Down, down up, up down up in 16ths · F#m, Bm, E, A", segs: [{ grid: 4, s: "d-du-udu" }], chords: [["F#m", 2], ["Bm", 2], ["E", 2], ["A", 2]], reps: 2 },
    { id: "cp-funk", title: "Funky Sixteens", desc: "All 16ths, accents on 2 and 4 · Cm, Gm", segs: [{ grid: 4, s: "duduDudududuDudu" }], chords: [["Cm", 4], ["Gm", 4]], reps: 1 },
    { id: "cp-bb", title: "Flat Out", desc: "Bb, F, Gm, F — quick barre changes · push on the and of 2", segs: [{ grid: 4, s: "d-d--udu" }], chords: [["Bb", 2], ["F", 2], ["Gm", 2], ["F", 2]], reps: 2 },
    { id: "cp-b7", title: "Turnaround Rush", desc: "E, B7, A, B7 · syncopated 16ths, a change every 2 beats", segs: [{ grid: 4, s: "D-du-uDu" }], chords: [["E", 2], ["B7", 2], ["A", 2], ["B7", 2]], reps: 2 },
  ],
};

// Beginner G→C and Em→Am exercises: the pattern plays once per chord.
// (Handled by `chordsFor` — the chord list is extended to two bars.)
const BEGINNER_CHANGES: Record<string, [string, number][]> = {
  "cb-gc": [["G", 4], ["C", 4]],
  "cb-ema": [["Em", 4], ["Am", 4]],
};

// ---------------------------------------------------------------- expansion

export type Step = {
  /** Position in beats from the start of the exercise. */
  beat: number;
  dir: Dir;
  accent: boolean;
  /** Chord sounding at this step (Chords mode). */
  chord?: string;
  /** Index of the beat-group this step belongs to (for layout). */
  group: number;
};

export type Slot = { beat: number; dir: Dir; accent: boolean; rest: boolean; group: number; chord?: string };

export function segBeats(segs: Segment[]) {
  return segs.reduce((n, seg) => n + seg.s.length / seg.grid, 0);
}

/** All grid slots (including rests) for one pass of the pattern. */
export function slotsOf(segs: Segment[]): Slot[] {
  const out: Slot[] = [];
  let beat = 0;
  for (const seg of segs) {
    for (let i = 0; i < seg.s.length; i++) {
      const ch = seg.s[i];
      const b = beat + i / seg.grid;
      const rest = ch === "-";
      // A rest is an air stroke: down on even slots, up on odd ones
      const dir: Dir = rest ? (i % 2 === 0 ? "D" : "U") : ch.toLowerCase() === "d" ? "D" : "U";
      out.push({ beat: b, dir, accent: ch === "D" || ch === "U", rest, group: Math.floor(b + 1e-9) });
    }
    beat += seg.s.length / seg.grid;
  }
  return out;
}

export type Exercise = {
  id: string;
  mode: Mode;
  title: string;
  desc: string;
  say: string;
  /** Length of the whole exercise in beats. */
  beats: number;
  slots: Slot[];
  steps: Step[];
  /** Chord timeline: name + starting beat. */
  chordTimeline: { name: string; beat: number; beats: number }[];
  /** Slots per beat used for display density. */
  maxGrid: number;
  /** Beats in one pass of the pattern (the demo plays one pass). */
  passBeats: number;
  /** Demo note (MIDI) for each step in Picking mode. */
  demoMidi: number[];
};

function chordAt(timeline: { name: string; beat: number; beats: number }[], beat: number) {
  let cur = timeline[0]?.name;
  for (const t of timeline) if (beat + 1e-9 >= t.beat) cur = t.name;
  return cur;
}

const WORD: Record<Dir, string> = { D: "down", U: "up" };

/** Spoken strum words for one pass, e.g. "down, down up, up down up". */
export function strumWords(segs: Segment[]) {
  const slots = slotsOf(segs);
  const groups: string[] = [];
  let cur: string[] = [];
  let lastGroup = 0;
  for (const s of slots) {
    if (s.group !== lastGroup) {
      if (cur.length) groups.push(cur.join(" "));
      cur = [];
      lastGroup = s.group;
    }
    if (!s.rest) cur.push(s.accent ? WORD[s.dir].toUpperCase() : WORD[s.dir]);
  }
  if (cur.length) groups.push(cur.join(" "));
  return groups.join(", ");
}

export function buildExercise(mode: Mode, level: Level, index: number): Exercise {
  if (mode === "picking") {
    const p = PICKING[level][index % PICKING[level].length];
    return expand({ mode, id: p.id, title: p.title, desc: p.desc, say: p.say, segs: p.segs, reps: p.reps, chords: [], strings: p.strings });
  }
  const s = STRUMS[level][index % STRUMS[level].length];
  const chords = BEGINNER_CHANGES[s.id] ?? s.chords;
  const passBeats = segBeats(s.segs);
  const chordBeats = chords.reduce((n, [, b]) => n + b, 0);
  // Repeat the strum pattern until the chord progression is covered (and at least `reps` times)
  const reps = Math.max(s.reps, Math.ceil(chordBeats / passBeats));
  const names = [...new Set(chords.map(([n]) => n))];
  const spokenChords =
    names.length === 1
      ? CHORDS[names[0]].spoken
      : names.map((n) => CHORDS[n].spoken).join(", then ");
  const say = `${spokenChords}: ${strumWords(s.segs)}`;
  return expand({ mode, id: s.id, title: s.title, desc: s.desc, say, segs: s.segs, reps, chords });
}

function expand(x: {
  mode: Mode;
  id: string;
  title: string;
  desc: string;
  say: string;
  segs: Segment[];
  reps: number;
  chords: [string, number][];
  strings?: { seq: number[]; per: number };
}): Exercise {
  const pass = slotsOf(x.segs);
  const passBeats = segBeats(x.segs);
  const beats = passBeats * x.reps;
  const timeline: { name: string; beat: number; beats: number }[] = [];
  if (x.chords.length) {
    let b = 0;
    while (b < beats - 1e-9) {
      for (const [name, len] of x.chords) {
        if (b >= beats - 1e-9) break;
        timeline.push({ name, beat: b, beats: len });
        b += len;
      }
    }
  }
  const slots: Slot[] = [];
  for (let r = 0; r < x.reps; r++) {
    for (const s of pass) {
      const beat = s.beat + r * passBeats;
      slots.push({ ...s, beat, group: Math.floor(beat + 1e-9), chord: timeline.length ? chordAt(timeline, beat) : undefined });
    }
  }
  const steps: Step[] = slots.filter((s) => !s.rest).map((s) => ({ beat: s.beat, dir: s.dir, accent: s.accent, chord: s.chord, group: s.group }));
  return {
    id: x.id,
    mode: x.mode,
    title: x.title,
    desc: x.desc,
    say: x.say,
    beats,
    slots,
    steps,
    chordTimeline: timeline,
    maxGrid: Math.max(...x.segs.map((s) => s.grid)),
    passBeats,
    demoMidi: steps.map((_, i) => {
      const st = x.strings ?? { seq: [45], per: 1 };
      return st.seq[Math.floor(i / st.per) % st.seq.length];
    }),
  };
}

export const EXERCISES_PER_ROUND = 6;

export function roundExercises(mode: Mode, level: Level) {
  return Array.from({ length: EXERCISES_PER_ROUND }, (_, i) => buildExercise(mode, level, i));
}

// ---------------------------------------------------------------- own-pace scoring

/** Chords to play in an exercise, in order (repeats of the same chord merged). */
export function chordSequence(ex: Exercise): string[] {
  const out: string[] = [];
  for (const c of ex.chordTimeline) if (out[out.length - 1] !== c.name) out.push(c.name);
  return out;
}

export type Judgement = "perfect" | "good" | "wrong" | "miss";

export type ExerciseResult = {
  mode: Mode;
  /** Strokes (picking) or chords (chords mode) asked for. */
  total: number;
  /** Strokes heard / chords recognised. */
  done: number;
  /** Strokes in the wrong direction (tap input only). */
  wrong: number;
  /** Chords skipped, or strokes left when the exercise was skipped. */
  skipped: number;
  /** Seconds to get each chord recognised (chords mode). */
  seconds: number[];
  /** Notes on the expected string (mic picking, approximate) / notes checked. */
  stringOk?: number;
  stringChecked?: number;
};

export function exerciseStars(r: ExerciseResult): 0 | 1 | 2 | 3 {
  if (!r.total) return 0;
  const good = (r.done - r.wrong) / r.total;
  if (good >= 1 && r.skipped === 0) return 3;
  if (good >= 0.8) return 2;
  if (good >= 0.4) return 1;
  return 0;
}

/** Leaderboard score (0–5000): how much was played right × level, plus quick-change bonus. */
export function boardScore(results: ExerciseResult[], mode: Mode, level: Level) {
  const info = levelInfo(mode, level);
  const total = results.reduce((n, r) => n + r.total, 0);
  if (!total) return 0;
  const good = results.reduce((n, r) => n + Math.max(0, r.done - r.wrong), 0);
  let bonus = 0;
  for (const r of results) for (const t of r.seconds) bonus += Math.max(0, 1 - t / 10) * 40;
  return Math.max(0, Math.min(5000, Math.round((good / total) * 4000 * info.mult + bonus)));
}

/** Friendly tip after an exercise. */
export function coachTip(r: ExerciseResult, usesDirection: boolean): string {
  if (r.mode === "chords") {
    if (r.skipped) return "Skipped one? Press each finger just behind the fret, then strum all the strings in the chord.";
    const slow = r.seconds.some((t) => t > 8);
    if (slow) return "Changing chords takes practice — look at the diagram and place one finger at a time.";
    return "Your chords ring out clearly!";
  }
  if (r.skipped) return "Take your time — play one stroke for every arrow.";
  if (usesDirection && r.wrong > 1) return "Watch the arrows: down ↓ and up ↑ take turns.";
  if (r.stringChecked && r.stringOk !== undefined && r.stringOk / r.stringChecked < 0.5) return "Check which string you're on — the card tells you.";
  return "Lovely, steady picking!";
}
