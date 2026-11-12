import { describe, expect, it } from "vitest";
import { BANKS } from "../app/games/questions";
import { GAMES } from "../app/games/catalog";
import {
  areEnharmonic,
  buildScale,
  chordShapePitchClasses,
  CIRCLE,
  FRET_MARKERS,
  fretNote,
  INTERVALS,
  KEY_SIGNATURES,
  midiToName,
  nameToPc,
  noteAtFret,
  NOTE_FLAT,
  NOTE_NAMES,
  OPEN_CHORD_TONES,
  OPEN_CHORDS,
  SHARP_ORDER,
  FLAT_ORDER,
  SOLFEGE,
  SOLFEGE_STEPS,
  staffBottomDegree,
  staffDegree,
  staffStepsFromBottom,
} from "../app/games/theory";

/** Independent standard-tuning map: string 1 = high E4, string 6 = low E2. */
const INDEPENDENT_OPEN: Record<number, number> = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const INDEPENDENT_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function independentMidiToName(midi: number) {
  return INDEPENDENT_SHARP[((midi % 12) + 12) % 12];
}

function independentNoteAtFret(stringNumber: number, fret: number) {
  return INDEPENDENT_OPEN[stringNumber] + fret;
}

describe("fretboard note math", () => {
  it("uses standard tuning E2 A2 D3 G3 B3 E4 (string 6 to 1)", () => {
    expect(independentNoteAtFret(6, 0)).toBe(40); // E2
    expect(independentNoteAtFret(5, 0)).toBe(45); // A2
    expect(independentNoteAtFret(4, 0)).toBe(50); // D3
    expect(independentNoteAtFret(3, 0)).toBe(55); // G3
    expect(independentNoteAtFret(2, 0)).toBe(59); // B3
    expect(independentNoteAtFret(1, 0)).toBe(64); // E4
    expect(independentMidiToName(40)).toBe("E");
    expect(independentMidiToName(45)).toBe("A");
    expect(independentMidiToName(50)).toBe("D");
    expect(independentMidiToName(55)).toBe("G");
    expect(independentMidiToName(59)).toBe("B");
    expect(independentMidiToName(64)).toBe("E");
  });

  it("matches game generators for every string and fret 0–12", () => {
    for (let stringNumber = 1; stringNumber <= 6; stringNumber++) {
      for (let fret = 0; fret <= 12; fret++) {
        const independent = independentNoteAtFret(stringNumber, fret);
        expect(noteAtFret(stringNumber, fret)).toBe(independent);
        expect(fretNote(stringNumber - 1, fret)).toBe(independent);
        expect(midiToName(noteAtFret(stringNumber, fret))).toBe(independentMidiToName(independent));
      }
    }
  });

  it("treats B–C and E–F as half steps", () => {
    expect(independentMidiToName(independentNoteAtFret(2, 1))).toBe("C"); // B string fret 1
    expect(independentMidiToName(independentNoteAtFret(1, 1))).toBe("F"); // high E fret 1
    expect(noteAtFret(2, 1) - noteAtFret(2, 0)).toBe(1);
    expect(noteAtFret(6, 1) - noteAtFret(6, 0)).toBe(1);
    expect(midiToName(noteAtFret(2, 0))).toBe("B");
    expect(midiToName(noteAtFret(2, 1))).toBe("C");
    expect(midiToName(noteAtFret(1, 0))).toBe("E");
    expect(midiToName(noteAtFret(1, 1))).toBe("F");
  });

  it("accepts enharmonic spellings", () => {
    expect(areEnharmonic("C#", "Db")).toBe(true);
    expect(areEnharmonic("F#", "Gb")).toBe(true);
    expect(areEnharmonic("E", "Fb")).toBe(true);
    expect(areEnharmonic("E", "F")).toBe(false);
    expect(areEnharmonic(midiToName(noteAtFret(5, 1)), "Bb")).toBe(true); // A string fret 1 = A# / Bb
  });

  it("has standard fret markers, doubled at the 12th", () => {
    expect([...FRET_MARKERS]).toEqual([3, 5, 7, 9, 12]);
  });
});

