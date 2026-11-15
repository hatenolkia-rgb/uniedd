import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  beatsPerBar,
  buildSong,
  chartProblems,
  clickBeat,
  keyboardRange,
  midiToName,
  noteToMidi,
  parseTrack,
  type PianoSongFile,
} from "../app/games/piano/charts";
import { accuracyOf, boardScoreOf, expiredNotes, gradeFor, matchPress, WINDOWS, type JudgeNote } from "../app/games/piano/judge";
import { freqToMidi, midiToFreq, pitchMatches, yin } from "../app/games/piano/pitch";
import { decodeMidi } from "../app/games/piano/midi";
import { diatonic, keyAt, layout, staffGeom } from "../app/games/piano/stage";
import { boardKey } from "../app/games/catalog";

const dir = join(__dirname, "..", "public", "piano-songs");
const list = JSON.parse(readFileSync(join(dir, "songs.json"), "utf8")) as { songs: string[] };
const files = list.songs.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as PianoSongFile);
const byId = (id: string) => buildSong(files.find((f) => f.id === id)!);
/** Right-hand pitches and lengths, in order (chords flattened top-first is not needed: melodies are single notes). */
const melody = (id: string) => byId(id).notes.filter((n) => n.hand === "R");
const names = (id: string, count: number) => melody(id).slice(0, count).map((n) => midiToName(n.midi));
const lens = (id: string, count: number) => melody(id).slice(0, count).map((n) => n.len);

// ---------- pitch → note ----------

/** A piano-like tone: decaying harmonics with a little string stretch and some noise. */
function pianoTone(midi: number, sr = 48000, n = 2400, opts: { weakFundamental?: boolean; noise?: number } = {}) {
  const f = midiToFreq(midi);
  const buf = new Float32Array(n);
  const amps = opts.weakFundamental ? [0.25, 1, 0.6, 0.4, 0.25, 0.15] : [1, 0.5, 0.3, 0.18, 0.1, 0.05];
  let seed = midi * 7919;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    amps.forEach((a, k) => {
      const h = k + 1;
      if (f * h < sr / 2) v += a * Math.sin(2 * Math.PI * f * h * (1 + 0.0004 * h * h) * t + k);
    });
    buf[i] = 0.3 * v * Math.exp(-t * 3) + (opts.noise ?? 0) * rnd();
  }
  return buf;
}

describe("pitch detection → MIDI note", () => {
  it("maps frequencies to the nearest note with cents", () => {
    expect(freqToMidi(440)).toEqual({ midi: 69, cents: 0 });
    expect(freqToMidi(261.63).midi).toBe(60);
    expect(freqToMidi(27.5).midi).toBe(21);
    expect(freqToMidi(4186).midi).toBe(108);
    expect(freqToMidi(450).midi).toBe(69); // +39 cents still A4
    expect(freqToMidi(450).cents).toBe(39);
    expect(freqToMidi(455).midi).toBe(70); // +58 cents rounds to A#4
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
  });

  it("YIN finds every charted note from A2 to C6 on a piano-like tone", () => {
    for (let m = 45; m <= 84; m++) {
      for (const sr of [44100, 48000]) {
        const n = Math.round(sr * 0.05);
        const p = yin(pianoTone(m, sr, n, { noise: 0.01 }), sr, { minFreq: 60, maxFreq: 2200 });
        expect(p, `${midiToName(m)} @${sr}`).not.toBeNull();
        expect(freqToMidi(p!.freq).midi, `${midiToName(m)} @${sr}`).toBe(m);
        expect(p!.clarity).toBeGreaterThan(0.75);
      }
    }
  });

  it("does not jump an octave up when the fundamental is weak (low piano notes)", () => {
    for (const m of [38, 40, 43, 45, 47, 50]) {
      const p = yin(pianoTone(m, 48000, 2400, { weakFundamental: true }), 48000, { minFreq: 60 * 0.6, maxFreq: 2200 });
      expect(freqToMidi(p!.freq).midi, midiToName(m)).toBe(m);
    }
  });

  it("rejects silence and noise", () => {
    expect(yin(new Float32Array(2400), 48000)).toBeNull();
    let seed = 1;
    const noise = new Float32Array(2400).map(() => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5) * 0.5;
    });
    const p = yin(noise, 48000);
    expect(p === null || p.clarity < 0.75).toBe(true);
  });

  it("mic mode forgives octave slips only when asked", () => {
    expect(pitchMatches(60, 60, false)).toBe(true);
    expect(pitchMatches(72, 60, false)).toBe(false);
    expect(pitchMatches(72, 60, true)).toBe(true);
    expect(pitchMatches(48, 60, true)).toBe(true);
    expect(pitchMatches(61, 60, true)).toBe(false);
    expect(pitchMatches(84, 60, true)).toBe(false);
  });
});

