/**
 * Clap Rhythm song data.
 *
 * A song is a list of clap moments. Built-in songs are written as melody
 * notes (the clap pattern is the melody rhythm), so the game can also play
 * the tune with a simple synth. Uploaded songs live in /public/clap-songs
 * (see the README there) and can bring their own audio file.
 */

export type SongNote = {
  /** Start time in beats from the first downbeat (beat 0). */
  beat: number;
  /** Length in beats (only used for the synth melody and the note tail). */
  len: number;
  /** MIDI pitch for the synth melody. Omit for a clap without a melody note. */
  midi?: number;
  /** Optional lyric syllable shown next to the clap marker. */
  lyric?: string;
  /** Melody-only note: the synth plays it but there is no clap marker. */
  ghost?: boolean;
};

export type ClapSong = {
  id: string;
  title: string;
  subtitle?: string;
  /** Difficulty 1–5 stars (set in the song data, or computed from the chart). */
  stars: number;
  bpm: number;
  /** Beats per bar (top number of the time signature). */
  beatsPerBar: number;
  /** Total length of the chart in beats (used for the metronome and the end). */
  lengthBeats: number;
  notes: SongNote[];
  /** Optional chord per bar for the synth backing ("C", "G7", "F C" = two halves). */
  chords?: string[];
  /** Optional audio file (mp3/ogg/wav/m4a). When present it replaces the synth. */
  audio?: string;
  /** Seconds into the audio file where beat 0 happens. */
  offset?: number;
  /** Optional exact beat times in seconds (for songs whose tempo drifts); used for the beat lines. */
  beatTimes?: number[];
  /** Kids & nursery-rhyme built-ins are shown in their own row. */
  kids?: boolean;
  /** Uploaded songs come from /public/clap-songs. */
  uploaded?: boolean;
  accent: string;
};

/** The notes that get a clap marker (melody-only "ghost" notes are skipped). */
export function clapNotes(song: ClapSong) {
  return song.notes.filter((n) => !n.ghost);
}

/** Seconds (song time, at 100% speed) for a beat position. */
export function beatToTime(song: ClapSong, beat: number) {
  const spb = 60 / song.bpm;
  return (song.offset ?? 0) + beat * spb;
}

/** Seconds (song time, at 100% speed) for every clap. */
export function clapTimes(song: ClapSong) {
  return clapNotes(song).map((n) => beatToTime(song, n.beat));
}

/**
 * Auto difficulty (1–5 stars) from the chart: claps per second, the shortest gap
 * between claps, how many claps fall off the beat (syncopation) and the tempo.
 */
export function autoStars(song: Pick<ClapSong, "notes" | "bpm" | "offset">) {
  const spb = 60 / song.bpm;
  const notes = song.notes.filter((n) => !n.ghost);
  if (notes.length < 2) return 1;
  const times = notes.map((n) => (song.offset ?? 0) + n.beat * spb);
  const span = Math.max(1, times[times.length - 1] - times[0]);
  const density = notes.length / span;
  let minGap = Infinity;
  for (let i = 1; i < times.length; i++) minGap = Math.min(minGap, times[i] - times[i - 1]);
  const offBeat = notes.filter((n) => Math.abs(n.beat - Math.round(n.beat)) > 0.12).length / notes.length;
  const raw =
    density * 0.6 + offBeat * 1.2 + (minGap < 0.25 ? 0.6 : minGap < 0.35 ? 0.3 : 0) + (span > 60 ? 0.25 : 0) + (song.bpm > 140 ? 0.3 : 0);
  if (raw < 1) return 1;
  if (raw < 1.5) return 2;
  if (raw < 2) return 3;
  if (raw < 2.5) return 4;
  return 5;
}

/** Word label for a star count. */
export function starsLabel(stars: number) {
  return ["", "Very easy", "Easy", "Medium", "Hard", "Expert"][Math.max(1, Math.min(5, stars))];
}

/** Read a difficulty from song data: 1–5, or "Easy" / "Medium" / "Hard". */
export function parseDifficulty(value: unknown): number | null {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  const word = String(value ?? "").toLowerCase();
  const map: Record<string, number> = { "very easy": 1, easy: 2, medium: 3, hard: 4, expert: 5 };
  return map[word] ?? null;
}

