"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MicStatus } from "../clap/engine";
import { PickEngine, speak, speechSupported, stopSpeaking } from "./audio";
import {
  CHORDS,
  LEVELS,
  boardScore,
  chordSequence,
  coachTip,
  exerciseStars,
  levelInfo,
  roundExercises,
  type Dir,
  type Exercise,
  type ExerciseResult,
  type Judgement,
  type Level,
  type Mode,
} from "./patterns";
import { SustainMeter, chordSpoken, frameMatches, parseChord } from "./chroma";
import { matchTarget, noteLabel, rejectLabel, stringName, type PluckVerdict } from "./pluck";
import { ChordDiagram, Confetti, FingerLegend, Mascot, PatternLane, Stars, type Mood } from "./visuals";
import { CameraOptIn, CameraPreview, useCameraCoach } from "./CameraCoach";
import { cameraTip, type CamSummary } from "./camera";
import "./picking.css";

type View = "setup" | "play" | "results";
type InputMode = "mic" | "tap";
type Phase = "intro" | "listen" | "feedback";

type Options = {
  mode: Mode;
  level: Level;
  input: InputMode;
  voice: boolean;
  sensitivity: number;
};

type Live = {
  phase: Phase;
  exIdx: number;
  /** Picking: result per stroke. */
  results: (Judgement | null)[];
  step: number;
  /** Chords: index of the chord being asked for, and how each one went. */
  chordIdx: number;
  chordState: ("done" | "skip" | null)[];
  meter: number;
  hearing: string;
  mood: Mood;
  bounce: number;
  bubble: string;
  pop: { text: string; color: string; key: number } | null;
  points: number;
  confetti: number;
  result: ExerciseResult | null;
  stars: number;
  tip: string;
  cam: CamSummary | null;
  camTip: string;
};

type RoundResult = {
  mode: Mode;
  level: Level;
  input: InputMode;
  results: ExerciseResult[];
  perExercise: { title: string; stars: number }[];
  stars: number;
  cam: { right: number; wrong: number; missed: number; extra: number } | null;
  boardScore: number;
  newBest: boolean;
};

export const NO_RECORDING_MIC =
  "We are not recording anything. Your microphone is never recorded, saved, or uploaded; everything is checked live on your device.";

const OPTS_KEY = "uniedd-pick-opts-v2";
const BEST_KEY = (mode: Mode, level: Level) => `uniedd-pick-best-v2:${mode}:${level}`;

const CHEERS = ["Awesome!", "Rock star!", "Super playing!", "You nailed it!", "High five!", "Amazing!"];
const OKAYS = ["Nice try!", "Getting there!", "Good job!", "Keep going!"];
const OOPS = ["Let's try that again!", "Almost! You can do it!", "Shake it off — again!"];
const CHORD_YES = ["Yes!", "Got it!", "Beautiful!", "That's it!", "Perfect!"];

function defaultOpts(): Options {
  return { mode: "picking", level: "beginner", input: "tap", voice: true, sensitivity: 0.65 };
}

function loadOpts(): Options {
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    if (raw) return { ...defaultOpts(), ...(JSON.parse(raw) as Partial<Options>) };
  } catch {
    /* ignore */
  }
  return defaultOpts();
}