// ---------- timing judgement ----------

describe("timing judgement", () => {
  const W = WINDOWS.normal;
  const notes = (): JudgeNote[] => [
    { id: 0, midi: 60, t: 1, judged: false, scored: true },
    { id: 1, midi: 64, t: 1, judged: false, scored: true }, // chord with the C
    { id: 2, midi: 62, t: 1.5, judged: false, scored: true },
    { id: 3, midi: 60, t: 2, judged: false, scored: false }, // other hand, not scored
    { id: 4, midi: 60, t: 3, judged: false, scored: true },
  ];

  it("grades by distance from the line", () => {
    expect(gradeFor(0, W)).toBe("perfect");
    expect(gradeFor(0.07, W)).toBe("perfect");
    expect(gradeFor(-0.071, W)).toBe("good");
    expect(gradeFor(0.15, W)).toBe("good");
    expect(gradeFor(0.151, W)).toBeNull();
  });

  it("matches the right key in the window, closest note first", () => {
    const ns = notes();
    expect(matchPress(ns, 60, 1.03, 1, W)).toMatchObject({ index: 0, grade: "perfect" });
    expect(matchPress(ns, 64, 0.9, 1, W)).toMatchObject({ index: 1, grade: "good" });
    expect(matchPress(ns, 62, 1.0, 1, W)).toBeNull(); // D is 0.5 s away
    expect(matchPress(ns, 61, 1.0, 1, W)).toBeNull(); // wrong key
    expect(matchPress(ns, 60, 2.0, 1, W)).toBeNull(); // the unscored left-hand C doesn't count
  });

  it("each note can only be hit once (chords need every key)", () => {
    const ns = notes();
    const a = matchPress(ns, 60, 1, 1, W)!;
    ns[a.index].judged = true;
    expect(matchPress(ns, 60, 1.01, 1, W)).toBeNull();
    expect(matchPress(ns, 64, 1.01, 1, W)).toMatchObject({ index: 1 });
  });

  it("windows are in real time, so slower speeds keep the same feel", () => {
    const ns = notes();
    // at 50% speed, 0.1 song-seconds late = 0.2 s real → miss window
    expect(matchPress(ns, 60, 1.1, 0.5, W)).toBeNull();
    expect(matchPress(ns, 60, 1.03, 0.5, W)).toMatchObject({ grade: "perfect" });
  });

  it("mic matching can accept an octave slip", () => {
    const ns = notes();
    expect(matchPress(ns, 72, 1, 1, WINDOWS.mic, (h, e) => pitchMatches(h, e, true))).toMatchObject({ index: 0 });
  });

  it("expires notes that passed the line, skipping unscored ones", () => {
    const ns = notes();
    expect(expiredNotes(ns, 1.1, 1, W)).toEqual([]);
    expect(expiredNotes(ns, 1.2, 1, W)).toEqual([0, 1]);
    expect(expiredNotes(ns, 2.5, 1, W)).toEqual([0, 1, 2]);
    expect(expiredNotes(ns, 1.2, 1, W, 0.1)).toEqual([]);
  });

  it("scores accuracy and the leaderboard like Clap Rhythm", () => {
    expect(accuracyOf(10, 0, 10)).toBe(1);
    expect(accuracyOf(5, 5, 10)).toBeCloseTo(0.8);
    expect(boardScoreOf(1, 10, 10, 1)).toBe(5000);
    expect(boardScoreOf(1, 10, 10, 0.5)).toBe(2500);
  });
});

// ---------- MIDI ----------

describe("MIDI messages", () => {
  it("decodes note on/off on any channel and ignores pedals", () => {
    expect(decodeMidi([0x90, 60, 127])).toEqual({ midi: 60, velocity: 1, on: true });
    expect(decodeMidi([0x93, 64, 64])).toMatchObject({ midi: 64, on: true });
    expect(decodeMidi([0x90, 60, 0])).toMatchObject({ on: false });
    expect(decodeMidi([0x80, 60, 40])).toMatchObject({ on: false });
    expect(decodeMidi([0xb0, 64, 127])).toBeNull();
    expect(decodeMidi([0xf8])).toBeNull();
  });
});

// ---------- charts ----------

