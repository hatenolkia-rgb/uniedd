import { describe, expect, it } from "vitest";
import { StrokeTracker, checkChordShape, fingerArches, judgeCameraSequence, pickStrummingHand, type CamStroke, type Pt } from "../app/games/picking/camera";

/** Simulate a hand swinging down/up; stroke i (down when even) peaks at start + i·strokeDur. */
function swing(opts: { bpm: number; perBeat: number; beats: number; fps: number; amp?: number; start?: number }) {
  const { bpm, perBeat, beats, fps, amp = 0.15, start = 1 } = opts;
  const strokeDur = 60 / bpm / perBeat;
  const out: { t: number; y: number }[] = [];
  for (let t = 0; t < start + beats * (60 / bpm); t += 1 / fps) {
    const y = t < start - strokeDur / 2 ? 0.5 - amp / 2 : 0.5 + (amp / 2) * Math.sin((Math.PI * (t - start)) / strokeDur);
    out.push({ t, y });
  }
  return { samples: out, strokeDur };
}

describe("StrokeTracker", () => {
  it("finds alternating down/up strokes near the expected times at 8ths, 80 BPM, 30 fps", () => {
    const bpm = 80;
    const { samples, strokeDur } = swing({ bpm, perBeat: 2, beats: 4, fps: 30 });
    const tr = new StrokeTracker();
    const strokes = samples.map((s) => tr.push(s.t, s.y)).filter(Boolean) as { t: number; dir: string }[];
    expect(strokes.length).toBeGreaterThanOrEqual(7);
    // alternating
    for (let i = 1; i < strokes.length; i++) expect(strokes[i].dir).not.toBe(strokes[i - 1].dir);
    // spaced about one stroke apart
    const gaps = strokes.slice(1).map((s, i) => s.t - strokes[i].t);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(Math.abs(avg - strokeDur)).toBeLessThan(0.05);
    // the first stroke is a down stroke at ~1 s (peak speed), within a frame or two
    expect(strokes[0].dir).toBe("D");
    expect(Math.abs(strokes[0].t - 1)).toBeLessThan(0.07);
  });

  it("ignores tiny jitter", () => {
    const tr = new StrokeTracker();
    let n = 0;
    for (let i = 0; i < 120; i++) if (tr.push(i / 30, 0.5 + (i % 2 ? 0.004 : -0.004))) n++;
    expect(n).toBe(0);
  });
});

describe("judgeCameraSequence (own pace, no tempo)", () => {
  const st = (dirs: string, gap = 0.4): CamStroke[] => [...dirs].map((d, i) => ({ t: 1 + i * gap, dir: d as "D" | "U", amp: 0.1 }));
  it("all right", () => {
    const r = judgeCameraSequence(["D", "U", "D", "U"], st("DUDU"));
    expect(r).toMatchObject({ right: 4, wrong: 0, missed: 0, extra: 0, total: 4, uneven: false });
  });
  it("flags wrong direction, missed and extra strokes", () => {
    expect(judgeCameraSequence(["D", "U", "D", "U"], st("DDDU")).wrong).toBe(1);
    expect(judgeCameraSequence(["D", "U", "D", "U"], st("DU")).missed).toBe(2);
    expect(judgeCameraSequence(["D", "U"], st("DUUD")).extra).toBe(1); // one follow-through is free
  });
  it("return swings between two downs and a wind-up are not mistakes", () => {
    const r = judgeCameraSequence(["D", "D", "D", "D"], st("UDUDUDUDU"));
    expect(r).toMatchObject({ right: 4, wrong: 0, missed: 0, extra: 0 });
  });
  it("spots uneven strokes", () => {
    const strokes = [1, 1.3, 2.4, 2.6, 3.9, 4.0].map((t, i) => ({ t, dir: (i % 2 ? "U" : "D") as "D" | "U", amp: 0.1 }));
    expect(judgeCameraSequence(["D", "U", "D", "U", "D", "U"], strokes).uneven).toBe(true);
  });
  it("chords mode just counts strokes", () => {
    expect(judgeCameraSequence(null, st("DUDDU"))).toMatchObject({ seen: 5, total: 0, wrong: 0 });
  });
});

describe("hands", () => {
  it("strumming hand = the one that moves vertically most", () => {
    expect(pickStrummingHand([[0.5, 0.5, 0.51], [0.4, 0.6, 0.4, 0.6]])).toBe(1);
  });

  // Build a hand: wrist at origin, fingers pointing up; `curl[i]` folds finger i
  function hand(curl: boolean[]): Pt[] {
    const lm: Pt[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    lm[0] = { x: 0.5, y: 0.9 };
    for (let k = 1; k <= 4; k++) lm[k] = { x: 0.42 - k * 0.02, y: 0.85 - k * 0.04 };
    [0, 1, 2, 3].forEach((f) => {
      const x = 0.44 + f * 0.04;
      const base = 4 * f + 5;
      lm[base] = { x, y: 0.7 };
      lm[base + 1] = { x, y: 0.62 };
      if (curl[f]) {
        lm[base + 2] = { x: x + 0.03, y: 0.6 };
        lm[base + 3] = { x: x + 0.04, y: 0.66 };
      } else {
        lm[base + 2] = { x, y: 0.56 };
        lm[base + 3] = { x, y: 0.5 };
      }
    });
    return lm;
  }

  it("detects arched vs straight fingers", () => {
    expect(fingerArches(hand([true, false, true, false]))).toEqual([true, false, true, false]);
  });

  it("approximate chord check is labelled approximate", () => {
    const g = checkChordShape("G", hand([true, true, true, false]));
    expect(g.ok).toBe(true);
    expect(g.message).toMatch(/approximate/);
    const tooFew = checkChordShape("D", hand([false, false, false, false]));
    expect(tooFew.ok).toBe(false);
    const barre = checkChordShape("F", hand([false, true, true, true]));
    expect(barre.ok).toBe(true);
    expect(checkChordShape("G", null).message).toMatch(/approximate/);
  });
});
