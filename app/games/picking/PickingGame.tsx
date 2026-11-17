"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MicStatus } from "../clap/engine";
import { PickEngine, speak, speechSupported, stopSpeaking } from "./audio";
import {
  LEVELS,
  LiveJudge,
  boardScore,
  coachTip,
  levelInfo,
  roundExercises,
  summarize,
  targetTimes,
  windowsFor,
  type Dir,
  type Exercise,
  type Judgement,
  type Level,
  type Mode,
  type Summary,
  type TargetState,
} from "./patterns";
import { ChordDiagram, Confetti, FingerLegend, Mascot, PatternLane, Stars, type Mood } from "./visuals";
import { CameraOptIn, CameraPreview, useCameraCoach } from "./CameraCoach";
import { cameraTip, type CamSummary } from "./camera";
import "./picking.css";

type View = "setup" | "calibrate" | "play" | "results";
type InputMode = "mic" | "tap";
type Phase = "speak" | "demo" | "countin" | "play" | "feedback";

type Options = {
  mode: Mode;
  level: Level;
  bpm: Record<string, number>;
  input: InputMode;
  demo: boolean;
  voice: boolean;
  sensitivity: number;
};

type Live = {
  phase: Phase;
  exIdx: number;
  count: number;
  active: number;
  results: (Judgement | null)[];
  mood: Mood;
  beat: number;
  bubble: string;
  pop: { text: string; color: string; key: number } | null;
  streak: number;
  points: number;
  confetti: number;
  summary: Summary | null;
  tip: string;
  ear: number;
  cam: CamSummary | null;
  camTip: string;
};

type RoundResult = {
  mode: Mode;
  level: Level;
  bpm: number;
  input: InputMode;
  summary: Summary;
  perExercise: { title: string; stars: number }[];
  cam: { right: number; wrong: number; missed: number; extra: number } | null;
  boardScore: number;
  newBest: boolean;
};

export const NO_RECORDING_MIC =
  "We are not recording anything. Your microphone is never recorded, saved, or uploaded; everything is checked live on your device.";

const OPTS_KEY = "uniedd-pick-opts-v1";
const OFFSET_KEY = (m: InputMode) => `uniedd-pick-offset-v1:${m}`;
const BEST_KEY = (mode: Mode, level: Level) => `uniedd-pick-best-v1:${mode}:${level}`;

const CHEERS = ["Awesome!", "Rock star!", "Super picking!", "You nailed it!", "High five!", "Amazing!"];
const OKAYS = ["Nice try!", "Getting there!", "Good job!", "Keep going!"];
const OOPS = ["Let's try that again!", "Almost! You can do it!", "Shake it off — again!"];
const POP: Record<Judgement, { text: string; color: string }> = {
  perfect: { text: "Perfect! ⭐", color: "#16a34a" },
  good: { text: "Good! 👍", color: "#ca8a04" },
  wrong: { text: "Other way! ↻", color: "#9333ea" },
  miss: { text: "Missed", color: "#64748b" },
};