export function songDuration(song: ClapSong) {
  return (song.offset ?? 0) + (song.lengthBeats * 60) / song.bpm;
}

type Step = [midi: number | null, len: number, lyric?: string];

/** Turn a list of [midi, beats, lyric] steps into notes; null midi = rest. */
function melody(steps: Step[], startBeat = 0): { notes: SongNote[]; end: number } {
  const notes: SongNote[] = [];
  let beat = startBeat;
  for (const [midi, len, lyric] of steps) {
    if (midi !== null) notes.push({ beat, len, midi, lyric });
    beat += len;
  }
  return { notes, end: beat };
}

// Pitches (C major around middle C)
const G3 = 55, B3 = 59, C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79;

const jingle = melody([
  [E4, 1, "Jin"], [E4, 1, "gle"], [E4, 2, "bells"],
  [E4, 1, "jin"], [E4, 1, "gle"], [E4, 2, "bells"],
  [E4, 1, "jin"], [G4, 1, "gle"], [C4, 1.5, "all"], [D4, 0.5, "the"],
  [E4, 4, "way!"],
  [F4, 1, "Oh"], [F4, 1, "what"], [F4, 1.5, "fun"], [F4, 0.5, "it"],
  [F4, 1, "is"], [E4, 1, "to"], [E4, 1, "ride"], [E4, 0.5, "in"], [E4, 0.5, "a"],
  [E4, 1, "one"], [D4, 1, "horse"], [D4, 1, "o"], [E4, 1, "pen"],
  [D4, 2, "sleigh,"], [G4, 2, "hey!"],
  [E4, 1, "Jin"], [E4, 1, "gle"], [E4, 2, "bells"],
  [E4, 1, "jin"], [E4, 1, "gle"], [E4, 2, "bells"],
  [E4, 1, "jin"], [G4, 1, "gle"], [C4, 1.5, "all"], [D4, 0.5, "the"],
  [E4, 4, "way!"],
  [F4, 1, "Oh"], [F4, 1, "what"], [F4, 1.5, "fun"], [F4, 0.5, "it"],
  [F4, 1, "is"], [E4, 1, "to"], [E4, 1, "ride"], [E4, 0.5, "in"], [E4, 0.5, "a"],
  [G4, 1, "one"], [G4, 1, "horse"], [F4, 1, "o"], [D4, 1, "pen"],
  [C4, 4, "sleigh!"],
]);

// 3/4 with a one-beat pickup (starts on beat 3 of an empty bar)
const birthday = melody(
  [
    [G4, 0.75, "Hap"], [G4, 0.25, "py"],
    [A4, 1, "birth"], [G4, 1, "day"], [C5, 1, "to"],
    [B4, 2, "you,"], [G4, 0.75, "hap"], [G4, 0.25, "py"],
    [A4, 1, "birth"], [G4, 1, "day"], [D5, 1, "to"],
    [C5, 2, "you,"], [G4, 0.75, "hap"], [G4, 0.25, "py"],
    [G5, 1, "birth"], [E5, 1, "day"], [C5, 1, "dear"],
    [B4, 1, "friend"], [A4, 1, "-"], [F5, 0.75, "hap"], [F5, 0.25, "py"],
    [E5, 1, "birth"], [C5, 1, "day"], [D5, 1, "to"],
    [C5, 3, "you!"],
  ],
  2,
);

const twinkle = melody([
  [C4, 1, "Twin"], [C4, 1, "kle"], [G4, 1, "twin"], [G4, 1, "kle"],
  [A4, 1, "lit"], [A4, 1, "tle"], [G4, 2, "star,"],
  [F4, 1, "how"], [F4, 1, "I"], [E4, 1, "won"], [E4, 1, "der"],
  [D4, 1, "what"], [D4, 1, "you"], [C4, 2, "are."],
  [G4, 1, "Up"], [G4, 1, "a"], [F4, 1, "bove"], [F4, 1, "the"],
  [E4, 1, "world"], [E4, 1, "so"], [D4, 2, "high,"],
  [G4, 1, "like"], [G4, 1, "a"], [F4, 1, "dia"], [F4, 1, "mond"],
  [E4, 1, "in"], [E4, 1, "the"], [D4, 2, "sky."],
  [C4, 1, "Twin"], [C4, 1, "kle"], [G4, 1, "twin"], [G4, 1, "kle"],
  [A4, 1, "lit"], [A4, 1, "tle"], [G4, 2, "star,"],
  [F4, 1, "how"], [F4, 1, "I"], [E4, 1, "won"], [E4, 1, "der"],
  [D4, 1, "what"], [D4, 1, "you"], [C4, 2, "are!"],
]);