describe("intervals", () => {
  const independent: Record<string, number> = {
    "Minor 2nd": 1,
    "Major 2nd": 2,
    "Minor 3rd": 3,
    "Major 3rd": 4,
    "Perfect 4th": 5,
    Tritone: 6,
    "Perfect 5th": 7,
    "Minor 6th": 8,
    "Major 6th": 9,
    "Minor 7th": 10,
    "Major 7th": 11,
    Octave: 12,
  };

  it("matches independent semitone counts and unique names", () => {
    for (const [label, semitones] of Object.entries(independent)) {
      const row = INTERVALS.find((item) => item.label === label);
      expect(row, label).toBeTruthy();
      expect(row!.semitones).toBe(semitones);
    }
    const semis = INTERVALS.map((item) => item.semitones);
    expect(new Set(semis).size).toBe(semis.length);
  });
});

describe("scales and modes", () => {
  const expected: Record<string, [string, string[]]> = {
    "C major": ["C", ["C", "D", "E", "F", "G", "A", "B"]],
    "G major": ["G", ["G", "A", "B", "C", "D", "E", "F#"]],
    "D major": ["D", ["D", "E", "F#", "G", "A", "B", "C#"]],
    "F major": ["F", ["F", "G", "A", "Bb", "C", "D", "E"]],
    "A minor": ["A", ["A", "B", "C", "D", "E", "F", "G"]],
    "E minor": ["E", ["E", "F#", "G", "A", "B", "C", "D"]],
    "C major pentatonic": ["C", ["C", "D", "E", "G", "A"]],
    "A minor pentatonic": ["A", ["A", "C", "D", "E", "G"]],
    "G blues": ["G", ["G", "Bb", "C", "Db", "D", "F"]],
    "C blues": ["C", ["C", "Eb", "F", "Gb", "G", "Bb"]],
    "D dorian": ["D", ["D", "E", "F", "G", "A", "B", "C"]],
    "E phrygian": ["E", ["E", "F", "G", "A", "B", "C", "D"]],
    "F lydian": ["F", ["F", "G", "A", "B", "C", "D", "E"]],
    "G mixolydian": ["G", ["G", "A", "B", "C", "D", "E", "F"]],
    "B locrian": ["B", ["B", "C", "D", "E", "F", "G", "A"]],
  };

  it("spells scales and modes independently", () => {
    for (const [label, [root, notes]] of Object.entries(expected)) {
      const type = label.slice(root.length + 1) as Parameters<typeof buildScale>[1];
      expect(buildScale(root, type)).toEqual(notes);
    }
  });
});

describe("key signatures", () => {
  it("uses the standard sharp and flat orders", () => {
    expect([...SHARP_ORDER]).toEqual(["F#", "C#", "G#", "D#", "A#", "E#", "B#"]);
    expect([...FLAT_ORDER]).toEqual(["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"]);
  });

  it("matches independent counts, spellings and relative minors", () => {
    const independent = [
      ["C", 0, "natural", "A"],
      ["G", 1, "sharp", "E"],
      ["D", 2, "sharp", "B"],
      ["A", 3, "sharp", "F#"],
      ["E", 4, "sharp", "C#"],
      ["B", 5, "sharp", "G#"],
      ["F", 1, "flat", "D"],
      ["Bb", 2, "flat", "G"],
      ["Eb", 3, "flat", "C"],
      ["Ab", 4, "flat", "F"],
    ] as const;
    for (const [name, count, kind, relative] of independent) {
      const row = KEY_SIGNATURES.find((item) => item.name === name);
      expect(row, name).toBeTruthy();
      expect(row!.count).toBe(count);
      expect(row!.kind).toBe(kind);
      expect(row!.relativeMinor).toBe(relative);
      if (kind === "sharp") expect(row!.accidentals).toEqual([...SHARP_ORDER.slice(0, count)]);
      if (kind === "flat") expect(row!.accidentals).toEqual([...FLAT_ORDER.slice(0, count)]);
    }
  });
});

