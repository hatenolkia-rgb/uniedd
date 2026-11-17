/**
 * Camera Coach — on-device hand tracking for the picking & strumming game.
 *
 * Privacy: frames from the webcam go straight from the <video> element into the
 * MediaPipe hand model running in this browser tab (WebAssembly / WebGL). Nothing is
 * recorded, stored or uploaded; only the model files are downloaded.
 *
 * This file holds the pure logic (stroke detection from hand motion, matching
 * strokes to the pattern, a rough fretting-hand check) plus the model loader.
 */

import { CHORDS, type Dir } from "./patterns";

export const NO_RECORDING_FULL =
  "We are not recording anything. Your camera and microphone are never recorded, saved, or uploaded; everything is checked live on your device.";

// ---------------------------------------------------------------- stroke detection

export type CamStroke = { t: number; dir: Dir; amp: number };

/**
 * Turns the vertical position of the strumming hand (normalised image y, 0 = top,
 * 1 = bottom) into down / up strokes. A stroke is one run of motion in one direction
 * that travels far enough; its time is the moment of peak speed (when the pick
 * crosses the strings).
 */
export class StrokeTracker {
  private y = NaN;
  private lastT = NaN;
  private v = 0;
  private segDir: Dir | null = null;
  private segStartY = 0;
  private segPeakV = 0;
  private segPeakT = 0;
  private segExtremeY = 0;
  /** Minimum travel (fraction of frame height) for a stroke. */
  minAmp: number;
  /** Speed (frame heights / s) below which the hand counts as still. */
  minSpeed: number;
  constructor(opts: { minAmp?: number; minSpeed?: number } = {}) {
    this.minAmp = opts.minAmp ?? 0.035;
    this.minSpeed = opts.minSpeed ?? 0.25;
  }

  reset() {
    this.y = NaN;
    this.lastT = NaN;
    this.v = 0;
    this.segDir = null;
  }

  /** Feed one sample; returns a stroke when one just finished. */
  push(t: number, rawY: number): CamStroke | null {
    if (!Number.isFinite(rawY)) return null;
    if (!Number.isFinite(this.y) || !Number.isFinite(this.lastT) || t - this.lastT > 0.25) {
      this.y = rawY;
      this.lastT = t;
      this.v = 0;
      this.segDir = null;
      return null;
    }
    const dt = t - this.lastT;
    if (dt <= 0) return null;
    const prevY = this.y;
    // light smoothing: hands jitter a little between frames
    this.y = prevY + (rawY - prevY) * 0.75;
    const v = (this.y - prevY) / dt;
    this.v = this.v * 0.3 + v * 0.7;
    this.lastT = t;
    const dir: Dir | null = this.v > this.minSpeed ? "D" : this.v < -this.minSpeed ? "U" : null;
    let out: CamStroke | null = null;
    if (dir !== this.segDir) {
      out = this.finish();
      if (dir) {
        this.segDir = dir;
        this.segStartY = prevY;
        this.segPeakV = Math.abs(this.v);
        this.segPeakT = t - dt / 2;
        this.segExtremeY = this.y;
      } else this.segDir = null;
    } else if (dir) {
      if (Math.abs(this.v) > this.segPeakV) {
        this.segPeakV = Math.abs(this.v);
        this.segPeakT = t - dt / 2;
      }
      this.segExtremeY = this.y;
    }
    return out;
  }

  private finish(): CamStroke | null {
    if (!this.segDir) return null;
    const amp = Math.abs(this.segExtremeY - this.segStartY);
    const dir = this.segDir;
    this.segDir = null;
    return amp >= this.minAmp ? { t: this.segPeakT, dir, amp } : null;
  }
}

// ---------------------------------------------------------------- comparing with the pattern

export type CamSummary = {
  /** Strokes the camera saw during the exercise. */
  seen: number;
  /** Pattern strokes played in the right direction. */
  right: number;
  /** Pattern strokes played the other way. */
  wrong: number;
  /** Pattern strokes the camera didn't see. */
  missed: number;
  /** Strokes beyond the pattern. */
  extra: number;
  /** Strokes in the pattern (0 when there's no pattern to compare, e.g. Chords mode). */
  total: number;
  /** Spread of the gaps between strokes (ms) — big = uneven. */
  spreadMs: number | null;
  /** True when the gaps between strokes vary a lot. */
  uneven: boolean;
};

/**
 * Compare the order of down/up strokes with the spoken pattern (no tempo: the student
 * plays at their own pace). Between two strokes in the same direction (down, down)
 * the hand must swing back the other way without hitting the strings — that return
 * swing is expected and never counts as a mistake; neither does a wind-up before the
 * first stroke or one follow-through after the last.
 */
export function judgeCameraSequence(expected: Dir[] | null, strokes: CamStroke[]): CamSummary {
  const list = [...strokes].sort((a, b) => a.t - b.t);
  const exp = expected ?? [];
  let i = 0;
  let right = 0;
  let wrong = 0;
  let extra = 0;
  let followThrough = false;
  const counted: number[] = [];
  for (const s of list) {
    if (!exp.length) {
      counted.push(s.t);
      continue;
    }
    if (i >= exp.length) {
      if (!followThrough && s.dir !== exp[exp.length - 1]) followThrough = true;
      else extra++;
      continue;
    }
    if (s.dir === exp[i]) {
      right++;
      i++;
      counted.push(s.t);
    } else if (i === 0 || exp[i - 1] === exp[i]) {
      // wind-up before the first stroke, or the return swing between two same-way strokes
      continue;
    } else {
      wrong++;
      i++;
      counted.push(s.t);
    }
  }
  const missed = exp.length - i;
  let spread: number | null = null;
  let uneven = false;
  if (counted.length >= 4) {
    const gaps = counted.slice(1).map((t, k) => t - counted[k]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - avg) ** 2, 0) / gaps.length);
    spread = Math.round(sd * 1000);
    uneven = avg > 0 && sd / avg > 0.35;
  }
  return { seen: list.length, right, wrong, missed, extra, total: exp.length, spreadMs: spread, uneven };
}