const mary = melody([
  [E4, 1, "Ma"], [D4, 1, "ry"], [C4, 1, "had"], [D4, 1, "a"],
  [E4, 1, "lit"], [E4, 1, "tle"], [E4, 2, "lamb,"],
  [D4, 1, "lit"], [D4, 1, "tle"], [D4, 2, "lamb,"],
  [E4, 1, "lit"], [G4, 1, "tle"], [G4, 2, "lamb."],
  [E4, 1, "Ma"], [D4, 1, "ry"], [C4, 1, "had"], [D4, 1, "a"],
  [E4, 1, "lit"], [E4, 1, "tle"], [E4, 1, "lamb,"], [E4, 1, "its"],
  [D4, 1, "fleece"], [D4, 1, "was"], [E4, 1, "white"], [D4, 1, "as"],
  [C4, 4, "snow!"],
]);

const baaBaa = melody([
  [C4, 1, "Baa"], [C4, 1, "baa"], [G4, 1, "black"], [G4, 1, "sheep,"],
  [A4, 0.5, "have"], [A4, 0.5, "you"], [A4, 0.5, "a"], [A4, 0.5, "ny"], [G4, 2, "wool?"],
  [F4, 1, "Yes"], [F4, 1, "sir,"], [E4, 1, "yes"], [E4, 1, "sir,"],
  [D4, 1, "three"], [D4, 1, "bags"], [C4, 2, "full."],
  [G4, 1, "One"], [G4, 0.5, "for"], [G4, 0.5, "the"], [F4, 1, "mas"], [F4, 1, "ter,"],
  [E4, 1, "one"], [E4, 0.5, "for"], [E4, 0.5, "the"], [D4, 2, "dame,"],
  [G4, 0.5, "and"], [G4, 0.5, "one"], [G4, 0.5, "for"], [G4, 0.5, "the"], [F4, 0.5, "lit"], [F4, 0.5, "tle"], [F4, 1, "boy"],
  [E4, 0.5, "who"], [E4, 0.5, "lives"], [E4, 0.5, "down"], [E4, 0.5, "the"], [D4, 2, "lane."],
  [C4, 1, "Baa"], [C4, 1, "baa"], [G4, 1, "black"], [G4, 1, "sheep,"],
  [A4, 0.5, "have"], [A4, 0.5, "you"], [A4, 0.5, "a"], [A4, 0.5, "ny"], [G4, 2, "wool?"],
  [F4, 1, "Yes"], [F4, 1, "sir,"], [E4, 1, "yes"], [E4, 1, "sir,"],
  [D4, 1, "three"], [D4, 1, "bags"], [C4, 2, "full!"],
]);

const eieio: Step[] = [[E5, 1, "E"], [E5, 1, "I"], [D5, 1, "E"], [D5, 1, "I"], [C5, 3, "O!"]];
const oldMac = melody([
  [C5, 1, "Old"], [C5, 1, "Mac"], [C5, 1, "Don"], [G4, 1, "ald"], [A4, 1, "had"], [A4, 1, "a"], [G4, 2, "farm,"],
  ...eieio, [G4, 1, "And"],
  [C5, 1, "on"], [C5, 1, "his"], [C5, 1, "farm"], [G4, 1, "he"], [A4, 1, "had"], [A4, 1, "a"], [G4, 2, "cow,"],
  ...eieio, [null, 1],
  [C5, 0.5, "with"], [C5, 0.5, "a"], [C5, 1, "moo"], [C5, 2, "moo"],
  [C5, 0.5, "and"], [C5, 0.5, "a"], [C5, 1, "moo"], [C5, 2, "moo"],
  [C5, 0.5, "here"], [C5, 0.5, "a"], [C5, 1, "moo,"], [C5, 0.5, "there"], [C5, 0.5, "a"], [C5, 1, "moo,"],
  [C5, 0.5, "ev"], [C5, 0.5, "ery"], [C5, 0.5, "where"], [C5, 0.5, "a"], [C5, 1, "moo"], [C5, 1, "moo,"],
  [C5, 1, "Old"], [C5, 1, "Mac"], [C5, 1, "Don"], [G4, 1, "ald"], [A4, 1, "had"], [A4, 1, "a"], [G4, 2, "farm,"],
  ...eieio,
]);

