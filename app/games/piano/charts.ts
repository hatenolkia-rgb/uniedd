/**
 * Piano Falling Notes — song charts.
 *
 * Charts live in /public/piano-songs/*.json and are written in a small text notation so
 * every bar can be checked by eye and by the tests:
 *
 *   "C4 D4 E4:2 | G4:1.5 A4:0.5 r:2 | C4+E4+G4:4"
 *
 * - tokens are separated by spaces, bars by "|"
 * - NOTE[:beats]   one note (default 1 beat = one quarter note)
 * - A+B+C[:beats]  a chord (all notes start together)
 * - r[:beats]      a rest
 * Note names: C D E F G A B with optional # or b, then the octave (C4 = middle C = MIDI 60).
 * Beats are always quarter notes, so a 3/4 bar adds up to 3 and a 6/8 bar to 3 (six eighths).
 */

export type Hand = "R" | "L";

export type PianoSongFile = {
  id: string;
  title: string;
  /** 1 Beginner · 2 Easy · 3 Intermediate · 4 Advanced */
  level: 1 | 2 | 3 | 4;
  bpm: number;
  timeSig: [number, number];
  /** Length of the pickup (anacrusis) in quarter beats; the last bar completes it. */
  pickup?: number;
  key?: string;
  /** "sargam" shows Sa Re Ga… on the notes by default. */
  labels?: "letters" | "sargam";
  credit: string;
  blurb?: string;
  tracks: { hand: Hand; notes: string }[];
};

export type ChartNote = {
  id: number;
  midi: number;
  /** start in quarter beats from the first note of the song (pickup included) */
  beat: number;
  /** length in quarter beats */
  len: number;
  /** start and length in song seconds at 100% speed */
  t: number;
  dur: number;
  hand: Hand;
  /** The note the microphone listens for: the top note of each chord/event in its hand. */
  main: boolean;
};

export type PianoSong = PianoSongFile & {
  notes: ChartNote[];
  beatsPerBar: number;
  lengthBeats: number;
  minMidi: number;
  maxMidi: number;
};

export const LEVELS = ["", "Beginner", "Easy", "Intermediate", "Advanced"] as const;

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** Sargam relative to the song's tonic (Sa); komal/tivra marked the usual way. */
const SARGAM = ["Sa", "re", "Re", "ga", "Ga", "Ma", "Ma'", "Pa", "dha", "Dha", "ni", "Ni"];

