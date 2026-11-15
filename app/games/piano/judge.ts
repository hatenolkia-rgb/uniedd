/** Timing judgement for Piano Falling Notes. All times are in real (wall-clock) seconds. */

export type Grade = "perfect" | "good" | "miss";

export const WINDOWS = {
  normal: { perfect: 0.07, good: 0.15 },
  /** Microphone onsets are a little less exact than MIDI, so its windows are a touch wider. */
  mic: { perfect: 0.09, good: 0.18 },
};

export type Windows = { perfect: number; good: number };

export function gradeFor(offsetSec: number, w: Windows): Exclude<Grade, "miss"> | null {
  const a = Math.abs(offsetSec);
  if (a <= w.perfect) return "perfect";
  if (a <= w.good) return "good";
  return null;
}

export type JudgeNote = { id: number; midi: number; t: number; judged: boolean; scored: boolean };

/**
 * Find the note a key press belongs to: an unjudged, scored note whose pitch matches and
 * whose time is inside the Good window. Picks the closest in time (earliest on a tie).
 * `songT` and note times are SONG seconds; `rate` converts to real seconds.
 */
export function matchPress(
  notes: JudgeNote[],
  heardMidi: number,
  songT: number,
  rate: number,
  w: Windows,
  matches: (heard: number, expected: number) => boolean = (a, b) => a === b,
): { index: number; offset: number; grade: Exclude<Grade, "miss"> } | null {
  let best = -1;
  let bestOff = Infinity;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.judged || !n.scored) continue;
    const off = (songT - n.t) / rate;
    if (off < -w.good) break; // notes are sorted by time; the rest are later still
    if (off > w.good) continue;
    if (!matches(heardMidi, n.midi)) continue;
    if (Math.abs(off) < Math.abs(bestOff)) {
      best = i;
      bestOff = off;
    }
  }
  if (best < 0) return null;
  const grade = gradeFor(bestOff, w);
  return grade ? { index: best, offset: bestOff, grade } : null;
}

/** Indexes of notes that have passed the hit line by more than the Good window (+ slack). */
export function expiredNotes(notes: JudgeNote[], songT: number, rate: number, w: Windows, slackSec = 0) {
  const out: number[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.judged || !n.scored) continue;
    if ((songT - n.t) / rate > w.good + slackSec) out.push(i);
    else if (n.t > songT) break;
  }
  return out;
}

export function accuracyOf(perfect: number, good: number, total: number) {
  return total ? (perfect + good * 0.6) / total : 0;
}

export function pointsFor(grade: Exclude<Grade, "miss">, combo: number) {
  return Math.round((grade === "perfect" ? 100 : 60) * (1 + Math.min(combo, 50) / 50));
}

/** Leaderboard score 0–5000, scaled down for slower speeds (same formula as Clap Rhythm). */
export function boardScoreOf(accuracy: number, maxCombo: number, total: number, rate: number) {
  return Math.round(Math.min(5000, (accuracy * 4000 + (maxCombo / Math.max(1, total)) * 1000) * Math.min(1, rate)));
}