// 6/8 counted in dotted-quarter beats: 1/3 = one eighth note
const T = 1 / 3;
const rowBoat = melody([
  [C4, 1, "Row,"], [C4, 1, "row,"], [C4, 2 * T, "row"], [D4, T, "your"], [E4, 1, "boat"],
  [E4, 2 * T, "gent"], [D4, T, "ly"], [E4, 2 * T, "down"], [F4, T, "the"], [G4, 2, "stream."],
  [C5, T, "Mer"], [C5, T, "ri"], [C5, T, "ly,"], [G4, T, "mer"], [G4, T, "ri"], [G4, T, "ly,"],
  [E4, T, "mer"], [E4, T, "ri"], [E4, T, "ly,"], [C4, T, "mer"], [C4, T, "ri"], [C4, T, "ly,"],
  [G4, 2 * T, "life"], [F4, T, "is"], [E4, 2 * T, "but"], [D4, T, "a"], [C4, 2, "dream."],
  [C4, 1, "Row,"], [C4, 1, "row,"], [C4, 2 * T, "row"], [D4, T, "your"], [E4, 1, "boat"],
  [E4, 2 * T, "gent"], [D4, T, "ly"], [E4, 2 * T, "down"], [F4, T, "the"], [G4, 2, "stream."],
  [C5, T, "Mer"], [C5, T, "ri"], [C5, T, "ly,"], [G4, T, "mer"], [G4, T, "ri"], [G4, T, "ly,"],
  [E4, T, "mer"], [E4, T, "ri"], [E4, T, "ly,"], [C4, T, "mer"], [C4, T, "ri"], [C4, T, "ly,"],
  [G4, 2 * T, "life"], [F4, T, "is"], [E4, 2 * T, "but"], [D4, T, "a"], [C4, 2, "dream!"],
]);

const londonLine: Step[] = [[G4, 1.5, "Lon"], [A4, 0.5, "don"], [G4, 1, "bridge"], [F4, 1, "is"], [E4, 1, "fall"], [F4, 1, "ing"], [G4, 2, "down,"]];
const london = melody([
  ...londonLine,
  [D4, 1, "fall"], [E4, 1, "ing"], [F4, 2, "down,"], [E4, 1, "fall"], [F4, 1, "ing"], [G4, 2, "down."],
  ...londonLine,
  [D4, 2, "my"], [G4, 2, "fair"], [E4, 1, "la"], [C4, 3, "dy."],
  ...londonLine,
  [D4, 1, "fall"], [E4, 1, "ing"], [F4, 2, "down,"], [E4, 1, "fall"], [F4, 1, "ing"], [G4, 2, "down."],
  ...londonLine,
  [D4, 2, "my"], [G4, 2, "fair"], [E4, 1, "la"], [C4, 3, "dy!"],
]);

const wheelsLine = (end: Step[]): Step[] => [
  [C4, 1, "wheels"], [C4, 0.5, "on"], [C4, 0.5, "the"], [C4, 1, "bus"], [E4, 1, "go"],
  [G4, 1, "round"], [E4, 1, "and"], [C4, 2, "round,"],
  ...end,
];
const wheels = melody(
  [
    [G3, 1, "The"],
    ...wheelsLine([[D4, 1, "round"], [B3, 1, "and"], [G3, 2, "round,"], [G4, 1, "round"], [E4, 1, "and"], [C4, 1, "round."], [G3, 1, "The"]]),
    ...wheelsLine([[D4, 1, "all"], [G3, 0.5, "through"], [G3, 0.5, "the"], [C4, 2, "town!"]]),
    [null, 1], [G3, 1, "The"],
    ...wheelsLine([[D4, 1, "round"], [B3, 1, "and"], [G3, 2, "round,"], [G4, 1, "round"], [E4, 1, "and"], [C4, 1, "round."], [G3, 1, "The"]]),
    ...wheelsLine([[D4, 1, "all"], [G3, 0.5, "through"], [G3, 0.5, "the"], [C4, 2, "town!"]]),
  ],
  2,
);