export function noteToMidi(name: string): number | null {
  const m = /^([A-Ga-g])(#|b)?(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const pc = PC[m[1].toUpperCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return (Number(m[3]) + 1) * 12 + pc;
}

export function midiToName(midi: number) {
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function midiLabel(midi: number, mode: "letters" | "sargam", tonic = 0) {
  if (mode === "sargam") return SARGAM[(((midi - tonic) % 12) + 12) % 12];
  return SHARP_NAMES[((midi % 12) + 12) % 12];
}

export function isBlack(midi: number) {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

/** Quarter beats in one bar: 4/4 → 4, 3/4 → 3, 6/8 → 3, 3/8 → 1.5. */
export function beatsPerBar([num, den]: [number, number]) {
  return (num * 4) / den;
}

export type ParsedEvent = { beat: number; len: number; midis: number[] };
export type ParsedTrack = { bars: number[]; events: ParsedEvent[]; total: number };

/** Parse one track. Throws with a readable message on a bad token. */
export function parseTrack(src: string): ParsedTrack {
  const bars: number[] = [];
  const events: ParsedEvent[] = [];
  let beat = 0;
  const barTexts = src.split("|").map((b) => b.trim());
  // allow a trailing "|"
  if (barTexts.length > 1 && barTexts[barTexts.length - 1] === "") barTexts.pop();
  for (const bar of barTexts) {
    let sum = 0;
    for (const tok of bar.split(/\s+/).filter(Boolean)) {
      const [head, lenStr] = tok.split(":");
      const len = lenStr === undefined ? 1 : Number(lenStr);
      if (!Number.isFinite(len) || len <= 0) throw new Error(`Bad length in "${tok}"`);
      if (head !== "r") {
        const midis = head.split("+").map((n) => {
          const m = noteToMidi(n);
          if (m === null) throw new Error(`Bad note "${n}" in "${tok}"`);
          return m;
        });
        events.push({ beat, len, midis });
      }
      beat += len;
      sum += len;
    }
    bars.push(sum);
  }
  return { bars, events, total: beat };
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Problems with a chart: bars that don't add up, tracks of different lengths, notes off the keyboard. */
export function chartProblems(file: PianoSongFile): string[] {
  const out: string[] = [];
  const bpb = beatsPerBar(file.timeSig);
  const pickup = file.pickup ?? 0;
  let length: number | null = null;
  for (const tr of file.tracks) {
    let p: ParsedTrack;
    try {
      p = parseTrack(tr.notes);
    } catch (e) {
      out.push(`${tr.hand}: ${(e as Error).message}`);
      continue;
    }
    p.bars.forEach((sum, i) => {
      const last = i === p.bars.length - 1;
      const want = pickup && i === 0 ? pickup : pickup && last ? bpb - pickup : bpb;
      if (!close(sum, want)) out.push(`${tr.hand} bar ${i + (pickup ? 0 : 1)}: ${sum} beats, expected ${want}`);
    });
    for (const ev of p.events) for (const m of ev.midis) if (m < 21 || m > 108) out.push(`${tr.hand}: ${midiToName(m)} is off an 88-key piano`);
    if (length === null) length = p.total;
    else if (!close(length, p.total)) out.push(`${tr.hand}: track is ${p.total} beats, others are ${length}`);
  }
  if (!file.tracks.some((t) => t.hand === "R")) out.push("needs a right-hand (melody) track");
  return out;
}

export function buildSong(file: PianoSongFile): PianoSong {
  const spb = 60 / file.bpm;
  const notes: ChartNote[] = [];
  let lengthBeats = 0;
  for (const tr of file.tracks) {
    const p = parseTrack(tr.notes);
    lengthBeats = Math.max(lengthBeats, p.total);
    for (const ev of p.events) {
      const top = Math.max(...ev.midis);
      for (const midi of ev.midis) {
        notes.push({
          id: 0,
          midi,
          beat: ev.beat,
          len: ev.len,
          t: ev.beat * spb,
          dur: ev.len * spb,
          hand: tr.hand,
          main: midi === top,
        });
      }
    }
  }
  notes.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  notes.forEach((n, i) => (n.id = i));
  const midis = notes.map((n) => n.midi);
  return {
    ...file,
    notes,
    beatsPerBar: beatsPerBar(file.timeSig),
    lengthBeats,
    minMidi: Math.min(...midis),
    maxMidi: Math.max(...midis),
  };
}

/** Visible keyboard: whole octaves C..B around the song, at least two octaves. */
export function keyboardRange(minMidi: number, maxMidi: number): [number, number] {
  let lo = Math.floor(minMidi / 12) * 12;
  let hi = Math.floor(maxMidi / 12) * 12 + 11;
  while (hi - lo + 1 < 24) {
    if (hi < 96) hi += 12;
    else lo -= 12;
  }
  return [lo, hi];
}

/** Metronome clicks: [beat positions per bar unit] — quarters in x/4, dotted quarters in 6/8, eighths in 3/8. */
export function clickBeat(timeSig: [number, number]) {
  const [num, den] = timeSig;
  if (den === 8 && num % 3 === 0 && num > 3) return 1.5;
  if (den === 8) return 0.5;
  return 4 / den;
}

export async function loadPianoSongs(base = "/piano-songs"): Promise<PianoSong[]> {
  const list = (await fetch(`${base}/songs.json`, { cache: "no-cache" }).then((r) => r.json())) as { songs: string[] };
  const files = await Promise.all(
    list.songs.map((f) =>
      fetch(`${base}/${f}`)
        .then((r) => r.json() as Promise<PianoSongFile>)
        .catch(() => null),
    ),
  );
  return files.filter((f): f is PianoSongFile => !!f && chartProblems(f).length === 0).map(buildSong);
}