function pickOne<T>(list: T[], seed: number) {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

const emptyLive = (): Live => ({
  phase: "intro",
  exIdx: 0,
  results: [],
  step: 0,
  chordIdx: 0,
  chordState: [],
  meter: 0,
  hearing: "",
  mood: "happy",
  bounce: 0,
  bubble: "",
  pop: null,
  points: 0,
  confetti: 0,
  result: null,
  stars: 0,
  tip: "",
  cam: null,
  camTip: "",
});

class Aborted extends Error {}

/** Mutable progress of the exercise being played (read by input handlers). */
type Progress = {
  ex: Exercise;
  seq: string[];
  step: number;
  wrong: number;
  stringOk: number;
  stringChecked: number;
  chordIdx: number;
  chordStart: number;
  seconds: number[];
  skipped: number;
  meter: SustainMeter;
  finish: (skipped: boolean) => void;
  /** AudioContext time of the last strum that sounded like a real guitar strum (chords + mic). */
  strumAt: number;
  /** Last sound that was ignored (voice, clap…), for the readout. */
  ignored: { label: string; at: number } | null;
};

/** Label for the live "hearing" readout, e.g. "G major". */
function hearingLabel(name: string) {
  const l = parseChord(name);
  return l ? chordSpoken(l).replace(" seven", "7") : name;
}

export function PickingGame({ onFinish }: { onFinish: (score: number, board?: string) => void }) {
  const [view, setView] = useState<View>("setup");
  const [opts, setOpts] = useState<Options>(loadOpts);
  const [mic, setMic] = useState<MicStatus>("off");
  const [live, setLive] = useState<Live>(emptyLive);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [notice, setNotice] = useState("");

  const engineRef = useRef<PickEngine | null>(null);
  const tokenRef = useRef(0);
  const progRef = useRef<Progress | null>(null);
  const listeningRef = useRef(false);
  const pausedUntilRef = useRef(0);
  /** AudioContext-time windows when the game itself was talking or playing (mic input ignored). */
  const gatesRef = useRef<{ from: number; to: number }[]>([]);
  const choiceRef = useRef<((c: "next" | "retry") => void) | null>(null);
  const levelBarRef = useRef<HTMLDivElement | null>(null);
  const optsRef = useRef(opts);
  const [camEnabled, setCamEnabled] = useState(false);
  const cam = useCameraCoach();
  const camRef = useRef(cam);
  useEffect(() => {
    camRef.current = cam;
  }, [cam]);

  useEffect(() => {
    optsRef.current = opts;
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(opts));
    } catch {
      /* ignore */
    }
  }, [opts]);

  const info = levelInfo(opts.mode, opts.level);
  const patch = (p: Partial<Options>) => setOpts((o) => ({ ...o, ...p }));
  const patchLive = useCallback((p: Partial<Live> | ((l: Live) => Partial<Live>)) => {
    setLive((l) => ({ ...l, ...(typeof p === "function" ? p(l) : p) }));
  }, []);

  const paused = () => performance.now() < pausedUntilRef.current;
  const ctxNow = () => engineRef.current?.ctx.currentTime ?? 0;
  /** Was the game's own voice or demo sounding at input time `t` (AudioContext seconds)? */
  const gated = (t: number) => gatesRef.current.some((g) => t >= g.from - 0.05 && t <= g.to);
  const addGate = (from: number, to: number) => {
    const now = ctxNow();
    gatesRef.current = [...gatesRef.current.filter((g) => g.to > now - 5), { from, to }];
    return gatesRef.current[gatesRef.current.length - 1];
  };

  // ------------------------------------------------------------ picking: one stroke heard / tapped

  const handleStroke = useCallback(
    (dir: Dir | undefined, source: InputMode) => {
      const prog = progRef.current;
      if (!prog || !listeningRef.current || prog.ex.mode !== "picking" || paused()) return;
      const i = prog.step;
      if (i >= prog.ex.steps.length) return;
      const expected = prog.ex.steps[i].dir;
      const wrongWay = source === "tap" && dir !== undefined && dir !== expected;
      if (wrongWay) prog.wrong++;
      prog.step++;
      const res: Judgement = wrongWay ? "wrong" : "perfect";
      const done = prog.step >= prog.ex.steps.length;
      patchLive((l) => {
        const results = [...l.results];
        results[i] = res;
        return {
          results,
          step: prog.step,
          points: l.points + (wrongWay ? 2 : 10),
          bounce: l.bounce + 1,
          mood: wrongWay ? "oops" : done ? "wow" : "happy",
          pop: wrongWay ? { text: "Other way! ↻", color: "#9333ea", key: l.bounce + 1 } : l.pop,
        };
      });
      if (done) window.setTimeout(() => prog.finish(false), 350);
    },
    [patchLive],
  );

  // ------------------------------------------------------------ mic: a sound was heard and analysed

  const handlePluckRef = useRef<(v: PluckVerdict, frame: number) => void>(() => undefined);
  const handlePluck = (v: PluckVerdict, frame: number) => {
    const prog = progRef.current;
    const e = engineRef.current;
    if (!prog || !e || !listeningRef.current || optsRef.current.input !== "mic") return;
    const t = frame / e.ctx.sampleRate;
    if (gated(t) || paused()) return; // the game's own voice / demo
    if (!v.ok) {
      const label = rejectLabel(v.reason);
      if (label) {
        prog.ignored = { label, at: performance.now() };
        if (prog.ex.mode === "picking") patchLive({ hearing: `🤫 Ignored — ${label}` });
      }
      return;
    }
    if (prog.ex.mode === "chords") {
      prog.strumAt = t;
      return;
    }
    const i = prog.step;
    if (i >= prog.ex.steps.length || v.f0 === null || v.midi === null) return;
    const target = prog.ex.demoMidi[i];
    const m = matchTarget(v.f0, target);
    const heard = noteLabel(v.midi);
    prog.stringChecked++;
    if (m.ok) {
      prog.stringOk++;
      patchLive({ hearing: `${heard} ✓` });
      handleStroke(undefined, "mic");
      return;
    }
    const hint = m.octaveOff
      ? "Right note, wrong octave"
      : m.samePc
        ? Math.abs(m.cents) <= 100
          ? m.cents > 0
            ? "A bit sharp — tune down"
            : "A bit flat — tune up"
          : `Play the ${stringName(target)} string`
        : `Play the ${stringName(target)} string`;
    patchLive((l) => ({
      hearing: `${heard} ✗`,
      mood: "oops",
      bounce: l.bounce + 1,
      pop: { text: hint, color: "#9333ea", key: l.bounce + 1 },
    }));
  };
  useEffect(() => {
    handlePluckRef.current = handlePluck;
  });

  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      const e = new PickEngine();
      e.onClap = null;
      e.onPluck = (v, frame) => handlePluckRef.current(v, frame);
      e.onLevel = (rms, thr) => {
        const el = levelBarRef.current;
        if (el) {
          el.style.width = `${Math.min(100, (rms / Math.max(thr, 0.001)) * 60)}%`;
          el.style.background = rms > thr ? "#22c55e" : "#a78bfa";
        }
      };
      engineRef.current = e;
    }
    await engineRef.current.resume();
    return engineRef.current;
  }, []);

  useEffect(
    () => () => {
      tokenRef.current++;
      stopSpeaking();
      const e = engineRef.current;
      if (e) {
        e.stopAll();
        e.stopMic();
        e.ctx.close().catch(() => undefined);
      }
    },
    [],
  );

  // keyboard (tap mode, picking): F / ↓ / D = down, J / ↑ / U = up
  useEffect(() => {
    if (view !== "play" || opts.input !== "tap" || opts.mode !== "picking") return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      const dir: Dir | null = k === "f" || k === "arrowdown" || k === "d" ? "D" : k === "j" || k === "arrowup" || k === "u" ? "U" : null;
      if (!dir) return;
      ev.preventDefault();
      handleStroke(dir, "tap");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, opts.input, opts.mode, handleStroke]);

  const tap = (dir: Dir) => (ev: React.PointerEvent) => {
    ev.preventDefault();
    handleStroke(dir, "tap");
  };

  // ------------------------------------------------------------ helpers

  const sleep = (ms: number, token: number) =>
    new Promise<void>((resolve, reject) => {
      window.setTimeout(() => (token === tokenRef.current ? resolve() : reject(new Aborted())), ms);
    });

  /** Speak (when the voice is on) with the mic paused, so the game never hears itself. */
  const say = async (text: string, token: number) => {
    if (!optsRef.current.voice) return;
    pausedUntilRef.current = Infinity;
    const gate = addGate(ctxNow(), Infinity);
    try {
      await speak(text);
    } finally {
      pausedUntilRef.current = performance.now() + 600;
      gate.to = ctxNow() + 0.6;
    }
    if (token !== tokenRef.current) throw new Aborted();
  };

  /** "Hear it": play the pattern (picking) or the chord (chords) on the guitar synth. */
  const playDemo = useCallback(() => {
    const e = engineRef.current;
    const prog = progRef.current;
    if (!e || !prog) return;
    const t0 = e.ctx.currentTime + 0.1;
    let length = 0;
    if (prog.ex.mode === "chords") {
      const chord = prog.seq[Math.min(prog.chordIdx, prog.seq.length - 1)];
      e.strum(t0, chord, "D", true);
      e.strum(t0 + 0.7, chord, "D");
      e.strum(t0 + 1.05, chord, "U");
      length = 2.6;
    } else {
      const spb = 60 / 80; // a comfortable demo pace — there's no tempo to keep up with
      const passSteps = prog.ex.steps.filter((s) => s.beat < prog.ex.passBeats - 1e-9);
      passSteps.forEach((s, i) => e.pluck(t0 + s.beat * spb, prog.ex.demoMidi[i], 0.3, s.accent));
      length = prog.ex.passBeats * spb + 1.2;
    }
    pausedUntilRef.current = Math.max(pausedUntilRef.current, performance.now() + length * 1000);
    const now = e.ctx.currentTime;
    gatesRef.current = [...gatesRef.current.filter((g) => g.to > now - 5), { from: now, to: now + length + 0.1 }];
  }, []);

  // ------------------------------------------------------------ mic

  const startMic = useCallback(async () => {
    const e = await ensureEngine();
    setMic("asking");
    const status = await e.startMic();
    setMic(status);
    if (status === "on") {
      e.setSensitivity(optsRef.current.sensitivity);
      e.setDebounce(0.07);
      e.ensureAnalyser();
      e.setPluckSensitivity(optsRef.current.sensitivity);
      await e.startPluckListener();
    } else {
      setNotice(
        status === "denied"
          ? "We couldn't use the microphone, so you're playing with the tap buttons. You can allow the mic in your browser settings any time."
          : "This browser can't use the microphone here, so you're playing with the tap buttons.",
      );
      setOpts((o) => ({ ...o, input: "tap" }));
    }
    return status;
  }, [ensureEngine]);

  // ------------------------------------------------------------ chords: listening loop

  useEffect(() => {
    if (view !== "play" || opts.mode !== "chords" || opts.input !== "mic") return;
    let last = performance.now();
    let lastHearing = "";
    let lastMeter = -1;
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const prog = progRef.current;
      const e = engineRef.current;
      if (!prog || !e || !listeningRef.current) return;
      if (paused()) {
        prog.meter.update(false, dt);
        return;
      }
      const target = prog.seq[prog.chordIdx];
      if (!target) return;
      const r = e.readChroma();
      let match = false;
      let hearing = "";
      // Only listen to the chord after a real strum: talking, singing or humming never counts.
      const strummed = e.ctx.currentTime - prog.strumAt < 3;
      if (r && r.loud && strummed) {
        const m = frameMatches(r.chroma, target);
        match = m.match;
        if (m.guess && m.guess.score >= 0.7) hearing = m.match ? hearingLabel(target) : hearingLabel(m.guess.name);
      } else if (prog.ignored && performance.now() - prog.ignored.at < 1500) hearing = `🤫 Ignored — ${prog.ignored.label}`;
      const ok = prog.meter.update(match, dt);
      const meter = Math.round(prog.meter.progress * 20) / 20;
      if (hearing !== lastHearing || meter !== lastMeter) {
        lastHearing = hearing;
        lastMeter = meter;
        patchLive({ hearing, meter });
      }
      if (ok) chordDone(prog, "done");
    }, 60);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, opts.mode, opts.input, patchLive]);

  /** A chord was recognised (or skipped / confirmed by tap): move to the next one. */
  const chordDone = (prog: Progress, how: "done" | "skip") => {
    if (progRef.current !== prog || prog.chordIdx >= prog.seq.length) return;
    const idx = prog.chordIdx;
    const name = prog.seq[idx];
    if (how === "done") prog.seconds.push((performance.now() - prog.chordStart) / 1000);
    else prog.skipped++;
    prog.chordIdx++;
    prog.meter.reset();
    prog.chordStart = performance.now();
    const finished = prog.chordIdx >= prog.seq.length;
    const yes = pickOne(CHORD_YES, Date.now() / 997);
    patchLive((l) => {
      const chordState = [...l.chordState];
      chordState[idx] = how;
      return {
        chordState,
        chordIdx: prog.chordIdx,
        meter: 0,
        hearing: "",
        bounce: l.bounce + 1,
        points: l.points + (how === "done" ? 100 : 0),
        mood: how === "done" ? "wow" : "happy",
        pop: how === "done" ? { text: `${yes} ${name} ✓`, color: "#16a34a", key: l.bounce + 1 } : { text: "Skipped", color: "#64748b", key: l.bounce + 1 },
        bubble: finished ? "All done! 🎉" : `Now play ${CHORDS[prog.seq[prog.chordIdx]]?.spoken ?? prog.seq[prog.chordIdx]}`,
      };
    });
    const token = tokenRef.current;
    if (finished) {
      window.setTimeout(() => prog.finish(false), 500);
      return;
    }
    const next = CHORDS[prog.seq[prog.chordIdx]]?.spoken ?? prog.seq[prog.chordIdx];
    say(how === "done" ? `${yes} Now, ${next}.` : `Now, ${next}.`, token).catch(() => undefined);
  };

  // ------------------------------------------------------------ one exercise (own pace)

  const playExercise = async (ex: Exercise, exIdx: number, token: number): Promise<{ result: ExerciseResult; cam: CamSummary | null }> => {
    const o = optsRef.current;
    const seq = ex.mode === "chords" ? chordSequence(ex) : [];
    listeningRef.current = false;
    let finishFn: (skipped: boolean) => void = () => undefined;
    const ended = new Promise<boolean>((resolve) => {
      finishFn = resolve;
    });
    const prog: Progress = {
      ex,
      seq,
      step: 0,
      wrong: 0,
      stringOk: 0,
      stringChecked: 0,
      chordIdx: 0,
      chordStart: performance.now(),
      seconds: [],
      skipped: 0,
      meter: new SustainMeter(0.6),
      finish: (s) => finishFn(s),
      strumAt: -10,
      ignored: null,
    };
    progRef.current = prog;
    patchLive({
      phase: "intro",
      exIdx,
      results: ex.steps.map(() => null),
      step: 0,
      chordIdx: 0,
      chordState: seq.map(() => null),
      meter: 0,
      hearing: "",
      mood: "listen",
      bubble: ex.mode === "chords" ? `Play ${CHORDS[seq[0]]?.spoken ?? seq[0]}` : ex.say,
      result: null,
      tip: "",
      pop: null,
      cam: null,
      camTip: "",
    });
    await sleep(250, token);
    if (ex.mode === "chords") {
      const names = seq.map((n) => CHORDS[n]?.spoken ?? n);
      await say(`${ex.title}. ${names.length > 1 ? `${names.join(", then ")}. ` : ""}Play ${names[0]}.`, token);
    } else {
      await say(`${ex.title}. ${ex.say}. Your turn!`, token);
    }
    // Camera Coach watches the whole exercise
    const camOn = camRef.current.status === "on";
    if (camOn) {
      camRef.current.begin(
        ex.mode === "picking" ? ex.steps.map((s) => s.dir) : null,
        ex.mode === "chords" ? () => progRef.current?.seq[progRef.current.chordIdx] : undefined,
      );
    }
    prog.chordStart = performance.now();
    listeningRef.current = true;
    patchLive({ phase: "listen", mood: "happy" });
    const dbg = (window as unknown as { __uniPickDebug?: Record<string, unknown> }).__uniPickDebug;
    if (dbg) Object.assign(dbg, { engine: engineRef.current, prog, exIdx });
    let skipped = false;
    try {
      skipped = await new Promise<boolean>((resolve, reject) => {
        ended.then(resolve);
        const check = window.setInterval(() => {
          if (token !== tokenRef.current) {
            window.clearInterval(check);
            reject(new Aborted());
          }
        }, 200);
        ended.then(() => window.clearInterval(check));
      });
    } finally {
      listeningRef.current = false;
    }
    const camSummary = camOn ? camRef.current.end() : null;
    const total = ex.mode === "chords" ? seq.length : ex.steps.length;
    const done = ex.mode === "chords" ? prog.seconds.length : prog.step;
    const result: ExerciseResult = {
      mode: ex.mode,
      total,
      done,
      wrong: prog.wrong,
      skipped: ex.mode === "chords" ? prog.skipped : skipped ? total - done : 0,
      seconds: prog.seconds,
      stringOk: o.input === "mic" && ex.mode === "picking" ? prog.stringOk : undefined,
      stringChecked: o.input === "mic" && ex.mode === "picking" ? prog.stringChecked : undefined,
    };
    return { result, cam: camSummary };
  };

  // ------------------------------------------------------------ the round

  const startRound = async () => {
    setNotice("");
    const o = optsRef.current;
    const engine = await ensureEngine();
    if (o.input === "mic" && !engine.micOn) {
      const st = await startMic();
      if (st !== "on") return;
    }
    if (o.input === "mic") {
      engine.ensureAnalyser();
      engine.pluckKind = o.mode === "chords" ? "strum" : "note";
      await engine.startPluckListener();
    }
    const token = ++tokenRef.current;
    const list = roundExercises(o.mode, o.level);
    setExercises(list);
    setResult(null);
    setLive(emptyLive());
    setView("play");
    const finals: { result: ExerciseResult; cam: CamSummary | null; title: string }[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        let attempt = await playExercise(list[i], i, token);
        for (;;) {
          const r = attempt.result;
          const stars = exerciseStars(r);
          const seed = Date.now() / 1000;
          const cheer = stars >= 3 ? pickOne(CHEERS, seed) : stars >= 1 ? pickOne(OKAYS, seed) : pickOne(OOPS, seed);
          const tip = coachTip(r, o.input === "tap");
          const camTip = attempt.cam ? cameraTip(attempt.cam) : "";
          patchLive((l) => ({
            phase: "feedback",
            result: r,
            stars,
            tip,
            cam: attempt.cam,
            camTip,
            hearing: "",
            bubble: cheer,
            mood: stars >= 2 ? "wow" : stars === 1 ? "happy" : "oops",
            confetti: stars === 3 ? l.confetti + 1 : l.confetti,
          }));
          const camWords = attempt.cam && (attempt.cam.wrong >= 2 || attempt.cam.seen === 0) ? camTip : "";
          const spoken = say(`${cheer} ${stars >= 3 ? "" : tip.replace(/[↓↑—]/g, "")} ${camWords}`.trim(), token).catch(() => undefined);
          const choice = await new Promise<"next" | "retry">((resolve) => {
            choiceRef.current = resolve;
            window.setTimeout(() => resolve("next"), stars >= 2 ? 4500 : 8000);
          });
          choiceRef.current = null;
          await spoken;
          if (token !== tokenRef.current) throw new Aborted();
          if (choice === "retry") {
            attempt = await playExercise(list[i], i, token);
            continue;
          }
          break;
        }
        finals.push({ ...attempt, title: list[i].title });
      }
    } catch (err) {
      if (err instanceof Aborted) return;
      throw err;
    }
    progRef.current = null;
    const results = finals.map((f) => f.result);
    const score = boardScore(results, o.mode, o.level);
    const total = results.reduce((n, r) => n + r.total, 0);
    const good = results.reduce((n, r) => n + Math.max(0, r.done - r.wrong), 0);
    const ratio = total ? good / total : 0;
    const stars = ratio >= 0.95 ? 3 : ratio >= 0.75 ? 2 : ratio >= 0.4 ? 1 : 0;
    let newBest = false;
    try {
      const prev = Number(localStorage.getItem(BEST_KEY(o.mode, o.level)) || 0);
      if (score > prev) {
        localStorage.setItem(BEST_KEY(o.mode, o.level), String(score));
        newBest = prev > 0;
      }
    } catch {
      /* ignore */
    }
    setLive((l) => ({ ...l, confetti: stars >= 2 ? l.confetti + 1 : l.confetti }));
    setResult({
      mode: o.mode,
      level: o.level,
      input: o.input,
      results,
      perExercise: finals.map((f) => ({ title: f.title, stars: exerciseStars(f.result) })),
      stars,
      cam: finals.some((f) => f.cam && f.cam.total)
        ? finals.reduce(
            (a, f) => (f.cam ? { right: a.right + f.cam.right, wrong: a.wrong + f.cam.wrong, missed: a.missed + f.cam.missed, extra: a.extra + f.cam.extra } : a),
            { right: 0, wrong: 0, missed: 0, extra: 0 },
          )
        : null,
      boardScore: score,
      newBest,
    });
    setView("results");
    say(stars >= 2 ? "Wow! You finished the round! Amazing playing!" : "You finished the round! Practice makes perfect!", token).catch(() => undefined);
  };

  const stopRound = () => {
    tokenRef.current++;
    choiceRef.current?.("next");
    listeningRef.current = false;
    progRef.current = null;
    stopSpeaking();
    engineRef.current?.stopAll();
    setView("setup");
  };

  const skip = () => {
    const prog = progRef.current;
    if (!prog || !listeningRef.current) return;
    if (prog.ex.mode === "chords") chordDone(prog, "skip");
    else prog.finish(true);
  };

  const confirmChord = () => {
    const prog = progRef.current;
    if (!prog || !listeningRef.current || prog.ex.mode !== "chords") return;
    chordDone(prog, "done");
  };

  // ------------------------------------------------------------ render

  if (view === "results" && result) return <ResultsView result={result} confetti={live.confetti} onPost={() => onFinish(result.boardScore, result.mode)} onAgain={startRound} onSetup={() => setView("setup")} />;

  if (view === "play" && exercises.length) {
    const ex = exercises[live.exIdx] ?? exercises[0];
    const seq = ex.mode === "chords" ? chordSequence(ex) : [];
    const currentChord = seq[Math.min(live.chordIdx, seq.length - 1)];
    const nextChord = seq[live.chordIdx + 1];
    const targetMidi = ex.mode === "picking" ? (ex.demoMidi[Math.min(live.step, ex.demoMidi.length - 1)] ?? null) : null;
    // slot index of the next stroke to play (picking)
    let nextSlot = -1;
    if (ex.mode === "picking" && live.phase === "listen") {
      let k = 0;
      ex.slots.forEach((s, i) => {
        if (s.rest) return;
        if (k === live.step) nextSlot = i;
        k++;
      });
    }
    const listening = live.phase === "listen";
    return (
      <div className="pk-stage pk-sky relative -mx-3 rounded-3xl p-3 text-white sm:mx-0 sm:p-6" data-testid="pick-play" data-phase={live.phase}>
        <Confetti burst={live.confetti} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1">
            {info.emoji} {info.label} · {opts.mode === "chords" ? "Chords" : "Picking"}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1">
            Exercise {live.exIdx + 1}/{exercises.length}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1" data-testid="points">
            ⭐ {live.points}
          </span>
          <button type="button" onClick={stopRound} className="rounded-full bg-white/90 px-3 py-1 text-violet-700">
            ✕ Stop
          </button>
        </div>

        {cam.status === "on" ? (
          <div className="mt-3 flex justify-center sm:absolute sm:right-4 sm:top-14 sm:z-10 sm:mt-0">
            <CameraPreview cam={cam} showShape={opts.mode === "chords"} />
          </div>
        ) : null}
        <div className={`mt-4 flex items-start gap-3 ${cam.status === "on" ? "sm:pr-60" : ""}`}>
          <Mascot mood={live.mood} beat={live.bounce} size={84} />
          <div className="relative flex-1 rounded-2xl rounded-tl-none bg-white p-3 text-slate-800 shadow-lg">
            <p className="text-lg font-black text-violet-700 sm:text-xl">{ex.title}</p>
            <p className="text-sm text-slate-600">{ex.mode === "chords" ? "Play each chord at your own pace — I'll listen and tell you when I hear it." : `${ex.desc} · at your own pace`}</p>
            <p className="mt-1 text-base font-bold sm:text-lg" data-testid="bubble">
              {live.phase === "intro" ? "🗣️ " : ""}
              {live.bubble}
            </p>
          </div>
        </div>

        <div className="relative mt-4 rounded-3xl bg-white/15 px-1 py-3 sm:mt-5 sm:p-5">
          {live.pop ? (
            <span key={live.pop.key} className="pk-judge z-10 rounded-full bg-white px-4 py-1.5 text-xl font-black shadow-lg" style={{ color: live.pop.color }}>
              {live.pop.text}
            </span>
          ) : null}

          {ex.mode === "chords" ? (
            <>
              <div className="mb-3 flex flex-wrap justify-center gap-2" data-testid="chord-steps">
                {seq.map((n, i) => {
                  const st = live.chordState[i];
                  const cur = i === live.chordIdx && listening;
                  return (
                    <span
                      key={i}
                      data-state={st || (cur ? "current" : "")}
                      className={`pk-tile rounded-2xl px-3 py-1.5 text-lg font-black shadow ${cur ? "pk-glow bg-white text-violet-700" : st === "done" ? "bg-green-500 text-white" : st === "skip" ? "bg-slate-300 text-slate-600" : "bg-white/60 text-violet-800"}`}
                    >
                      {st === "done" ? "✓ " : st === "skip" ? "⏭ " : ""}
                      {n}
                    </span>
                  );
                })}
              </div>
              {currentChord ? (
                <div className="flex items-end justify-center gap-3 sm:gap-4">
                  <div className="rounded-3xl bg-white p-1.5 shadow-lg sm:p-2">
                    <ChordDiagram name={currentChord} className="w-[130px] sm:w-[170px]" />
                  </div>
                  {nextChord ? (
                    <div className="rounded-3xl bg-white/80 p-1.5 shadow sm:p-2">
                      <p className="text-center text-xs font-bold text-violet-700">Next</p>
                      <ChordDiagram name={nextChord} className="w-[72px] sm:w-[92px]" dim />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-3 text-center text-sm font-semibold text-white/90">🎸 Strum it any way you like — or try: {patternHint(ex)}</p>
              {opts.input === "mic" ? (
                <div className="mx-auto mt-3 max-w-sm rounded-2xl bg-white/90 p-3 text-center text-slate-800 shadow" data-testid="hearing-box">
                  <p className="text-sm font-bold text-slate-500">👂 Hearing</p>
                  <p className="text-2xl font-black text-violet-700" data-testid="hearing">
                    {live.hearing || (listening ? "…" : "")}
                  </p>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-violet-100" aria-label="How sure I am">
                    <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-600 transition-[width] duration-100" style={{ width: `${Math.round(live.meter * 100)}%` }} data-testid="meter" />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Let the chord ring for a moment.</p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {targetMidi !== null ? (
                <p className="mx-auto mb-2 w-fit rounded-full bg-white px-4 py-1.5 text-center text-base font-black text-violet-700 shadow sm:text-lg" data-testid="target">
                  🎯 Play the {stringName(targetMidi)} string <span className="text-sm font-bold text-slate-500">({noteLabel(targetMidi)})</span>
                </p>
              ) : null}
              <PatternLane ex={ex} active={nextSlot} results={live.results} />
              <p className="mt-3 text-center text-sm font-bold text-white/90" data-testid="stroke-count">
                {live.step}/{ex.steps.length} notes {opts.input === "mic" ? "heard" : ""}
              </p>
              {opts.input === "mic" ? (
                <div className="mx-auto mt-2 max-w-xs rounded-2xl bg-white/90 px-3 py-2 text-center text-slate-800 shadow" data-testid="hearing-box">
                  <p className="text-xs font-bold text-slate-500">👂 Hearing</p>
                  <p className={`text-xl font-black ${live.hearing.endsWith("✓") ? "text-green-600" : live.hearing.endsWith("✗") ? "text-rose-600" : "text-slate-500"}`} data-testid="hearing">
                    {live.hearing || (listening ? "…" : "")}
                  </p>
                  <p className="text-[11px] text-slate-500">Only guitar strings count — voices, claps and taps are ignored.</p>
                </div>
              ) : null}
            </>
          )}
          {live.phase === "intro" ? <p className="pk-pulse mt-3 text-center text-lg font-black">🗣️ Listen…</p> : null}
        </div>

        {live.phase === "feedback" && live.result ? (
          <div className="pk-pop mt-5 rounded-3xl bg-white p-4 text-center text-slate-800 shadow-xl" data-testid="feedback">
            <Stars n={live.stars} />
            <p className="mt-1 text-2xl font-black text-violet-700">{live.bubble}</p>
            <p className="text-sm text-slate-600">
              {live.result.mode === "chords"
                ? `🎸 ${live.result.done}/${live.result.total} chords heard${live.result.skipped ? ` · ${live.result.skipped} skipped` : ""}${live.result.seconds.length ? ` · ${Math.round((live.result.seconds.reduce((a, b) => a + b, 0) / live.result.seconds.length) * 10) / 10} s each` : ""}`
                : `✓ ${live.result.done}/${live.result.total} strokes${opts.input === "tap" ? ` · ↻ ${live.result.wrong} wrong way` : ""}${live.result.stringChecked ? ` · 🎯 ${live.result.stringOk}/${live.result.stringChecked} played on the right string` : ""}${live.result.skipped ? ` · ${live.result.skipped} skipped` : ""}`}
            </p>
            <p className="mt-1 font-semibold">💡 {live.tip}</p>
            {live.cam ? (
              <div className="mx-auto mt-2 max-w-md rounded-2xl bg-violet-50 p-2 text-sm text-violet-900" data-testid="camera-feedback">
                <p className="font-bold">
                  📷 Camera Coach: {live.cam.total ? `${live.cam.right} right way · ${live.cam.wrong} other way · ${live.cam.missed} missed · ${live.cam.extra} extra` : `${live.cam.seen} strokes seen`}
                  {live.cam.spreadMs !== null ? ` · ${live.cam.uneven ? "uneven" : "even"} strokes` : ""}
                </p>
                <p>{live.camTip}</p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => choiceRef.current?.("retry")} className="rounded-full bg-violet-100 px-5 py-2.5 font-bold text-violet-700">
                🔁 Try again
              </button>
              <button type="button" onClick={() => choiceRef.current?.("next")} className="rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-6 py-2.5 font-bold text-white shadow" data-testid="next">
                {live.exIdx + 1 < exercises.length ? "Next ▶" : "See results 🏆"}
              </button>
            </div>
          </div>
        ) : null}

        {listening ? (
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={playDemo} className="rounded-full bg-white/90 px-5 py-2.5 font-bold text-violet-700 shadow" data-testid="hear-it">
              🔊 Hear it
            </button>
            {opts.mode === "chords" && opts.input === "tap" ? (
              <button type="button" onClick={confirmChord} className="rounded-full bg-green-500 px-5 py-2.5 font-black text-white shadow" data-testid="played-it">
                ✓ I played it
              </button>
            ) : null}
            <button type="button" onClick={skip} className="rounded-full bg-white/25 px-5 py-2.5 font-bold text-white" data-testid="skip">
              ⏭ Skip
            </button>
          </div>
        ) : null}

        {opts.mode === "picking" && opts.input === "tap" ? (
          <>
            <div className="mt-5 flex justify-center gap-4 sm:gap-8">
              <BigTap dir="D" onPointerDown={tap("D")} />
              <BigTap dir="U" onPointerDown={tap("U")} />
            </div>
            <p className="mt-2 text-center text-xs text-white/80">Keys: F or ↓ = down · J or ↑ = up</p>
          </>
        ) : null}
        {opts.input === "mic" ? (
          <div className="mt-4 flex flex-col items-center gap-1">
            <MicMeter barRef={levelBarRef} />
            <p className="text-center text-xs text-white/80">🔒 {NO_RECORDING_MIC}</p>
          </div>
        ) : null}
      </div>
    );
  }

  // ------------------------------------------------------------ setup / how to play
  return (
    <div className="pk-stage relative overflow-hidden rounded-3xl bg-gradient-to-b from-violet-50 via-pink-50 to-amber-50 p-4 sm:p-6" data-testid="pick-setup">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <Mascot mood="happy" size={96} />
        <div>
          <h3 className="text-2xl font-black text-violet-700 sm:text-3xl">Hi! I&apos;m Picky! 🎸</h3>
          <p className="text-slate-700">
            I&apos;ll <strong>say what to play out loud</strong> — a picking pattern like &quot;down, up, down, up&quot;, or a chord like &quot;G major&quot;. Play it on your guitar at <strong>your own pace</strong> — no metronome — and I&apos;ll listen!
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="1. What do you want to practise?">
          <div className="grid grid-cols-2 gap-3">
            <Choice active={opts.mode === "picking"} onClick={() => patch({ mode: "picking" })} emoji="🎵" title="Alternate Picking" sub="Single notes, down-up" testId="mode-picking" />
            <Choice active={opts.mode === "chords"} onClick={() => patch({ mode: "chords" })} emoji="🎸" title="Chords" sub="I listen for the chord" testId="mode-chords" />
          </div>
        </Card>
        <Card title="2. Pick your level">
          <div className="grid grid-cols-3 gap-2">
            {LEVELS[opts.mode].map((l) => (
              <Choice key={l.id} active={opts.level === l.id} onClick={() => patch({ level: l.id })} emoji={l.emoji} title={l.label} sub="" testId={`level-${l.id}`} />
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-600">{info.blurb}</p>
        </Card>
        <Card title="3. How will you play?">
          <div className="grid grid-cols-2 gap-3">
            <Choice active={opts.input === "mic"} onClick={() => patch({ input: "mic" })} emoji="🎤" title="Real guitar" sub="The mic listens" testId="input-mic" />
            <Choice
              active={opts.input === "tap"}
              onClick={() => patch({ input: "tap" })}
              emoji="👆"
              title={opts.mode === "chords" ? "No mic" : "Tap buttons"}
              sub={opts.mode === "chords" ? "Tap ✓ when you've played it" : "↓ ↑ or F / J keys"}
              testId="input-tap"
            />
          </div>
          {opts.input === "mic" ? (
            <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200" data-testid="mic-privacy">
              <p className="font-bold">🔒 {NO_RECORDING_MIC}</p>
              <p className="mt-1">
                {opts.mode === "chords"
                  ? "After each strum I listen to the notes ringing and tell you which chord I hear. Talking, singing or humming never counts. Strum and let it ring for a moment."
                  : "A note only counts when I hear the right guitar string ring — voices, claps and taps are ignored. (I can't tell down from up by ear.) Headphones help me hear only your guitar."}
              </p>
              {mic === "on" ? (
                <label className="mt-2 block">
                  Mic sensitivity
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={opts.sensitivity}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      patch({ sensitivity: v });
                      engineRef.current?.setSensitivity(v);
                      engineRef.current?.setPluckSensitivity(v);
                    }}
                    className="w-full accent-emerald-600"
                  />
                </label>
              ) : null}
              {mic === "asking" ? <p className="mt-1 font-semibold">Please allow the microphone in the box your browser shows. {NO_RECORDING_MIC}</p> : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              {opts.mode === "chords" ? "Without a mic I can't hear you, so tap ✓ after you play each chord." : "No guitar handy? Tap ↓ and ↑ (or press F and J) — direction counts too!"}
            </p>
          )}
        </Card>
        <CameraOptIn cam={cam} enabled={camEnabled} setEnabled={setCamEnabled} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={opts.voice} onChange={(e) => patch({ voice: e.target.checked })} className="h-5 w-5 accent-violet-600" />
          🗣️ Speak to me {speechSupported() ? "" : "(not supported in this browser)"}
        </label>
      </div>

      {notice ? <p className="mx-auto mt-3 max-w-xl rounded-2xl bg-amber-100 p-3 text-center text-sm font-semibold text-amber-900">{notice}</p> : null}

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={startRound}
          className="pk-pulse rounded-full bg-gradient-to-r from-orange-400 via-pink-500 to-violet-600 px-10 py-4 text-xl font-black text-white shadow-xl"
          data-testid="start"
        >
          ▶ Let&apos;s play!
        </button>
      </div>

      {opts.mode === "chords" ? (
        <div className="mt-6">
          <p className="text-center text-sm font-bold text-violet-700">Chords in {info.label}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {[...new Set(roundExercises("chords", opts.level).flatMap((e) => chordSequence(e)))].map((n) => (
              <div key={n} className="rounded-2xl bg-white p-1 shadow-sm">
                <ChordDiagram name={n} size={84} />
              </div>
            ))}
          </div>
          <div className="mt-2">
            <FingerLegend />
          </div>
        </div>
      ) : null}

      <details className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white/80 p-4 text-sm text-slate-700 shadow-sm">
        <summary className="cursor-pointer text-base font-black text-violet-700">❓ How to play</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Picky says what to play. There&apos;s no metronome — take your time!</li>
          <li>
            <strong>Picking:</strong> play the arrows in order — <span className="font-bold text-blue-600">↓ blue = down</span>, <span className="font-bold text-pink-600">↑ pink = up</span>, orange outline = a bit louder, dashed = an air stroke (keep the hand moving, miss the strings). Each stroke I hear lights up the next arrow.
          </li>
          <li>
            <strong>Chords:</strong> make the chord shape from the diagram and strum. When I hear the right chord ring for a moment, it turns green and we go to the next one. Stuck? Press ⏭ Skip.
          </li>
          <li>Press 🔊 Hear it to hear how it should sound.</li>
          <li>Get 3 stars to make the confetti fly!</li>
        </ol>
      </details>
    </div>
  );
}

/** Suggested strum for a chord exercise (just a suggestion — never scored). */
function patternHint(ex: Exercise) {
  const words: string[] = [];
  let group = -1;
  let cur: string[] = [];
  for (const s of ex.slots) {
    if (s.beat >= ex.passBeats - 1e-9) break;
    if (s.group !== group) {
      if (cur.length) words.push(cur.join(" "));
      cur = [];
      group = s.group;
    }
    if (!s.rest) cur.push(s.dir === "D" ? "down" : "up");
  }
  if (cur.length) words.push(cur.join(" "));
  return words.join(", ");
}

function ResultsView({ result, confetti, onPost, onAgain, onSetup }: { result: RoundResult; confetti: number; onPost: () => void; onAgain: () => void; onSetup: () => void }) {
  const info = levelInfo(result.mode, result.level);
  const rs = result.results;
  const total = rs.reduce((n, r) => n + r.total, 0);
  const done = rs.reduce((n, r) => n + r.done, 0);
  const wrong = rs.reduce((n, r) => n + r.wrong, 0);
  const skipped = rs.reduce((n, r) => n + r.skipped, 0);
  const secs = rs.flatMap((r) => r.seconds);
  const strOk = rs.reduce((n, r) => n + (r.stringOk ?? 0), 0);
  const strChecked = rs.reduce((n, r) => n + (r.stringChecked ?? 0), 0);
  const s = result.stars;
  return (
    <div className="pk-stage pk-sky relative rounded-3xl p-5 text-center text-white sm:p-8" data-testid="pick-results">
      <Confetti burst={confetti} pieces={70} />
      <div className="flex justify-center">
        <Mascot mood={s >= 2 ? "wow" : "happy"} size={110} />
      </div>
      <h3 className="mt-2 text-3xl font-black">{s >= 3 ? "Superstar! 🌟" : s >= 2 ? "Great job! 🎉" : s >= 1 ? "Nice work! 👏" : "Keep practising! 💪"}</h3>
      <div className="mt-2">
        <Stars n={s} size="text-5xl" />
      </div>
      <p className="mt-2 text-white/90">
        {info.emoji} {info.label} · {result.mode === "chords" ? "Chords" : "Alternate Picking"} · {result.input === "mic" ? "🎤 guitar" : "👆 tap"}
      </p>
      <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={result.mode === "chords" ? "Chords" : "Strokes"} value={`${done}/${total}`} />
        {result.mode === "chords" ? <Stat label="Avg time" value={secs.length ? `${Math.round((secs.reduce((a, b) => a + b, 0) / secs.length) * 10) / 10}s` : "—"} /> : <Stat label={result.input === "tap" ? "Wrong way" : "Right string"} value={result.input === "tap" ? String(wrong) : strChecked ? `${strOk}/${strChecked}` : "—"} />}
        <Stat label="Skipped" value={String(skipped)} />
        <Stat label="Score" value={String(result.boardScore)} />
      </div>
      {result.newBest ? <p className="pk-wiggle mt-3 inline-block rounded-full bg-yellow-300 px-4 py-1 font-black text-yellow-900">🏆 New personal best!</p> : null}
      <ul className="mx-auto mt-4 max-w-md space-y-1 rounded-2xl bg-white/15 p-3 text-left text-sm">
        {result.perExercise.map((e, i) => (
          <li key={i} className="flex justify-between">
            <span>{e.title}</span>
            <span>{"⭐".repeat(e.stars) || "—"}</span>
          </li>
        ))}
      </ul>
      {result.cam ? (
        <p className="mt-3 text-sm font-semibold text-white">
          📷 Camera Coach saw {result.cam.right} strokes the right way, {result.cam.wrong} the other way, {result.cam.missed} missed and {result.cam.extra} extra.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onPost} className="rounded-full bg-yellow-300 px-6 py-3 font-black text-yellow-900 shadow-lg" data-testid="post">
          🏆 Save score &amp; leaderboard
        </button>
        <button type="button" onClick={onAgain} className="rounded-full bg-white px-6 py-3 font-black text-violet-700 shadow-lg">
          🔁 Play again
        </button>
        <button type="button" onClick={onSetup} className="rounded-full bg-white/20 px-6 py-3 font-black">
          ⚙️ Change level
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- small pieces

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-violet-100">
      <h4 className="mb-3 text-base font-black text-slate-800">{title}</h4>
      {children}
    </section>
  );
}

function Choice({ active, onClick, emoji, title, sub, testId }: { active: boolean; onClick: () => void; emoji: string; title: string; sub: string; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={`flex min-h-[88px] flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition ${active ? "border-violet-500 bg-violet-50 shadow-md" : "border-slate-200 bg-white hover:border-violet-300"}`}
    >
      <span className={`text-3xl ${active ? "pk-pop" : ""}`}>{emoji}</span>
      <span className="text-sm font-black text-slate-800">{title}</span>
      <span className="text-[11px] text-slate-500">{sub}</span>
    </button>
  );
}

function BigTap({ dir, onPointerDown }: { dir: Dir; onPointerDown: (e: React.PointerEvent) => void }) {
  const down = dir === "D";
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      data-testid={down ? "tap-down" : "tap-up"}
      className="flex h-24 w-32 touch-none select-none flex-col items-center justify-center rounded-3xl text-4xl font-black text-white shadow-xl ring-4 ring-white/70 active:scale-95 sm:h-28 sm:w-40"
      style={{ background: down ? "linear-gradient(180deg,#60a5fa,#2563eb)" : "linear-gradient(180deg,#f9a8d4,#db2777)" }}
      aria-label={down ? "Down stroke" : "Up stroke"}
    >
      {down ? "↓" : "↑"}
      <span className="text-sm">{down ? "Down (F)" : "Up (J)"}</span>
    </button>
  );
}

function MicMeter({ barRef }: { barRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="mx-auto mt-2 h-3 w-48 overflow-hidden rounded-full bg-white/30" aria-label="Microphone level">
      <div ref={barRef} className="h-full w-0 rounded-full transition-[width] duration-75" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/20 p-2">
      <p className="text-xs uppercase tracking-wide text-white/80">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}