/** "If You're Happy": the synth sings the tune, students clap only on the clap-claps. */
const CLAP = -1;
function happyVerse(start: number): { notes: SongNote[]; end: number } {
  // [midi, beats, lyric]; CLAP = a clap marker with no melody note
  const line = (p: number[], words: string[], end: "claps" | "show"): Step[] => {
    const steps: Step[] = words.map((w, i) => [p[i], 1, w]);
    if (end === "claps") steps.push([CLAP, 1, "clap!"], [CLAP, 1, "clap!"]);
    return steps;
  };
  const words = ["hap", "py", "and", "you", "know", "it", "clap", "your", "hands"];
  const pick = (m: number): Step[] => [[m, 0.5, "If"], [m, 0.5, "you're"]];
  const steps: Step[] = [
    ...pick(G4), ...line([C5, C5, C5, C5, C5, B4, C5, C5, D5], words, "claps"),
    ...pick(G4), ...line([D5, D5, D5, D5, D5, C5, D5, D5, E5], words, "claps"),
    ...pick(E5),
    ...line([F5, F5, F5, F5, F5, F5, G5, G5, F5, F5, E5, E5, D5], ["hap", "py", "and", "you", "know", "it", "then", "your", "face", "will", "sure", "ly", "show"], "show"),
    [D5, 2, "it,"],
    ...pick(D5), ...line([E5, E5, D5, D5, C5, C5, B4, B4, C5], words, "claps"),
  ];
  const notes: SongNote[] = [];
  let beat = start;
  for (const [midi, len, lyric] of steps) {
    if (midi === CLAP) notes.push({ beat, len, lyric });
    else if (midi !== null) notes.push({ beat, len, midi, lyric, ghost: true });
    beat += len;
  }
  return { notes, end: beat };
}
const happy1 = happyVerse(3);
const happy2 = happyVerse(happy1.end);
const HAPPY_CHORDS = ["C", "C", "G", "G", "G", "C", "F", "F", "C", "C", "G", "G", "C"];
const happyKnow = { notes: [...happy1.notes, ...happy2.notes], end: happy2.end + 1 };

const jacquesLines: Step[][] = [
  [[C4, 1, "Are"], [D4, 1, "you"], [E4, 1, "sleep"], [C4, 1, "ing,"]],
  [[E4, 1, "bro"], [F4, 1, "ther"], [G4, 2, "John?"]],
  [[G4, 0.5, "Morn"], [A4, 0.5, "ing"], [G4, 0.5, "bells"], [F4, 0.5, "are"], [E4, 1, "ring"], [C4, 1, "ing,"]],
  [[C4, 1, "ding"], [G3, 1, "dang"], [C4, 2, "dong."]],
];
const jacques = melody(jacquesLines.flatMap((line) => [...line, ...line]));

const hotCross = melody([
  [E4, 1, "Hot"], [D4, 1, "cross"], [C4, 2, "buns,"],
  [E4, 1, "hot"], [D4, 1, "cross"], [C4, 2, "buns,"],
  [C4, 0.5, "one"], [C4, 0.5, "a"], [C4, 0.5, "pen"], [C4, 0.5, "ny,"], [D4, 0.5, "two"], [D4, 0.5, "a"], [D4, 0.5, "pen"], [D4, 0.5, "ny,"],
  [E4, 1, "hot"], [D4, 1, "cross"], [C4, 2, "buns!"],
  [E4, 1, "Hot"], [D4, 1, "cross"], [C4, 2, "buns,"],
  [E4, 1, "hot"], [D4, 1, "cross"], [C4, 2, "buns,"],
  [C4, 0.5, "one"], [C4, 0.5, "a"], [C4, 0.5, "pen"], [C4, 0.5, "ny,"], [D4, 0.5, "two"], [D4, 0.5, "a"], [D4, 0.5, "pen"], [D4, 0.5, "ny,"],
  [E4, 1, "hot"], [D4, 1, "cross"], [C4, 2, "buns!"],
]);

