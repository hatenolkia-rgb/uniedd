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
};

export type ClapSong = {
  id: string;
  title: string;
  subtitle?: string;
  difficulty: "Easy" | "Medium" | "Hard";
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
  /** Bonus built-ins are shown in their own row. */
  bonus?: boolean;
  /** Uploaded songs come from /public/clap-songs. */
  uploaded?: boolean;
  accent: string;
};

/** Seconds (song time, at 100% speed) for every clap. */
export function clapTimes(song: ClapSong) {
  const spb = 60 / song.bpm;
  return song.notes.map((n) => (song.offset ?? 0) + n.beat * spb);
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
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79;

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

export const BUILT_IN_SONGS: ClapSong[] = [
  {
    id: "jingle-bells",
    title: "Jingle Bells",
    subtitle: "Chorus · 4/4 · quarters, halves & quick eighths",
    difficulty: "Medium",
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
    difficulty: "Medium",
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
    subtitle: "Warm-up · 4/4 · steady quarters",
    difficulty: "Easy",
    bpm: 96,
    beatsPerBar: 4,
    lengthBeats: twinkle.end,
    notes: twinkle.notes,
    chords: ["C", "F C", "F C", "G C", "C F", "C G", "C F", "C G", "C", "F C", "F C", "G C"],
    bonus: true,
    accent: "#8b5cf6",
  },
  {
    id: "mary-lamb",
    title: "Mary Had a Little Lamb",
    subtitle: "Warm-up · 4/4 · quarters & halves",
    difficulty: "Easy",
    bpm: 104,
    beatsPerBar: 4,
    lengthBeats: mary.end,
    notes: mary.notes,
    chords: ["C", "C", "G", "C", "C", "C", "G", "C"],
    bonus: true,
    accent: "#14b8a6",
  },
];

/** How many uploadable song slots the song picker shows. */
export const UPLOAD_SLOTS = 8;

const ACCENTS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#d946ef", "#ec4899"];

/** Shape of a song JSON file in /public/clap-songs. */
export type SongFile = {
  id?: string;
  title?: string;
  subtitle?: string;
  difficulty?: string;
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
    if (!raw.notes && notes[i + 1]) n.len = Math.max(0.25, notes[i + 1].beat - n.beat);
  });
  const last = notes[notes.length - 1];
  let lengthBeats = Number(raw.lengthBeats) || last.beat + last.len + 1;
  if (Number(raw.durationSeconds) > 0) lengthBeats = Math.max(lengthBeats, (Number(raw.durationSeconds) - offset) / spb);
  const difficulty = raw.difficulty === "Easy" || raw.difficulty === "Hard" ? raw.difficulty : "Medium";
  let audio = raw.audio ? String(raw.audio) : undefined;
  if (audio && !/^(https?:)?\//.test(audio)) audio = base + audio;
  return {
    id: String(raw.id || `uploaded-${index + 1}`),
    title: String(raw.title || `Song ${index + 1}`).slice(0, 60),
    subtitle: raw.subtitle ? String(raw.subtitle).slice(0, 80) : `${beatsPerBar}/4 · ${Math.round(bpm)} BPM`,
    difficulty,
    bpm,
    beatsPerBar,
    lengthBeats,
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
