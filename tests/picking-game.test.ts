import { describe, expect, it } from "vitest";
import { boardKey, getGame } from "../app/games/catalog";
import {
  CHORDS,
  LEVELS,
  PICKING,
  STRUMS,
  boardScore,
  buildExercise,
  chordSequence,
  exerciseStars,
  type ExerciseResult,
  roundExercises,
  slotsOf,
  strumWords,
  type Level,
  type Mode,
} from "../app/games/picking/patterns";

const LEVEL_IDS: Level[] = ["beginner", "expert", "pro"];
const MODES: Mode[] = ["picking", "chords"];

describe("alternate picking catalog entry", () => {
  it("is a guitar game with picking + chords leaderboards", () => {
    const g = getGame("alternate-picking");
    expect(g?.category).toBe("guitar");
    expect(g?.kind).toBe("pick-coach");
    expect(boardKey("alternate-picking", "picking")).toBe("alternate-picking:picking");
    expect(boardKey("alternate-picking", "chords")).toBe("alternate-picking:chords");
    expect(boardKey("alternate-picking", null)).toBeNull();
  });
});

describe("levels", () => {
  it("each mode has Beginner, Expert and Pro with rising multipliers", () => {
    for (const mode of MODES) {
      expect(LEVELS[mode].map((l) => l.id)).toEqual(["beginner", "expert", "pro"]);
      const [b, e, p] = LEVELS[mode];
      expect(b.mult).toBeLessThan(e.mult);
      expect(e.mult).toBeLessThan(p.mult);
    }
  });
});

describe("patterns", () => {
  it("every pattern fills whole beats", () => {
    for (const lvl of LEVEL_IDS) {
      for (const p of [...PICKING[lvl], ...STRUMS[lvl]]) {
        for (const seg of p.segs) expect(seg.s.length % seg.grid, `${p.id}`).toBe(0);
        expect(/^[dDuU-]+$/.test(p.segs.map((s) => s.s).join("")), p.id).toBe(true);
      }
    }
  });

  it("strictly alternates: down on even grid slots, up on odd ones (rests are air strokes)", () => {
    for (const lvl of LEVEL_IDS) {
      for (const p of [...PICKING[lvl], ...STRUMS[lvl]]) {
        for (const seg of p.segs) {
          if (seg.grid === 1) {
            expect(seg.s.toLowerCase().replace(/-/g, ""), p.id).toMatch(/^d+$/);
            continue;
          }
          [...seg.s].forEach((ch, i) => {
            if (ch === "-") return;
            expect(ch.toLowerCase(), `${p.id} slot ${i}`).toBe(i % 2 === 0 ? "d" : "u");
          });
        }
      }
    }
  });

  it("gets harder: more strokes per beat at higher levels", () => {
    const density = (mode: Mode, lvl: Level) => {
      const list = roundExercises(mode, lvl);
      return list.reduce((n, e) => n + e.steps.length / e.beats, 0) / list.length;
    };
    for (const mode of MODES) {
      expect(density(mode, "beginner")).toBeLessThan(density(mode, "expert"));
      expect(density(mode, "expert")).toBeLessThan(density(mode, "pro"));
    }
  });

  it("parses slots and spoken strum words", () => {
    const slots = slotsOf([{ grid: 2, s: "d-du-udu" }]);
    expect(slots).toHaveLength(8);
    expect(slots.filter((s) => !s.rest).map((s) => s.dir).join("")).toBe("DDUUDU");
    expect(slots[2].beat).toBe(1);
    expect(strumWords([{ grid: 2, s: "d-du-udu" }])).toBe("down, down up, up, down up");
  });
});

describe("chords", () => {
  it("every exercise chord has a diagram with 6 strings", () => {
    for (const lvl of LEVEL_IDS) {
      for (const ex of roundExercises("chords", lvl)) {
        expect(ex.chordTimeline.length).toBeGreaterThan(0);
        for (const c of ex.chordTimeline) {
          const shape = CHORDS[c.name];
          expect(shape, c.name).toBeTruthy();
          expect(shape.frets).toHaveLength(6);
          expect(shape.fingers).toHaveLength(6);
        }
        for (const s of ex.steps) expect(s.chord).toBeTruthy();
      }
    }
  });

  it("beginner uses only open G C D Em Am; pro uses barre chords and changes every 2 beats", () => {
    const beg = new Set(roundExercises("chords", "beginner").flatMap((e) => e.chordTimeline.map((c) => c.name)));
    expect([...beg].every((n) => ["G", "C", "D", "Em", "Am"].includes(n))).toBe(true);
    const pro = roundExercises("chords", "pro");
    expect(pro.some((e) => e.chordTimeline.some((c) => CHORDS[c.name].barre))).toBe(true);
    expect(pro.some((e) => e.chordTimeline.some((c) => c.beats === 2))).toBe(true);
    const exp = roundExercises("chords", "expert");
    expect(exp.some((e) => new Set(e.chordTimeline.map((c) => c.name)).size >= 3)).toBe(true);
  });

  it("speaks the chord name and the strum", () => {
    const ex = buildExercise("chords", "beginner", 0);
    expect(ex.say).toBe("G major: down, down, down, down");
    const ex2 = buildExercise("chords", "beginner", 4);
    expect(ex2.say).toContain("G major, then C major");
    expect(ex2.chordTimeline.map((c) => c.name)).toEqual(["G", "C"]);
  });
});

describe("own-pace scoring", () => {
  const res = (p: Partial<ExerciseResult>): ExerciseResult => ({ mode: "picking", total: 8, done: 8, wrong: 0, skipped: 0, seconds: [], ...p });

  it("chord exercises list each chord once per change", () => {
    expect(chordSequence(buildExercise("chords", "beginner", 0))).toEqual(["G"]);
    expect(chordSequence(buildExercise("chords", "beginner", 4))).toEqual(["G", "C"]);
    expect(chordSequence(buildExercise("chords", "expert", 1))).toEqual(["A", "D", "E", "A"]);
    expect(chordSequence(buildExercise("chords", "pro", 1))).toEqual(["Bm", "G", "D", "A"]);
  });

  it("stars: all played = 3, wrong directions and skips cost stars", () => {
    expect(exerciseStars(res({}))).toBe(3);
    expect(exerciseStars(res({ wrong: 1 }))).toBe(2);
    expect(exerciseStars(res({ wrong: 4 }))).toBe(1);
    expect(exerciseStars(res({ done: 0, skipped: 8 }))).toBe(0);
    expect(exerciseStars(res({ mode: "chords", total: 4, done: 3, skipped: 1, seconds: [2, 2, 2] }))).toBe(1);
  });

  it("board score stays within 0–5000 and rewards level and quick chord changes", () => {
    for (const mode of MODES) for (const l of LEVELS[mode]) {
      expect(boardScore([res({ seconds: Array(200).fill(0) })], mode, l.id)).toBeLessThanOrEqual(5000);
      expect(boardScore([res({ done: 0, skipped: 8 })], mode, l.id)).toBe(0);
    }
    expect(boardScore([res({})], "picking", "pro")).toBeGreaterThan(boardScore([res({})], "picking", "beginner"));
    const quick = boardScore([res({ mode: "chords", total: 4, done: 4, seconds: [1, 1, 1, 1] })], "chords", "pro");
    const slow = boardScore([res({ mode: "chords", total: 4, done: 4, seconds: [9, 9, 9, 9] })], "chords", "pro");
    expect(quick).toBeGreaterThan(slow);
  });
});