describe("piano song charts", () => {
  it("parses the notation", () => {
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("A4")).toBe(69);
    expect(noteToMidi("F#5")).toBe(78);
    expect(noteToMidi("Bb3")).toBe(58);
    expect(noteToMidi("A0")).toBe(21);
    expect(noteToMidi("H4")).toBeNull();
    const p = parseTrack("C4 D4:0.5 r:0.5 C4+E4+G4:2 |");
    expect(p.bars).toEqual([4]);
    expect(p.events.map((e) => e.beat)).toEqual([0, 1, 2]);
    expect(p.events[2].midis).toEqual([60, 64, 67]);
    expect(beatsPerBar([6, 8])).toBe(3);
    expect(beatsPerBar([3, 8])).toBe(1.5);
    expect(clickBeat([6, 8])).toBe(1.5);
    expect(clickBeat([3, 4])).toBe(1);
  });

  it("catches bars that don't add up", () => {
    const bad: PianoSongFile = { id: "x", title: "x", level: 1, bpm: 90, timeSig: [4, 4], credit: "", tracks: [{ hand: "R", notes: "C4 D4 E4 | F4:2" }] };
    expect(chartProblems(bad).length).toBeGreaterThan(0);
  });

  it("has at least 12 songs across all four levels, unique ids", () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
    expect(new Set(files.map((f) => f.id)).size).toBe(files.length);
    for (const lv of [1, 2, 3, 4]) expect(files.some((f) => f.level === lv), `level ${lv}`).toBe(true);
  });

  for (const f of files) {
    it(`${f.title}: every bar adds up, hands line up, notes on the keyboard`, () => {
      expect(chartProblems(f)).toEqual([]);
      expect(f.credit.length).toBeGreaterThan(3);
      const s = buildSong(f);
      expect(s.notes.length).toBeGreaterThan(8);
      const [lo, hi] = keyboardRange(s.minMidi, s.maxMidi);
      expect(lo % 12).toBe(0);
      expect(hi % 12).toBe(11);
      expect(hi - lo + 1).toBeLessThanOrEqual(60); // at most 5 octaves on screen
      // 0.25 beat (a sixteenth) is the shortest note; notes always start on that grid
      for (const n of s.notes) {
        expect(n.len).toBeGreaterThanOrEqual(0.25);
        expect(Math.abs(n.beat * 4 - Math.round(n.beat * 4))).toBeLessThan(1e-9);
      }
      // melody notes in each hand never overlap (a single line, not a smear)
      for (const hand of ["R", "L"] as const) {
        const line = s.notes.filter((n) => n.hand === hand && n.main);
        for (let i = 1; i < line.length; i++) expect(line[i].beat).toBeGreaterThanOrEqual(line[i - 1].beat + line[i - 1].len - 1e-9);
      }
    });
  }

  it("every song has a right-hand (treble) and a left-hand (bass) part for all three modes", () => {
    for (const f of files) {
      expect(f.tracks.map((t) => t.hand).sort(), f.title).toEqual(["L", "R"]);
      const s = buildSong(f);
      const r = s.notes.filter((n) => n.hand === "R");
      const l = s.notes.filter((n) => n.hand === "L");
      expect(l.length, f.title).toBeGreaterThanOrEqual(4);
      // the left hand sits lower: its average pitch is below the right hand's, and mostly in the bass clef
      const avg = (ns: { midi: number }[]) => ns.reduce((a, n) => a + n.midi, 0) / ns.length;
      expect(avg(l), f.title).toBeLessThan(avg(r) - 7);
      expect(l.filter((n) => n.midi <= 62).length / l.length, f.title).toBeGreaterThanOrEqual(0.6);
      // the two hands never need the same key at the same time
      for (const a of r)
        for (const b of l)
          if (a.midi === b.midi) expect(a.beat + a.len <= b.beat + 1e-9 || b.beat + b.len <= a.beat + 1e-9, `${f.title} ${midiToName(a.midi)}`).toBe(true);
    }
  });

  it("left-hand bass fits the melody on strong beats (consonant: unison/octave, 3rd, 5th, 6th)", () => {
    const CONSONANT = new Set([0, 3, 4, 7, 8, 9]);
    for (const f of files) {
      const s = buildSong(f);
      const pickup = f.pickup ?? 0;
      const bpb = s.beatsPerBar;
      // strong beats: every downbeat, plus the middle of 4/4 and 6/8 bars where the bass moves
      const half = f.timeSig[0] === 4 || (f.timeSig[0] === 6 && f.timeSig[1] === 8) ? bpb / 2 : null;
      const sounding = (hand: "R" | "L", t: number) => s.notes.filter((n) => n.hand === hand && n.beat <= t + 1e-9 && t < n.beat + n.len - 1e-9);
      const checks: number[] = [];
      for (let bar = pickup; bar < s.lengthBeats - 1e-9; bar += bpb) {
        checks.push(bar);
        if (half !== null && s.notes.some((n) => n.hand === "L" && Math.abs(n.beat - (bar + half)) < 1e-9)) checks.push(bar + half);
      }
      let checked = 0;
      for (const t of checks) {
        for (const r of sounding("R", t))
          for (const l of sounding("L", t)) {
            checked++;
            const iv = (((r.midi - l.midi) % 12) + 12) % 12;
            expect(CONSONANT.has(iv), `${f.title} beat ${t}: ${midiToName(r.midi)} over ${midiToName(l.midi)}`).toBe(true);
          }
      }
      expect(checked, f.title).toBeGreaterThanOrEqual(3);
    }
  });

  // Independent checks against the well-known melodies (letter names + rhythm of the opening).
  it("Twinkle Twinkle: C C G G A A G, F F E E D D C", () => {
    expect(names("twinkle-twinkle", 14)).toEqual(["C4", "C4", "G4", "G4", "A4", "A4", "G4", "F4", "F4", "E4", "E4", "D4", "D4", "C4"]);
    expect(lens("twinkle-twinkle", 7)).toEqual([1, 1, 1, 1, 1, 1, 2]);
  });
  it("Mary Had a Little Lamb: E D C D E E E", () => {
    expect(names("mary-had-a-little-lamb", 7)).toEqual(["E4", "D4", "C4", "D4", "E4", "E4", "E4"]);
    expect(lens("mary-had-a-little-lamb", 7)).toEqual([1, 1, 1, 1, 1, 1, 2]);
  });
  it("Ode to Joy: E E F G G F E D C C D E E. D D", () => {
    expect(names("ode-to-joy", 15)).toEqual(["E4", "E4", "F4", "G4", "G4", "F4", "E4", "D4", "C4", "C4", "D4", "E4", "E4", "D4", "D4"]);
    expect(lens("ode-to-joy", 15).slice(12)).toEqual([1.5, 0.5, 2]);
  });
  it("Jingle Bells: E E E, E E E, E G C D E", () => {
    expect(names("jingle-bells", 11)).toEqual(["E4", "E4", "E4", "E4", "E4", "E4", "E4", "G4", "C4", "D4", "E4"]);
    expect(lens("jingle-bells", 11)).toEqual([1, 1, 2, 1, 1, 2, 1, 1, 1.5, 0.5, 4]);
  });
  it("Happy Birthday: pickup G G, then A G C B in 3/4", () => {
    const s = byId("happy-birthday");
    expect(s.timeSig).toEqual([3, 4]);
    expect(names("happy-birthday", 6)).toEqual(["G4", "G4", "A4", "G4", "C5", "B4"]);
    expect(melody("happy-birthday")[2].beat).toBe(1); // bar 1 starts after a one-beat pickup
    // "Happy birthday dear …" leaps up an octave to G5
    expect(names("happy-birthday", 16).slice(12)).toEqual(["G4", "G4", "G5", "E5"]);
  });
  it("Für Elise: E D# E D# E B D C A in 3/8 with a sixteenth pickup", () => {
    expect(names("fur-elise", 9)).toEqual(["E5", "D#5", "E5", "D#5", "E5", "B4", "D5", "C5", "A4"]);
    expect(lens("fur-elise", 8).every((l) => l === 0.25)).toBe(true);
    const s = byId("fur-elise");
    expect(s.beatsPerBar).toBe(1.5);
    // the left hand's A–E–A answers on the A
    const lh = s.notes.filter((n) => n.hand === "L").slice(0, 3).map((n) => midiToName(n.midi));
    expect(lh).toEqual(["A2", "E3", "A3"]);
  });
  it("Minuet in G: D G A B C D G G", () => {
    expect(names("minuet-in-g", 8)).toEqual(["D5", "G4", "A4", "B4", "C5", "D5", "G4", "G4"]);
    expect(lens("minuet-in-g", 8)).toEqual([1, 0.5, 0.5, 0.5, 0.5, 1, 1, 1]);
  });
  it("Canon in D: bass D A B F# G D G A under F# E D C# B A B C#", () => {
    const s = byId("canon-in-d");
    expect(s.notes.filter((n) => n.hand === "L").slice(0, 8).map((n) => midiToName(n.midi))).toEqual(["D3", "A2", "B2", "F#2", "G2", "D2", "G2", "A2"]);
    expect(names("canon-in-d", 8)).toEqual(["F#5", "E5", "D5", "C#5", "B4", "A4", "B4", "C#5"]);
  });
  it("Row Row Row: dotted rhythm in 6/8 and the merrily run", () => {
    expect(lens("row-row-row-your-boat", 5)).toEqual([1.5, 1.5, 1, 0.5, 1.5]);
    expect(names("row-row-row-your-boat", 22).slice(10, 22)).toEqual(["C5", "C5", "C5", "G4", "G4", "G4", "E4", "E4", "E4", "C4", "C4", "C4"]);
  });
  it("London Bridge: G. A G F E F G", () => {
    expect(names("london-bridge", 7)).toEqual(["G4", "A4", "G4", "F4", "E4", "F4", "G4"]);
    expect(lens("london-bridge", 2)).toEqual([1.5, 0.5]);
  });
  it("every song ends on its home note", () => {
    const home: Record<string, number> = { C: 0, G: 7, D: 2, Am: 9 };
    for (const f of files) {
      const s = buildSong(f);
      const last = s.notes.filter((n) => n.hand === "R").at(-1)!;
      // Canon's simplified melody ends on F#, the third of D major
      const ok = (last.midi - home[f.key ?? "C"] + 120) % 12 === 0 || (f.id === "canon-in-d" && last.midi % 12 === 6);
      expect(ok, f.title).toBe(true);
    }
  });
});

