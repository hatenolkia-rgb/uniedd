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

// ---------------------------------------------------------------- matching to the pattern

export type CamSlot = { t: number; dir: Dir; rest: boolean };

export type CamSummary = {
  /** Strokes the camera saw during the exercise. */
  seen: number;
  /** Played (non-rest) slots with a stroke in the right direction. */
  right: number;
  /** Played slots where the hand moved the other way. */
  wrong: number;
  /** Played slots with no stroke seen. */
  missed: number;
  /** Strokes that didn't line up with any slot. */
  extra: number;
  /** Total played slots. */
  total: number;
  /** Spread of stroke timing (ms) — big = uneven. */
  spreadMs: number | null;
  /** Median offset (s) of matched strokes, used to self-calibrate camera latency. */
  medianOffset: number | null;
  /** True when the pattern was too fast for the camera to judge direction. */
  tooFast: boolean;
};

/** Fastest stroke rate the camera can follow reliably (strokes per second). */
export const CAMERA_MAX_RATE = 7;

export function camWindow(slots: CamSlot[]) {
  let gap = Infinity;
  for (let i = 1; i < slots.length; i++) gap = Math.min(gap, slots[i].t - slots[i - 1].t);
  if (!Number.isFinite(gap)) gap = 0.5;
  return { win: Math.min(0.2, gap * 0.5), gap };
}

/**
 * Between two strokes in the same direction (e.g. down, down) the hand has to travel
 * back the other way without hitting the strings. Such a "return" swing is expected,
 * so it never counts as an extra stroke.
 */
function isReturnStroke(slots: CamSlot[], t: number, dir: Dir, gap: number) {
  let prev: CamSlot | null = null;
  let next: CamSlot | null = null;
  for (const s of slots) {
    if (s.t <= t) prev = s;
    else {
      next = s;
      break;
    }
  }
  // a wind-up just before the first stroke, or a follow-through just after the last
  if (!prev) return !!next && next.dir !== dir && next.t - t <= gap * 1.5;
  if (!next) return prev.dir !== dir && t - prev.t <= gap * 1.5;
  return prev.dir !== dir && next.dir !== dir;
}

/**
 * Match camera strokes to every slot of the pattern (rests included — the hand still
 * moves on a rest, it just misses the strings), then count mistakes on played slots.
 */
export function judgeCamera(slots: CamSlot[], strokes: CamStroke[], offset = 0): CamSummary {
  const { win, gap } = camWindow(slots);
  const tooFast = 1 / gap > CAMERA_MAX_RATE;
  const used = new Array(slots.length).fill(false);
  const hit: (CamStroke | null)[] = new Array(slots.length).fill(null);
  const offs: number[] = [];
  let extra = 0;
  for (const s of [...strokes].sort((a, b) => a.t - b.t)) {
    const t = s.t - offset;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (used[i]) continue;
      const d = Math.abs(t - slots[i].t);
      // prefer a slot in the same direction when two are close
      const score = d + (slots[i].dir === s.dir ? 0 : win * 0.6);
      if (d <= win && score < bestD) {
        bestD = score;
        best = i;
      }
    }
    if (best < 0) {
      if (!isReturnStroke(slots, t, s.dir, gap)) extra++;
      continue;
    }
    used[best] = true;
    hit[best] = s;
    offs.push(s.t - slots[best].t);
  }
  let right = 0;
  let wrong = 0;
  let missed = 0;
  let total = 0;
  slots.forEach((slot, i) => {
    if (slot.rest) return;
    total++;
    const h = hit[i];
    if (!h) missed++;
    else if (h.dir === slot.dir) right++;
    else wrong++;
  });
  const sorted = [...offs].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  let spread: number | null = null;
  if (offs.length > 2) {
    const avg = offs.reduce((a, b) => a + b, 0) / offs.length;
    spread = Math.round(Math.sqrt(offs.reduce((a, o) => a + (o - avg) ** 2, 0) / offs.length) * 1000);
  }
  return { seen: strokes.length, right, wrong, missed, extra, total, spreadMs: spread, medianOffset: median, tooFast };
}

export function cameraTip(s: CamSummary): string {
  if (s.seen === 0) return "I couldn't see your strumming hand — make sure it's in the camera picture.";
  if (s.tooFast) return "That was too fast for my camera eyes — slow the speed down to check your directions.";
  if (s.total && s.missed / s.total > 0.5) return "Keep your hand swinging down and up all the time, like a pendulum.";
  if (s.wrong >= 2) return "Some strokes went the other way — down on the beat, up in between!";
  if (s.extra >= 3) return "A few extra swings — make each stroke match an arrow.";
  if (s.spreadMs !== null && s.spreadMs > 70) return "Your strokes were a bit uneven — try to swing like a steady clock.";
  return "Great hand motion — down and up just like the arrows!";
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