describe("circle of fifths", () => {
  it("steps clockwise by a perfect fifth", () => {
    for (let i = 0; i < CIRCLE.length; i++) {
      const from = CIRCLE[i];
      const to = CIRCLE[(i + 1) % CIRCLE.length];
      expect((nameToPc(from) + 7) % 12).toBe(nameToPc(to));
    }
  });
});

describe("staff positions", () => {
  it("puts E4 on the bottom treble line and G2 on the bottom bass line", () => {
    expect(staffBottomDegree("treble")).toBe(staffDegree("E", 4));
    expect(staffBottomDegree("bass")).toBe(staffDegree("G", 2));
    expect(staffStepsFromBottom("E", 4, "treble")).toBe(0);
    expect(staffStepsFromBottom("G", 2, "bass")).toBe(0);
    expect(staffStepsFromBottom("F", 5, "treble")).toBe(8);
    expect(staffStepsFromBottom("A", 3, "bass")).toBe(8);
    expect(staffStepsFromBottom("C", 4, "treble")).toBe(-2);
    expect(staffStepsFromBottom("F", 3, "bass")).toBe(6);
  });
});

describe("piano black keys", () => {
  it("has black keys after C D F G A only", () => {
    const after = { C: "C#", D: "D#", E: null, F: "F#", G: "G#", A: "A#", B: null };
    for (const [letter, sharp] of Object.entries(after)) {
      const pc = nameToPc(letter);
      if (sharp) {
        expect(NOTE_NAMES[(pc + 1) % 12]).toBe(sharp);
        expect(NOTE_FLAT[(pc + 1) % 12]).not.toBe(letter);
      } else {
        expect(["E", "B"]).toContain(letter);
        expect(NOTE_NAMES[(pc + 1) % 12]).toBe(letter === "E" ? "F" : "C");
      }
    }
  });
});

describe("open chord shapes", () => {
  it("only contains chord tones for each named shape", () => {
    for (const shape of OPEN_CHORDS) {
      const expected = OPEN_CHORD_TONES[shape.name];
      expect(expected, shape.name).toBeTruthy();
      const sounded = chordShapePitchClasses(shape);
      expect(sounded.length).toBeGreaterThan(0);
      for (const pc of sounded) {
        expect(expected).toContain(pc);
      }
      for (const tone of expected) {
        expect(sounded).toContain(tone);
      }
    }
  });
});

describe("solfege", () => {
  it("maps Do–Ti to the major scale", () => {
    expect([...SOLFEGE]).toEqual(["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"]);
    expect([...SOLFEGE_STEPS]).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
});

describe("static quiz banks", () => {
  it("gives every question exactly one in-range correct option", () => {
    for (const [bank, questions] of Object.entries(BANKS)) {
      expect(questions.length).toBeGreaterThan(0);
      for (const question of questions) {
        expect(question.choices.length).toBeGreaterThanOrEqual(2);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.choices.length);
        const unique = new Set(question.choices);
        expect(unique.size, `${bank}: ${question.q}`).toBe(question.choices.length);
      }
    }
  });

  it("does not treat E and Fb as different pitches", () => {
    const item = BANKS["sharps-flats"].find((q) => q.q.includes("NOT the same"));
    expect(item).toBeTruthy();
    expect(item!.choices[item!.answer]).toBe("E and F");
    expect(item!.choices.includes("E and Fb")).toBe(false);
    expect(areEnharmonic("E", "Fb")).toBe(true);
  });

  it("covers every catalog quiz bank", () => {
    for (const game of GAMES.filter((item) => item.kind === "quiz")) {
      expect(game.quizBank && BANKS[game.quizBank], game.slug).toBeTruthy();
    }
  });
});

describe("catalog", () => {
  it("lists 31 distinct games", () => {
    expect(GAMES).toHaveLength(31);
    expect(new Set(GAMES.map((game) => game.slug)).size).toBe(31);
  });
});