type SongDraft = Omit<ClapSong, "stars"> & { stars?: number };
const withStars = (song: SongDraft): ClapSong => ({ ...song, stars: song.stars ?? autoStars(song) });

export const BUILT_IN_SONGS: ClapSong[] = ([
  {
    id: "jingle-bells",
    stars: 3,
    title: "Jingle Bells",
    subtitle: "Chorus · 4/4 · quarters, halves & quick eighths",
    bpm: 112,
    beatsPerBar: 4,
    lengthBeats: jingle.end,
    notes: jingle.notes,
    chords: ["C", "C", "C", "C", "F", "C", "D7", "G7", "C", "C", "C", "C", "F", "C", "G7", "C"],
    accent: "#e8962e",
  },
  {
    id: "happy-birthday",
    title: "Happy Birthday",
    subtitle: "3/4 waltz · pickup beat · dotted rhythms",
    bpm: 96,
    beatsPerBar: 3,
    lengthBeats: birthday.end,
    notes: birthday.notes,
    chords: ["", "C", "G7", "G7", "C", "C7", "F", "G7", "C"],
    accent: "#1a9fd4",
  },
  {
    id: "twinkle-twinkle",
    title: "Twinkle Twinkle Little Star",
    subtitle: "4/4 · steady quarters",
    bpm: 96,
    beatsPerBar: 4,
    lengthBeats: twinkle.end,
    notes: twinkle.notes,
    chords: ["C", "F C", "F C", "G C", "C F", "C G", "C F", "C G", "C", "F C", "F C", "G C"],
    kids: true,
    accent: "#8b5cf6",
  },
  {
    id: "mary-lamb",
    title: "Mary Had a Little Lamb",
    subtitle: "4/4 · quarters & halves",
    bpm: 104,
    beatsPerBar: 4,
    lengthBeats: mary.end,
    notes: mary.notes,
    chords: ["C", "C", "G", "C", "C", "C", "G", "C"],
    kids: true,
    accent: "#14b8a6",
  },
  {
    id: "if-youre-happy",
    title: "If You're Happy and You Know It",
    subtitle: "Sing along, clap on the clap-claps!",
    bpm: 104,
    beatsPerBar: 4,
    lengthBeats: happyKnow.end,
    notes: happyKnow.notes,
    chords: ["", ...HAPPY_CHORDS, ...HAPPY_CHORDS],
    kids: true,
    accent: "#f59e0b",
  },
  {
    id: "hot-cross-buns",
    stars: 2,
    title: "Hot Cross Buns",
    subtitle: "4/4 · three notes, quick eighths",
    bpm: 96,
    beatsPerBar: 4,
    lengthBeats: hotCross.end,
    notes: hotCross.notes,
    chords: ["C", "C", "C G", "C", "C", "C", "C G", "C"],
    kids: true,
    accent: "#ef4444",
  },
  {
    id: "baa-baa-black-sheep",
    title: "Baa Baa Black Sheep",
    subtitle: "4/4 · quarters & eighths",
    bpm: 100,
    beatsPerBar: 4,
    lengthBeats: baaBaa.end,
    notes: baaBaa.notes,
    chords: ["C", "F C", "G C", "G C", "C F", "C G", "C F", "C G", "C", "F C", "G C", "G C"],
    kids: true,
    accent: "#334155",
  },
  {
    id: "old-macdonald",
    title: "Old MacDonald Had a Farm",
    subtitle: "4/4 · E-I-E-I-O and moo-moos",
    bpm: 112,
    beatsPerBar: 4,
    lengthBeats: oldMac.end,
    notes: oldMac.notes,
    chords: ["C", "F C", "G", "C", "C", "F C", "G", "C", "C", "C", "C", "C", "C", "F C", "G", "C"],
    kids: true,
    accent: "#16a34a",
  },
  {
    id: "london-bridge",
    title: "London Bridge",
    subtitle: "4/4 · dotted rhythm start",
    bpm: 104,
    beatsPerBar: 4,
    lengthBeats: london.end,
    notes: london.notes,
    chords: ["C", "G7 C", "G7", "C", "C", "G7 C", "G7", "C", "C", "G7 C", "G7", "C", "C", "G7 C", "G7", "C"],
    kids: true,
    accent: "#0ea5e9",
  },
  {
    id: "wheels-on-the-bus",
    title: "The Wheels on the Bus",
    subtitle: "4/4 · pickup beat · round and round",
    bpm: 108,
    beatsPerBar: 4,
    lengthBeats: wheels.end,
    notes: wheels.notes,
    chords: ["", "C", "C", "G", "C", "C", "C", "G C", "C", "C", "C", "G", "C", "C", "C", "G C", "C"],
    kids: true,
    accent: "#eab308",
  },
  {
    id: "frere-jacques",
    stars: 2,
    title: "Frère Jacques",
    subtitle: "4/4 · round · eighths in line 3",
    bpm: 100,
    beatsPerBar: 4,
    lengthBeats: jacques.end,
    notes: jacques.notes,
    chords: ["C", "C", "C", "C", "C", "C", "C", "C"],
    kids: true,
    accent: "#a855f7",
  },
  {
    id: "row-your-boat",
    stars: 3,
    title: "Row, Row, Row Your Boat",
    subtitle: "6/8 · gentle swing · merrily triplets",
    bpm: 66,
    beatsPerBar: 2,
    lengthBeats: rowBoat.end,
    notes: rowBoat.notes,
    chords: ["C", "C", "C", "C", "C", "G7 C", "C", "C", "C", "C", "C", "G7 C"],
    kids: true,
    accent: "#06b6d4",
  },
] as SongDraft[]).map(withStars);