function defaultOpts(): Options {
  return { mode: "picking", level: "beginner", bpm: {}, input: "tap", demo: true, voice: true, sensitivity: 0.65 };
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

function loadNum(key: string) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function pickOne<T>(list: T[], seed: number) {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

const emptyLive = (): Live => ({
  phase: "speak",
  exIdx: 0,
  count: 0,
  active: -1,
  results: [],
  mood: "happy",
  beat: 0,
  bubble: "",
  pop: null,
  streak: 0,
  points: 0,
  confetti: 0,
  summary: null,
  tip: "",
  ear: 0,
  cam: null,
  camTip: "",
});

class Aborted extends Error {}

export function PickingGame({ onFinish }: { onFinish: (score: number, board?: string) => void }) {
  const [view, setView] = useState<View>("setup");
  const [opts, setOpts] = useState<Options>(loadOpts);
  const [offsets, setOffsets] = useState<Record<InputMode, number>>(() => ({ mic: loadNum(OFFSET_KEY("mic")), tap: loadNum(OFFSET_KEY("tap")) }));
  const [mic, setMic] = useState<MicStatus>("off");
  const [live, setLive] = useState<Live>(emptyLive);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [notice, setNotice] = useState("");
  const [calib, setCalib] = useState<{ step: number; hits: number; msg: string }>({ step: 0, hits: 0, msg: "" });

  const engineRef = useRef<PickEngine | null>(null);
  const tokenRef = useRef(0);
  const judgeRef = useRef<LiveJudge | null>(null);
  const phaseRef = useRef<Phase | "calibrate" | "idle">("idle");
  const calibRef = useRef<{ clicks: number[]; strokes: number[] }>({ clicks: [], strokes: [] });
  const choiceRef = useRef<((c: "next" | "retry") => void) | null>(null);
  const levelBarRef = useRef<HTMLDivElement | null>(null);
  const optsRef = useRef(opts);
  const offsetsRef = useRef(offsets);
  const [camEnabled, setCamEnabled] = useState(false);
  const heardForCam = useCallback((perf: number) => (engineRef.current ? engineRef.current.heardAt(perf) : null), []);
  const cam = useCameraCoach(heardForCam);
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
  useEffect(() => {
    offsetsRef.current = offsets;
  }, [offsets]);

  const info = levelInfo(opts.mode, opts.level);
  const bpmKey = `${opts.mode}:${opts.level}`;
  const bpm = Math.max(info.bpm.min, Math.min(info.bpm.max, opts.bpm[bpmKey] ?? info.bpm.def));
  const patch = (p: Partial<Options>) => setOpts((o) => ({ ...o, ...p }));
  const setBpm = (v: number) => setOpts((o) => ({ ...o, bpm: { ...o.bpm, [bpmKey]: v } }));
  const patchLive = useCallback((p: Partial<Live> | ((l: Live) => Partial<Live>)) => {
    setLive((l) => ({ ...l, ...(typeof p === "function" ? p(l) : p) }));
  }, []);

  // ------------------------------------------------------------ engine + inputs

  const handleStroke = useCallback(
    (heardT: number, dir: Dir | undefined, source: InputMode) => {
      const offset = offsetsRef.current[source] / 1000;
      const t = heardT - offset;
      if (phaseRef.current === "calibrate") {
        calibRef.current.strokes.push(heardT);
        setCalib((c) => ({ ...c, hits: c.hits + 1 }));
        return;
      }
      if (phaseRef.current !== "play") return;
      const judge = judgeRef.current;
      if (!judge) return;
      const r = judge.input(t, source === "tap" ? dir : undefined);
      if (!r) {
        patchLive((l) => ({ pop: { text: "Extra!", color: "#f97316", key: l.ear + 1 }, ear: l.ear + 1 }));
        return;
      }
      const gained = r.result === "perfect" ? 100 : r.result === "good" ? 60 : r.result === "wrong" ? 25 : 0;
      patchLive((l) => {
        const results = [...l.results];
        results[r.index] = r.result;
        const streak = judge.streak;
        return {
          results,
          streak,
          points: l.points + Math.round(gained * (1 + Math.min(streak, 20) / 20)),
          pop: { ...POP[r.result], text: streak >= 5 && r.result !== "wrong" && streak % 5 === 0 ? `${streak} in a row! 🔥` : POP[r.result].text, key: l.ear + 1 },
          ear: l.ear + 1,
          mood: r.result === "wrong" ? "oops" : streak >= 8 ? "wow" : "happy",
        };
      });
    },
    [patchLive],
  );

  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      const e = new PickEngine();
      e.onClap = (t) => handleStroke(t, undefined, "mic");
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
  }, [handleStroke]);

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

  // keyboard (tap mode): F / ↓ / D = down, J / ↑ / U = up
  useEffect(() => {
    if (view !== "play" && view !== "calibrate") return;
    if (opts.input !== "tap") return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      const dir: Dir | null = k === "f" || k === "arrowdown" || k === "d" ? "D" : k === "j" || k === "arrowup" || k === "u" ? "U" : null;
      if (!dir || !engineRef.current) return;
      ev.preventDefault();
      handleStroke(engineRef.current.eventToCtx(ev.timeStamp), dir, "tap");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, opts.input, handleStroke]);

  const tap = (dir: Dir) => (ev: React.PointerEvent) => {
    ev.preventDefault();
    if (!engineRef.current) return;
    handleStroke(engineRef.current.eventToCtx(ev.timeStamp), dir, "tap");
  };

  // ------------------------------------------------------------ timing helpers

  const sleep = (ms: number, token: number) =>
    new Promise<void>((resolve, reject) => {
      window.setTimeout(() => (token === tokenRef.current ? resolve() : reject(new Aborted())), ms);
    });

  /** Run `frame(now)` every animation frame until heard time reaches `until`. */
  const runUntil = (engine: PickEngine, until: number, token: number, frame: (now: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (token !== tokenRef.current) return reject(new Aborted());
        const now = engine.heardAt();
        frame(now);
        if (now >= until) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

  const say = async (text: string, token: number) => {
    if (!optsRef.current.voice) return;
    await speak(text);
    if (token !== tokenRef.current) throw new Aborted();
  };

  // ------------------------------------------------------------ mic

  const startMic = useCallback(async () => {
    const e = await ensureEngine();
    setMic("asking");
    const status = await e.startMic();
    setMic(status);
    if (status === "on") e.setSensitivity(optsRef.current.sensitivity);
    else {
      setNotice(
        status === "denied"
          ? "We couldn't use the microphone, so you're playing with the tap buttons. You can allow the mic in your browser settings any time."
          : "This browser can't use the microphone here, so you're playing with the tap buttons.",
      );
      patch({ input: "tap" });
    }
    return status;
  }, [ensureEngine]);

  // ------------------------------------------------------------ one exercise

  const playExercise = async (engine: PickEngine, ex: Exercise, exIdx: number, token: number, bpmNow: number): Promise<{ summary: Summary; targets: TargetState[]; cam: CamSummary | null }> => {
    const spb = 60 / bpmNow;
    const o = optsRef.current;
    judgeRef.current = null;
    phaseRef.current = "speak";
    patchLive({ phase: "speak", exIdx, results: ex.steps.map(() => null), active: -1, mood: "listen", bubble: ex.say, summary: null, tip: "", count: 0, pop: null, streak: 0, cam: null, camTip: "" });
    await sleep(250, token);
    await say(`${ex.title}. ${ex.say}`, token);

    const slotTime = (start: number) => ex.slots.map((s) => start + s.beat * spb);
    const activeAt = (times: number[], now: number, limit = times.length) => {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < limit; i++) {
        const d = Math.abs(now - times[i]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const gap = Math.min(spb / ex.maxGrid, spb) * 0.5;
      return bestD <= gap ? best : -1;
    };

    // Demo: one pass with the guitar synth, so the student hears it first
    if (o.demo) {
      phaseRef.current = "demo";
      patchLive({ phase: "demo", mood: "happy" });
      const start = engine.ctx.currentTime + 0.35;
      const passSlots = ex.slots.filter((s) => s.beat < ex.passBeats - 1e-9);
      let step = 0;
      const events: { at: number; play: (at: number) => void }[] = [];
      for (let b = 0; b < Math.ceil(ex.passBeats); b++) events.push({ at: start + b * spb, play: (at) => engine.click(at, b % 4 === 0, 0.35) });
      passSlots.forEach((s) => {
        if (s.rest) return;
        const i = step++;
        const at = start + s.beat * spb;
        events.push({
          at,
          play: (when) => (ex.mode === "chords" && s.chord ? engine.strum(when, s.chord, s.dir, s.accent) : engine.pluck(when, ex.demoMidi[i], 0.3, s.accent)),
        });
      });
      engine.runSchedule(events);
      const times = slotTime(start);
      let lastActive = -2;
      let lastBeat = -1;
      await runUntil(engine, start + ex.passBeats * spb + 0.25, token, (now) => {
        const a = activeAt(times, now, passSlots.length);
        const beat = Math.floor((now - start) / spb);
        if (a !== lastActive || beat !== lastBeat) {
          lastActive = a;
          lastBeat = beat;
          patchLive({ active: a, beat: beat >= 0 ? beat + 1 : 0 });
        }
      });
      engine.stopSchedule();
    }

    // Count-in (4 clicks) then play along with the click
    phaseRef.current = "countin";
    const countBeats = 4;
    const start = engine.ctx.currentTime + 0.4 + countBeats * spb;
    const targets = targetTimes(ex, bpmNow, start);
    const win = windowsFor(
      targets.map((t) => t.t),
      levelInfo(o.mode, o.level).leniency,
    );
    const judge = new LiveJudge(targets, win);
    // Test hook: automated browser tests set window.__uniPickDebug = {} to read the timing grid.
    const dbg = (window as unknown as { __uniPickDebug?: Record<string, unknown> }).__uniPickDebug;
    if (dbg) Object.assign(dbg, { engine, targets, win, exIdx, start });
    const minGap = targets.reduce((m, t, i) => (i ? Math.min(m, t.t - targets[i - 1].t) : m), Infinity);
    engine.setDebounce(Math.max(0.03, Math.min(ex.mode === "chords" ? 0.08 : 0.06, (Number.isFinite(minGap) ? minGap : 0.5) * 0.6)));
    const events: { at: number; play: (at: number) => void }[] = [];
    for (let b = -countBeats; b < Math.ceil(ex.beats); b++) {
      events.push({ at: start + b * spb, play: (at) => engine.click(at, b < 0 ? b === -countBeats : b % 4 === 0, b < 0 ? 0.55 : 0.4) });
    }
    engine.runSchedule(events);
    const camOn = camRef.current.status === "on";
    if (camOn) {
      camRef.current.begin(
        ex.slots.map((s) => ({ t: start + s.beat * spb, dir: s.dir, rest: s.rest })),
        ex.mode === "chords"
          ? (t: number) => {
              const beat = (t - start) / spb;
              let name = ex.chordTimeline[0]?.name;
              for (const c of ex.chordTimeline) if (beat + 1e-9 >= c.beat) name = c.name;
              return name;
            }
          : undefined,
      );
    }
    patchLive({ phase: "countin", active: -1, mood: "happy", bubble: "Get ready…", results: ex.steps.map(() => null) });
    const times = slotTime(start);
    let lastActive = -2;
    let lastBeat = -99;
    let lastCount = -1;
    let playing = false;
    await runUntil(engine, start + ex.beats * spb + win.good + 0.15, token, (now) => {
      if (!playing && now >= start - win.good - 0.02) {
        playing = true;
        judgeRef.current = judge;
        phaseRef.current = "play";
      }
      if (now < start) {
        const c = Math.min(countBeats, Math.max(1, Math.floor((now - (start - countBeats * spb)) / spb) + 1));
        if (c !== lastCount) {
          lastCount = c;
          patchLive({ count: c, beat: c });
        }
        return;
      }
      if (lastCount !== 0) {
        lastCount = 0;
        patchLive({ phase: "play", count: 0, bubble: o.input === "mic" ? "Play along! 🎸" : "Tap along! 👆" });
      }
      const a = activeAt(times, now);
      const beat = Math.floor((now - start) / spb) + 1;
      const missed = judge.expire(now);
      if (a !== lastActive || beat !== lastBeat || missed.length) {
        lastActive = a;
        lastBeat = beat;
        patchLive((l) => {
          if (!missed.length) return { active: a, beat };
          const results = [...l.results];
          for (const i of missed) results[i] = "miss";
          return { active: a, beat, results, streak: 0, mood: "oops" };
        });
      }
    });
    judge.expire(Infinity);
    judgeRef.current = null;
    phaseRef.current = "feedback";
    engine.stopSchedule();
    const summary = judge.summary();
    const camSummary = camOn ? camRef.current.end() : null;
    return { summary, targets: judge.targets, cam: camSummary };
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
    const token = ++tokenRef.current;
    const bpmNow = bpm;
    const list = roundExercises(o.mode, o.level);
    setExercises(list);
    setResult(null);
    setLive(emptyLive());
    setView("play");
    const finals: { summary: Summary; targets: TargetState[]; title: string; cam: CamSummary | null }[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        let attempt = await playExercise(engine, list[i], i, token, bpmNow);
        for (;;) {
          const s = attempt.summary;
          const usesDir = o.input === "tap";
          const great = s.stars === 3;
          const seed = Date.now() / 1000;
          const cheer = s.stars >= 3 ? pickOne(CHEERS, seed) : s.stars >= 1 ? pickOne(OKAYS, seed) : pickOne(OOPS, seed);
          const tip = coachTip(s, usesDir);
          const camTip = attempt.cam ? cameraTip(attempt.cam) : "";
          patchLive((l) => ({
            cam: attempt.cam,
            camTip,
            phase: "feedback",
            summary: s,
            tip,
            active: -1,
            bubble: cheer,
            mood: s.stars >= 2 ? "wow" : s.stars === 1 ? "happy" : "oops",
            confetti: great ? l.confetti + 1 : l.confetti,
          }));
          const camWords = attempt.cam && (attempt.cam.wrong >= 2 || attempt.cam.seen === 0 || attempt.cam.tooFast) ? camTip : "";
          const spoken = say(`${cheer} ${s.stars >= 3 ? "" : tip.replace(/[↓↑—]/g, "")} ${camWords}`.trim(), token).catch(() => undefined);
          const choice = await new Promise<"next" | "retry">((resolve) => {
            choiceRef.current = resolve;
            window.setTimeout(() => resolve("next"), s.stars >= 2 ? 4500 : 7000);
          });
          choiceRef.current = null;
          await spoken;
          if (token !== tokenRef.current) throw new Aborted();
          if (choice === "retry") {
            attempt = await playExercise(engine, list[i], i, token, bpmNow);
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
    // Results
    const all = finals.flatMap((f) => f.targets);
    const extra = finals.reduce((n, f) => n + f.summary.extra, 0);
    const maxStreak = Math.max(0, ...finals.map((f) => f.summary.maxStreak));
    const summary = summarize(all, extra, maxStreak);
    const score = boardScore(summary.accuracy, maxStreak, o.mode, o.level, bpmNow);
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
    setLive((l) => ({ ...l, confetti: summary.stars >= 2 ? l.confetti + 1 : l.confetti }));
    setResult({
      mode: o.mode,
      level: o.level,
      bpm: bpmNow,
      input: o.input,
      summary,
      perExercise: finals.map((f) => ({ title: f.title, stars: f.summary.stars })),
      cam: finals.some((f) => f.cam)
        ? finals.reduce(
            (a, f) => (f.cam ? { right: a.right + f.cam.right, wrong: a.wrong + f.cam.wrong, missed: a.missed + f.cam.missed, extra: a.extra + f.cam.extra } : a),
            { right: 0, wrong: 0, missed: 0, extra: 0 },
          )
        : null,
      boardScore: score,
      newBest,
    });
    phaseRef.current = "idle";
    setView("results");
    say(summary.stars >= 2 ? "Wow! You finished the round! Amazing playing!" : "You finished the round! Practice makes perfect!", token).catch(() => undefined);
  };

  const stopRound = () => {
    tokenRef.current++;
    choiceRef.current?.("next");
    judgeRef.current = null;
    phaseRef.current = "idle";
    stopSpeaking();
    engineRef.current?.stopAll();
    setView("setup");
  };

  // ------------------------------------------------------------ calibration

  const runCalibration = async () => {
    setNotice("");
    const o = optsRef.current;
    const engine = await ensureEngine();
    if (o.input === "mic" && !engine.micOn) {
      const st = await startMic();
      if (st !== "on") return;
    }
    const token = ++tokenRef.current;
    setView("calibrate");
    setCalib({ step: 0, hits: 0, msg: "" });
    const spb = 60 / 80;
    const n = 8;
    const start = engine.ctx.currentTime + 0.6 + 4 * spb;
    const clicks = Array.from({ length: n }, (_, i) => start + i * spb);
    calibRef.current = { clicks, strokes: [] };
    engine.setDebounce(0.12);
    engine.runSchedule(
      Array.from({ length: n + 4 }, (_, i) => {
        const at = start + (i - 4) * spb;
        return { at, play: (when: number) => engine.click(when, i % 4 === 0, 0.55) };
      }),
    );
    try {
      let last = -1;
      await runUntil(engine, start + n * spb + 0.3, token, (now) => {
        if (now >= start - 0.3 && phaseRef.current !== "calibrate") phaseRef.current = "calibrate";
        const step = Math.floor((now - (start - 4 * spb)) / spb) + 1;
        if (step !== last) {
          last = step;
          setCalib((c) => ({ ...c, step }));
        }
      });
    } catch (err) {
      if (err instanceof Aborted) return;
      throw err;
    }
    phaseRef.current = "idle";
    engine.stopSchedule();
    const diffs: number[] = [];
    for (const c of clicks) {
      let best = Infinity;
      for (const s of calibRef.current.strokes) if (Math.abs(s - c) < Math.abs(best)) best = s - c;
      if (Math.abs(best) < 0.3) diffs.push(best);
    }
    if (diffs.length < 4) {
      setCalib((c) => ({ ...c, msg: `We only heard ${diffs.length} of 8 strokes. ${o.input === "mic" ? "Strum a little louder, move closer to the device, or raise the mic sensitivity" : "Tap on every click"} and try again.` }));
      return;
    }
    diffs.sort((a, b) => a - b);
    const median = diffs[Math.floor(diffs.length / 2)];
    const ms = Math.round(median * 1000);
    setOffsets((prev) => {
      const next = { ...prev, [o.input]: ms };
      try {
        localStorage.setItem(OFFSET_KEY(o.input), String(ms));
      } catch {
        /* ignore */
      }
      return next;
    });
    setCalib((c) => ({ ...c, msg: `All set! Your timing offset is ${ms > 0 ? "+" : ""}${ms} ms — the game will correct for it.` }));
  };

  // ------------------------------------------------------------ render

  if (view === "results" && result) return <ResultsView result={result} confetti={live.confetti} onPost={() => onFinish(result.boardScore, result.mode)} onAgain={startRound} onSetup={() => setView("setup")} />;

  if (view === "calibrate") {
    const stage = calib.step <= 0 ? "Get ready…" : calib.step <= 4 ? `Listen… ${calib.step}` : calib.step <= 12 ? `${opts.input === "mic" ? "Strum" : "Tap"} on every click! (${calib.step - 4}/8)` : "Done!";
    return (
      <div className="pk-stage pk-sky rounded-3xl p-6 text-center text-white sm:p-10">
        <h3 className="text-2xl font-black">⏱ Timing check</h3>
        <p className="mx-auto mt-2 max-w-md text-white/90">
          After 4 &quot;listen&quot; clicks, {opts.input === "mic" ? "strum your guitar (any chord, or muted strings)" : "tap the ↓ button or press F"} exactly on each of the next 8 clicks.
        </p>
        <p className="pk-pop mt-6 text-3xl font-black" key={calib.step}>
          {stage}
        </p>
        <p className="mt-2 text-sm text-white/80">Strokes heard: {calib.hits}</p>
        {opts.input === "mic" ? <MicMeter barRef={levelBarRef} /> : null}
        {opts.input === "tap" ? (
          <div className="mt-6 flex justify-center">
            <BigTap dir="D" onPointerDown={tap("D")} />
          </div>
        ) : null}
        {calib.msg ? <p className="mx-auto mt-6 max-w-md rounded-2xl bg-white/20 p-3 font-semibold">{calib.msg}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {calib.msg ? (
            <button type="button" onClick={runCalibration} className="rounded-full bg-white/20 px-5 py-2.5 font-bold">
              Try again
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              tokenRef.current++;
              phaseRef.current = "idle";
              engineRef.current?.stopAll();
              setView("setup");
            }}
            className="rounded-full bg-white px-6 py-2.5 font-bold text-violet-700"
          >
            {calib.msg ? "Back" : "Cancel"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "play" && exercises.length) {
    const ex = exercises[live.exIdx] ?? exercises[0];
    const nowBeat = live.active >= 0 ? (ex.slots[live.active]?.beat ?? 0) : live.phase === "play" ? Math.max(0, live.beat - 1) : 0;
    const chordIdx = ex.chordTimeline.reduce((acc, c, i) => (nowBeat + 1e-9 >= c.beat ? i : acc), 0);
    const currentChord = ex.mode === "chords" ? ex.chordTimeline[chordIdx]?.name : undefined;
    const nextChord = ex.mode === "chords" ? ex.chordTimeline.slice(chordIdx + 1).find((c) => c.name !== currentChord)?.name : undefined;
    return (
      <div className="pk-stage pk-sky relative -mx-3 rounded-3xl p-3 text-white sm:mx-0 sm:p-6" data-testid="pick-play" data-phase={live.phase}>
        <Confetti burst={live.confetti} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1">
            {info.emoji} {info.label} · {opts.mode === "chords" ? "Chords" : "Picking"} · {bpm} BPM
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1">
            Exercise {live.exIdx + 1}/{exercises.length}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1" data-testid="points">
            ⭐ {live.points} {live.streak >= 3 ? `· 🔥${live.streak}` : ""}
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
          <Mascot mood={live.mood} beat={live.phase === "play" || live.phase === "countin" || live.phase === "demo" ? live.beat : 0} size={84} />
          <div className="relative flex-1 rounded-2xl rounded-tl-none bg-white p-3 text-slate-800 shadow-lg">
            <p className="text-lg font-black text-violet-700 sm:text-xl">{ex.title}</p>
            <p className="text-sm text-slate-600">{ex.desc}</p>
            <p className="mt-1 text-base font-bold sm:text-lg" data-testid="bubble">
              {live.phase === "speak" ? "🗣️ " : ""}
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
          {ex.mode === "chords" && currentChord ? (
            <div className="mb-3 flex items-end justify-center gap-3 sm:mb-4 sm:gap-4">
              <div className="rounded-3xl bg-white p-1.5 shadow-lg sm:p-2">
                <ChordDiagram name={currentChord} className="w-[118px] sm:w-[150px]" />
              </div>
              {nextChord ? (
                <div className="rounded-3xl bg-white/80 p-1.5 shadow sm:p-2">
                  <p className="text-center text-xs font-bold text-violet-700">Next</p>
                  <ChordDiagram name={nextChord} className="w-[72px] sm:w-[92px]" dim />
                </div>
              ) : null}
            </div>
          ) : null}
          <PatternLane ex={ex} active={live.active} results={live.results} />
          {live.phase === "countin" ? (
            <p key={live.count} className="pk-count mt-4 text-center text-6xl font-black drop-shadow" data-testid="countin">
              {live.count === 4 ? "GO!" : live.count}
            </p>
          ) : null}
          {live.phase === "demo" ? <p className="mt-4 text-center text-lg font-black">👂 Listen to how it sounds…</p> : null}
          {live.phase === "speak" ? <p className="pk-pulse mt-4 text-center text-lg font-black">🗣️ Listen to the pattern…</p> : null}
        </div>

        {live.phase === "feedback" && live.summary ? (
          <div className="pk-pop mt-5 rounded-3xl bg-white p-4 text-center text-slate-800 shadow-xl" data-testid="feedback">
            <Stars n={live.summary.stars} />
            <p className="mt-1 text-2xl font-black text-violet-700">{live.bubble}</p>
            <p className="text-sm text-slate-600">
              ⭐ {live.summary.perfect} perfect · 👍 {live.summary.good} good
              {opts.input === "tap" ? ` · ↻ ${live.summary.wrong} wrong way` : ""} · {live.summary.miss} missed
              {live.summary.extra ? ` · ${live.summary.extra} extra` : ""}
            </p>
            <p className="mt-1 font-semibold">💡 {live.tip}</p>
            {live.cam ? (
              <div className="mx-auto mt-2 max-w-md rounded-2xl bg-violet-50 p-2 text-sm text-violet-900" data-testid="camera-feedback">
                <p className="font-bold">
                  📷 Camera Coach: {live.cam.tooFast ? "too fast to check directions" : `${live.cam.right} right way · ${live.cam.wrong} other way · ${live.cam.missed} missed · ${live.cam.extra} extra`}
                  {live.cam.spreadMs !== null && !live.cam.tooFast ? ` · ${live.cam.spreadMs > 70 ? "uneven" : "even"} timing` : ""}
                </p>
                <p>{live.camTip}</p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => choiceRef.current?.("retry")} className="rounded-full bg-violet-100 px-5 py-2.5 font-bold text-violet-700">
                🔁 Try again
              </button>
              <button type="button" onClick={() => choiceRef.current?.("next")} className="rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-6 py-2.5 font-bold text-white shadow">
                {live.exIdx + 1 < exercises.length ? "Next ▶" : "See results 🏆"}
              </button>
            </div>
          </div>
        ) : null}

        {opts.input === "tap" ? (
          <div className="mt-5 flex justify-center gap-4 sm:gap-8">
            <BigTap dir="D" onPointerDown={tap("D")} />
            <BigTap dir="U" onPointerDown={tap("U")} />
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-1">
            <span key={live.ear} className="pk-ear inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/25 text-2xl" aria-hidden>
              👂
            </span>
            <MicMeter barRef={levelBarRef} />
            <p className="text-xs text-white/80">🔒 {NO_RECORDING_MIC}</p>
          </div>
        )}
        {opts.input === "tap" ? <p className="mt-2 text-center text-xs text-white/80">Keys: F or ↓ = down · J or ↑ = up</p> : null}
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
          <p className="text-slate-700">I&apos;ll <strong>say a pattern out loud</strong> — like &quot;down, up, down, up&quot; — and show the arrows. Then you play it on your guitar in time with the click!</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="1. What do you want to practise?">
          <div className="grid grid-cols-2 gap-3">
            <Choice active={opts.mode === "picking"} onClick={() => patch({ mode: "picking" })} emoji="🎵" title="Alternate Picking" sub="Single notes, down-up" testId="mode-picking" />
            <Choice active={opts.mode === "chords"} onClick={() => patch({ mode: "chords" })} emoji="🎸" title="Chords & Strumming" sub="Chord + strum pattern" testId="mode-chords" />
          </div>
        </Card>
        <Card title="2. Pick your level">
          <div className="grid grid-cols-3 gap-2">
            {LEVELS[opts.mode].map((l) => (
              <Choice key={l.id} active={opts.level === l.id} onClick={() => patch({ level: l.id })} emoji={l.emoji} title={l.label} sub={`${l.bpm.min}–${l.bpm.max} BPM`} testId={`level-${l.id}`} />
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-600">{info.blurb}</p>
        </Card>
        <Card title={`3. Speed: ${bpm} BPM ${bpm <= info.bpm.min + (info.bpm.max - info.bpm.min) / 3 ? "🐢" : bpm >= info.bpm.max - (info.bpm.max - info.bpm.min) / 3 ? "🐇" : "🚶"}`}>
          <input
            type="range"
            min={info.bpm.min}
            max={info.bpm.max}
            step={5}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full accent-violet-600"
            aria-label="Speed in beats per minute"
            data-testid="bpm"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>🐢 {info.bpm.min}</span>
            <span>{info.bpm.def} (normal)</span>
            <span>{info.bpm.max} 🐇</span>
          </div>
        </Card>
        <Card title="4. How will you play?">
          <div className="grid grid-cols-2 gap-3">
            <Choice active={opts.input === "mic"} onClick={() => patch({ input: "mic" })} emoji="🎤" title="Real guitar" sub="The mic listens" testId="input-mic" />
            <Choice active={opts.input === "tap"} onClick={() => patch({ input: "tap" })} emoji="👆" title="Tap buttons" sub="↓ ↑ or F / J keys" testId="input-tap" />
          </div>
          {opts.input === "mic" ? (
            <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200" data-testid="mic-privacy">
              <p className="font-bold">🔒 {NO_RECORDING_MIC}</p>
              <p className="mt-1">The mic hears <em>when</em> you strike the strings (it can&apos;t tell down from up), so it scores your timing. Wear headphones so it only hears your guitar.</p>
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
                    }}
                    className="w-full accent-emerald-600"
                  />
                </label>
              ) : null}
              {mic === "asking" ? <p className="mt-1 font-semibold">Please allow the microphone in the box your browser shows. {NO_RECORDING_MIC}</p> : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No guitar handy? Tap ↓ and ↑ (or press F and J) — direction counts too!</p>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <CameraOptIn cam={cam} enabled={camEnabled} setEnabled={setCamEnabled} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={opts.voice} onChange={(e) => patch({ voice: e.target.checked })} className="h-5 w-5 accent-violet-600" />
          🗣️ Speak the patterns {speechSupported() ? "" : "(not supported in this browser)"}
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={opts.demo} onChange={(e) => patch({ demo: e.target.checked })} className="h-5 w-5 accent-violet-600" />
          👂 Play a demo first
        </label>
        <button type="button" onClick={runCalibration} className="font-semibold text-violet-700 underline" data-testid="calibrate">
          ⏱ Timing check {offsets[opts.input] ? `(${offsets[opts.input] > 0 ? "+" : ""}${offsets[opts.input]} ms)` : "(recommended once)"}
        </button>
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
            {[...new Set(roundExercises("chords", opts.level).flatMap((e) => e.chordTimeline.map((c) => c.name)))].map((n) => (
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
          <li>Picky says the pattern out loud and shows it: <span className="font-bold text-blue-600">↓ blue = down</span>, <span className="font-bold text-pink-600">↑ pink = up</span>. Orange outline = play it louder.</li>
          <li>Listen to the demo, then count in with the 4 clicks.</li>
          <li>Play each arrow when it lights up. Dashed arrows are rests — keep your hand moving, but miss the strings.</li>
          <li>Every stroke gets ⭐ Perfect, 👍 Good, or a miss. Get 3 stars to make the confetti fly!</li>
          <li>Too fast? Slide the speed down. Too easy? Try Expert or Pro.</li>
        </ol>
      </details>
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

function ResultsView({ result, confetti, onPost, onAgain, onSetup }: { result: RoundResult; confetti: number; onPost: () => void; onAgain: () => void; onSetup: () => void }) {
  const info = levelInfo(result.mode, result.level);
  const s = result.summary;
  return (
    <div className="pk-stage pk-sky relative rounded-3xl p-5 text-center text-white sm:p-8" data-testid="pick-results">
      <Confetti burst={confetti} pieces={70} />
      <div className="flex justify-center">
        <Mascot mood={s.stars >= 2 ? "wow" : "happy"} size={110} />
      </div>
      <h3 className="mt-2 text-3xl font-black">{s.stars >= 3 ? "Superstar! 🌟" : s.stars >= 2 ? "Great job! 🎉" : s.stars >= 1 ? "Nice work! 👏" : "Keep practising! 💪"}</h3>
      <div className="mt-2">
        <Stars n={s.stars} size="text-5xl" />
      </div>
      <p className="mt-2 text-white/90">
        {info.emoji} {info.label} · {result.mode === "chords" ? "Chords & Strumming" : "Alternate Picking"} · {result.bpm} BPM · {result.input === "mic" ? "🎤 guitar" : "👆 tap"}
      </p>
      <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Accuracy" value={`${Math.round(s.accuracy * 100)}%`} />
        <Stat label="Perfect" value={String(s.perfect)} />
        <Stat label="Best streak" value={`🔥 ${s.maxStreak}`} />
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
      {s.avgMs !== null ? (
        <p className="mt-3 text-sm text-white/90">
          Timing: {Math.abs(s.avgMs) <= 20 ? "right on the beat 🎯" : s.avgMs > 0 ? `about ${s.avgMs} ms late` : `about ${-s.avgMs} ms early`}
          {s.spreadMs !== null ? ` · evenness ±${s.spreadMs} ms` : ""}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/20 p-2">
      <p className="text-xs uppercase tracking-wide text-white/80">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}