// ---------- on-screen keyboard ----------

describe("on-screen keyboard", () => {
  it("finds the key under a tap, black keys on top", () => {
    const l = layout(1400, 600, 48, 71); // C3..B4: 14 white keys of 100 px
    expect(l.whiteW).toBe(100);
    const y = l.kbTop + l.kbH - 5;
    expect(keyAt(l, 48, 71, 50, y)).toBe(48);
    expect(keyAt(l, 48, 71, 150, y)).toBe(50);
    expect(keyAt(l, 48, 71, 100, l.kbTop + 5)).toBe(49); // C#3 sits between C and D
    expect(keyAt(l, 48, 71, 100, y)).toBe(50); // below the black key = white key
    expect(keyAt(l, 48, 71, 100, l.kbTop - 20)).toBeNull();
  });
});

describe("grand staff and modes", () => {
  it("places notes on the right staff line or space", () => {
    expect(diatonic(60)).toEqual({ d: 28, sharp: false }); // middle C, ledger line between the staves
    expect(diatonic(64).d).toBe(30); // E4: treble bottom line
    expect(diatonic(77).d).toBe(38); // F5: treble top line
    expect(diatonic(57).d).toBe(26); // A3: bass top line
    expect(diatonic(43).d).toBe(18); // G2: bass bottom line
    expect(diatonic(66)).toEqual({ d: 31, sharp: true }); // F#4 sits on the F space with a sharp
    expect(diatonic(73)).toEqual({ d: 35, sharp: true }); // C#5
  });

  it("the staff fits above the falling notes on a phone and a desktop", () => {
    for (const [W, H] of [
      [844, 390],
      [1440, 860],
    ]) {
      const l = layout(W, H, 36, 83);
      const sg = staffGeom(W, H, l.kbH, { show: true, clef: "beast", barTimes: [], minD: 16, maxD: 40 })!;
      expect(sg.bottom).toBeLessThan(l.hitY - 100);
      const withStaff = layout(W, H, 36, 83, { show: true, clef: "beast", barTimes: [], minD: 16, maxD: 40 });
      expect(withStaff.topPad).toBeGreaterThan(sg.bottom);
    }
  });

  it("each mode has its own leaderboard", () => {
    expect(boardKey("piano-falling-notes", "treble")).toBe("piano-falling-notes:treble");
    expect(boardKey("piano-falling-notes", "bass")).toBe("piano-falling-notes:bass");
    expect(boardKey("piano-falling-notes", "beast")).toBe("piano-falling-notes:beast");
    expect(boardKey("piano-falling-notes", "nope")).toBeNull();
    expect(boardKey("piano-falling-notes", null)).toBeNull();
    expect(boardKey("clap-rhythm", null)).toBe("clap-rhythm");
    expect(boardKey("clap-rhythm", "treble")).toBeNull();
  });
});
