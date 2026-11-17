import { describe, expect, it } from "vitest";
import { boardKey, getGame } from "../app/games/catalog";
import {
  CHORDS,
  LEVELS,
  LiveJudge,
  PICKING,
  STRUMS,
  boardScore,
  buildExercise,
  roundExercises,
  slotsOf,
  strumWords,
  targetTimes,
  windowsFor,
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
  it("have rising, non-trivial BPM ranges", () => {
    for (const mode of MODES) {
      const [b, e, p] = LEVELS[mode];
      expect(b.bpm.max).toBeLessThan(p.bpm.max);
      expect(b.bpm.min).toBeLessThan(e.bpm.min);
      expect(e.bpm.min).toBeLessThan(p.bpm.min);
      for (const l of LEVELS[mode]) {
        expect(l.bpm.def).toBeGreaterThanOrEqual(l.bpm.min);
        expect(l.bpm.def).toBeLessThanOrEqual(l.bpm.max);
      }
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

describe("judge", () => {
  const ex = buildExercise("picking", "beginner", 1); // 8ths, 2 bars
  const bpm = 60;
  const targets = targetTimes(ex, bpm, 10);
  const win = windowsFor(targets.map((t) => t.t), 1);

  it("windows never overlap neighbours", () => {
    expect(win.good).toBeLessThanOrEqual(0.25);
    const fast = buildExercise("picking", "pro", 3);
    const ft = targetTimes(fast, 160, 0).map((t) => t.t);
    const w = windowsFor(ft, 1);
    const gap = Math.min(...ft.slice(1).map((t, i) => t - ft[i]));
    expect(w.good).toBeLessThanOrEqual(gap / 2 + 1e-9);
    expect(w.perfect).toBeLessThan(w.good);
  });

  it("perfect play scores 100% and 3 stars", () => {
    const j = new LiveJudge(targets, win);
    for (const t of targets) expect(j.input(t.t + 0.01)?.result).toBe("perfect");
    const s = j.summary();
    expect(s.accuracy).toBe(1);
    expect(s.stars).toBe(3);
    expect(s.maxStreak).toBe(targets.length);
  });

  it("tap direction is checked; mic (no direction) is timing-only", () => {
    const j = new LiveJudge(targets, win);
    expect(j.input(targets[0].t, "U")?.result).toBe("wrong");
    expect(j.input(targets[1].t, "U")?.result).toBe("perfect");
    expect(j.input(targets[2].t)?.result).toBe("perfect");
  });

  it("counts late strokes as good, misses and extras", () => {
    const j = new LiveJudge(targets, win);
    expect(j.input(targets[0].t + win.perfect + 0.01)?.result).toBe("good");
    expect(j.input(targets[0].t + 0.2)).toBeNull(); // between notes -> extra
    expect(j.extra).toBe(1);
    j.expire(targets[targets.length - 1].t + 1);
    const s = j.summary();
    expect(s.miss).toBe(targets.length - 1);
    expect(s.stars).toBe(0);
  });

  it("board score stays within 0–5000 and rewards level and speed", () => {
    for (const mode of MODES) {
      for (const l of LEVELS[mode]) {
        expect(boardScore(1, 999, mode, l.id, l.bpm.max)).toBeLessThanOrEqual(5000);
        expect(boardScore(0, 0, mode, l.id, l.bpm.min)).toBe(0);
      }
      expect(boardScore(0.9, 10, mode, "pro", 120)).toBeGreaterThan(boardScore(0.9, 10, mode, "beginner", 60));
    }
    expect(boardScore(0.9, 10, "picking", "pro", 150)).toBeGreaterThan(boardScore(0.9, 10, "picking", "pro", 110));
  });
});