export function cameraTip(s: CamSummary): string {
  if (s.seen === 0) return "I couldn't see your strumming hand — make sure it's in the camera picture.";
  if (s.total && s.missed / s.total > 0.5) return "I missed some strokes — swing from the wrist so I can see each one.";
  if (s.wrong >= 2) return "Some strokes went the other way — follow the arrows: down, then up!";
  if (s.extra >= 3) return "A few extra swings — make each stroke match an arrow.";
  if (s.uneven) return "Your strokes were a bit uneven — try to swing like a steady clock.";
  return s.total ? "Great hand motion — down and up just like the arrows!" : "Nice, smooth strumming!";
}

// ---------------------------------------------------------------- fretting hand (approximate)

export type Pt = { x: number; y: number; z?: number };

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];
const MCPS = [5, 9, 13, 17];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Very rough look at the fretting hand: which fingers are arched (pressing) vs
 * straight. Uses ratios of landmark distances, so it works at any distance from
 * the camera. Returns per-finger "arched" flags for index, middle, ring, pinky.
 */
export function fingerArches(lm: Pt[]): boolean[] {
  if (!lm || lm.length < 21) return [false, false, false, false];
  return TIPS.map((tip, i) => {
    const mcp = lm[MCPS[i]];
    const pip = lm[PIPS[i]];
    const t = lm[tip];
    const straight = dist(mcp, pip) + dist(pip, t);
    const direct = dist(mcp, t);
    // a straight finger has direct ≈ straight; an arched one is noticeably shorter
    return straight > 0 && direct / straight < 0.86;
  });
}

export type ShapeCheck = { ok: boolean; message: string };

/** Compare the fretting hand with the chord's fingering — clearly approximate. */
export function checkChordShape(chord: string, lm: Pt[] | null): ShapeCheck {
  const shape = CHORDS[chord];
  if (!shape) return { ok: true, message: "" };
  if (!lm) return { ok: false, message: "I can't see your fretting hand (approximate check)." };
  const arches = fingerArches(lm);
  const used = new Set(shape.fingers.filter((f) => f > 0));
  const needArched = [...used].filter((f) => !(shape.barre && f === 1)).length;
  const arched = arches.filter(Boolean).length;
  if (shape.barre) {
    const indexFlat = !arches[0];
    if (indexFlat && arched >= Math.max(1, needArched - 1)) return { ok: true, message: `Barre shape looks right for ${shape.name} (approximate) ✓` };
    return { ok: false, message: `${shape.name} is a barre chord: lay your first finger flat and arch the others (approximate).` };
  }
  if (Math.abs(arched - needArched) <= 1 && arched > 0) return { ok: true, message: `Fingers look about right for ${shape.name} (approximate) ✓` };
  if (arched < needArched) return { ok: false, message: `${shape.name} needs ${needArched} fingers pressing — I can see about ${arched} (approximate).` };
  return { ok: false, message: `${shape.name} uses ${needArched} fingers — try lifting the spare ones (approximate).` };
}

// ---------------------------------------------------------------- choosing the hands

/** The strumming hand is the one that moves up and down the most. */
export function pickStrummingHand(histories: number[][]): number {
  let best = 0;
  let bestMove = -1;
  histories.forEach((h, i) => {
    let move = 0;
    for (let k = 1; k < h.length; k++) move += Math.abs(h[k] - h[k - 1]);
    if (move > bestMove) {
      bestMove = move;
      best = i;
    }
  });
  return best;
}

/** Vertical position used for stroke detection: average of wrist and knuckles. */
export function strumY(lm: Pt[]) {
  const pts = [0, 5, 9, 13, 17].map((i) => lm[i]).filter(Boolean);
  return pts.reduce((a, p) => a + p.y, 0) / Math.max(1, pts.length);
}

export function centerX(lm: Pt[]) {
  return lm.reduce((a, p) => a + p.x, 0) / Math.max(1, lm.length);
}

// ---------------------------------------------------------------- model loader

export const TASKS_VISION_VERSION = "1.2.3";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type HandResult = { landmarks: Pt[][] };
export type HandModel = { detectForVideo: (video: HTMLVideoElement, ts: number) => HandResult; close: () => void };

type VisionModule = {
  FilesetResolver: { forVisionTasks: (base: string) => Promise<unknown> };
  HandLandmarker: {
    createFromOptions: (fileset: unknown, opts: Record<string, unknown>) => Promise<HandModel>;
  };
};

let modelPromise: Promise<HandModel> | null = null;

/** Load the hand model once (runs on-device; only the model files are downloaded). */
export function loadHandModel(): Promise<HandModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${CDN}/vision_bundle.mjs`)) as VisionModule;
      const fileset = await mod.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const base = { modelAssetPath: MODEL };
      const opts = { runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 };
      // Automated tests can ask for the CPU delegate (headless browsers have no real GPU).
      const preferCpu = !!(globalThis as unknown as { __uniPickDebug?: { cpu?: boolean } }).__uniPickDebug?.cpu;
      try {
        if (preferCpu) throw new Error("cpu requested");
        return await mod.HandLandmarker.createFromOptions(fileset, { ...opts, baseOptions: { ...base, delegate: "GPU" } });
      } catch {
        return await mod.HandLandmarker.createFromOptions(fileset, { ...opts, baseOptions: { ...base, delegate: "CPU" } });
      }
    })();
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  return modelPromise;
}