/** How many uploadable song slots the song picker shows. */
export const UPLOAD_SLOTS = 8;

const ACCENTS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#d946ef", "#ec4899"];

/** Shape of a song JSON file in /public/clap-songs. */
export type SongFile = {
  id?: string;
  title?: string;
  subtitle?: string;
  /** 1–5 stars, or "Easy" / "Medium" / "Hard". Computed from the chart when missing. */
  difficulty?: number | string;
  bpm?: number;
  beatsPerBar?: number;
  timeSignature?: string | [number, number];
  audio?: string;
  offset?: number;
  /** Clap moments in beats (beat 0 = first downbeat after `offset`). */
  claps?: number[];
  /** Or clap moments in seconds from the start of the audio. */
  clapTimes?: number[];
  /** Optional melody notes (beats) instead of claps. */
  notes?: SongNote[];
  /** Optional lyric syllable per clap. */
  lyrics?: string[];
  chords?: string[];
  lengthBeats?: number;
  durationSeconds?: number;
  /** Optional beat times in seconds (for the beat lines when the tempo drifts). */
  beatTimes?: number[];
};

/** Validate and convert a song JSON file into a playable song. Returns null if unusable. */
export function normalizeSong(raw: SongFile, index: number, base = "/clap-songs/"): ClapSong | null {
  if (!raw || typeof raw !== "object") return null;
  const bpm = Number(raw.bpm) > 20 && Number(raw.bpm) < 400 ? Number(raw.bpm) : 100;
  let beatsPerBar = Number(raw.beatsPerBar) || 4;
  if (raw.timeSignature) {
    const top = Array.isArray(raw.timeSignature) ? raw.timeSignature[0] : Number(String(raw.timeSignature).split("/")[0]);
    if (Number(top) > 0 && Number(top) < 16) beatsPerBar = Number(top);
  }
  const offset = Number(raw.offset) || 0;
  const spb = 60 / bpm;
  let notes: SongNote[] = [];
  if (Array.isArray(raw.notes) && raw.notes.length) {
    notes = raw.notes
      .filter((n) => Number.isFinite(Number(n?.beat)))
      .map((n) => ({ beat: Number(n.beat), len: Number(n.len) || 0.5, midi: n.midi, lyric: n.lyric }));
  } else if (Array.isArray(raw.claps) && raw.claps.length) {
    notes = raw.claps.filter((b) => Number.isFinite(Number(b))).map((b) => ({ beat: Number(b), len: 0.5 }));
  } else if (Array.isArray(raw.clapTimes) && raw.clapTimes.length) {
    notes = raw.clapTimes
      .filter((s) => Number.isFinite(Number(s)))
      .map((s) => ({ beat: (Number(s) - offset) / spb, len: 0.5 }));
  }
  notes.sort((a, b) => a.beat - b.beat);
  if (Array.isArray(raw.lyrics)) notes.forEach((n, i) => { if (raw.lyrics?.[i]) n.lyric = String(raw.lyrics[i]); });
  if (!notes.length) return null;
  // Lengths for clap-only charts: up to the next clap
  notes.forEach((n, i) => {
    if (!raw.notes) n.len = notes[i + 1] ? Math.max(0.25, Math.min(0.5, notes[i + 1].beat - n.beat)) : 0.5;
  });
  const last = notes[notes.length - 1];
  let lengthBeats = Number(raw.lengthBeats) || last.beat + last.len + 1;
  if (Number(raw.durationSeconds) > 0) lengthBeats = Math.max(lengthBeats, (Number(raw.durationSeconds) - offset) / spb);
  let audio = raw.audio ? String(raw.audio) : undefined;
  if (audio && !/^(https?:)?\//.test(audio)) audio = base + audio;
  const beatTimes = Array.isArray(raw.beatTimes)
    ? raw.beatTimes.map(Number).filter((t) => Number.isFinite(t)).sort((a, b) => a - b)
    : undefined;
  const draft = { notes, bpm, offset };
  return {
    id: String(raw.id || `uploaded-${index + 1}`),
    title: String(raw.title || `Song ${index + 1}`).slice(0, 60),
    subtitle: raw.subtitle ? String(raw.subtitle).slice(0, 80) : `${beatsPerBar}/4 · ${Math.round(bpm)} BPM`,
    stars: parseDifficulty(raw.difficulty) ?? autoStars(draft),
    bpm,
    beatsPerBar,
    lengthBeats,
    beatTimes: beatTimes && beatTimes.length > 1 ? beatTimes : undefined,
    notes,
    chords: Array.isArray(raw.chords) ? raw.chords.map(String) : undefined,
    audio,
    offset,
    uploaded: true,
    accent: ACCENTS[index % ACCENTS.length],
  };
}

/** Load uploaded songs listed in /public/clap-songs/songs.json. */
export async function loadUploadedSongs(): Promise<ClapSong[]> {
  try {
    const res = await fetch("/clap-songs/songs.json", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { songs?: (string | SongFile)[] } | (string | SongFile)[];
    const list = Array.isArray(data) ? data : data.songs || [];
    const out: ClapSong[] = [];
    for (const [i, entry] of list.slice(0, 40).entries()) {
      let raw: SongFile | null = null;
      if (typeof entry === "string") {
        const url = /^(https?:)?\//.test(entry) ? entry : `/clap-songs/${entry}`;
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (r.ok) raw = (await r.json()) as SongFile;
        } catch {
          raw = null;
        }
      } else {
        raw = entry;
      }
      const song = raw ? normalizeSong(raw, i) : null;
      if (song) out.push(song);
    }
    return out;
  } catch {
    return [];
  }
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Very small chord parser for the synth backing: C, Cm, C7, Cmaj7, F#m, Bb. */
export function chordMidis(name: string): number[] | null {
  const m = /^([A-G])([#b]?)(m(?!aj))?(maj7|7)?$/.exec(name.trim());
  if (!m) return null;
  let root = NOTE_INDEX[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  root = ((root % 12) + 12) % 12;
  const base = 48 + root; // around C3
  const third = m[3] ? 3 : 4;
  const notes = [base, base + third, base + 7];
  if (m[4] === "7") notes.push(base + 10);
  if (m[4] === "maj7") notes.push(base + 11);
  return notes;
}

/** Star rating from accuracy (0–1). */
export function starsFor(accuracy: number) {
  if (accuracy >= 0.95) return 5;
  if (accuracy >= 0.85) return 4;
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.5) return 2;
  return accuracy > 0 ? 1 : 0;
}
