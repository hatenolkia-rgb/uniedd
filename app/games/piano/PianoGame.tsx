"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { MicStatus } from "../clap/engine";
import { starsFor } from "../clap/songs";
import { PianoEngine } from "./engine";
import { MidiKeyboard, midiSupported, type MidiDevice, type MidiStatus } from "./midi";
import { clickBeat, keyboardRange, LEVELS, loadPianoSongs, midiToName, noteToMidi, type PianoSong } from "./charts";
import { accuracyOf, boardScoreOf, expiredNotes, matchPress, pointsFor, WINDOWS, type Windows } from "./judge";
import { pitchMatches } from "./pitch";
import { burst, draw, keyAt, layout, stepEffects, type KeyLight, type StageNote, type StageState } from "./stage";

type View = "pick" | "calibrate" | "play" | "results";
type Input = "midi" | "mic" | "keys";
type Source = Input;
type Mode = "play" | "wait" | "listen";

type Options = {
  speed: number;
  mode: Mode;
  hands: "both" | "R" | "L";
  labels: "letters" | "sargam" | "off" | "auto";
  guide: boolean;
  accomp: boolean;
  metronome: boolean;
  keySound: boolean;
  sensitivity: number;
};

const DEFAULT_OPTS: Options = {
  speed: 1,
  mode: "play",
  hands: "both",
  labels: "auto",
  guide: false,
  accomp: true,
  metronome: true,
  keySound: true,
  sensitivity: 0.6,
};

const SPEEDS = [0.5, 0.75, 1];
const OPTS_KEY = "uniedd-piano-options";
const INPUT_KEY = "uniedd-piano-input";
const OFFSET_KEY = (s: Source) => `uniedd-piano-offset:${s}`;
const BEST_KEY = (id: string) => `uniedd-piano-best:${id}`;
const INPUT_LIMIT_MS = 250;
const LOOKAHEAD = 2.6;

// computer keyboard → semitones above the base C (two rows, like a piano)
const KEYMAP: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
  KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17, BracketRight: 18,
};
const KEYLABEL: Record<string, string> = {
  KeyA: "A", KeyW: "W", KeyS: "S", KeyE: "E", KeyD: "D", KeyF: "F", KeyT: "T", KeyG: "G", KeyY: "Y", KeyH: "H", KeyU: "U", KeyJ: "J",
  KeyK: "K", KeyO: "O", KeyL: "L", KeyP: "P", Semicolon: ";", Quote: "'", BracketRight: "]",
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as object) } as T) : fallback;
  } catch {
    return fallback;
  }
}
function readNum(key: string) {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, typeof v === "string" ? v : JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
type Best = { score: number; stars: number; accuracy: number };
function readBest(id: string): Best | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BEST_KEY(id));
    return raw ? (JSON.parse(raw) as Best) : null;
  } catch {
    return null;
  }
}

type RunNote = StageNote & { id: number; judged: boolean };

type Run = {
  song: PianoSong;
  mode: Mode;
  input: Input;
  rate: number;
  notes: RunNote[];
  anchorCtx: number;
  startSong: number;
  songT: number;
  lastHeard: number;
  waiting: boolean;
  waitStart: number;
  firstPending: number;
  autoIdx: number;
  clickSec: number;
  countStart: number;
  endT: number;
  perfect: number;
  good: number;
  miss: number;
  wrong: number;
  combo: number;
  maxCombo: number;
  score: number;
  offsets: number[];
  paused: boolean;
  finished: boolean;
  stage: StageState;
  userKeys: Map<number, KeyLight>;
  kbBase: number;
  scoredTotal: number;
  opts: Options;
};

type Result = {
  song: PianoSong;
  mode: Mode;
  input: Input;
  speed: number;
  perfect: number;
  good: number;
  miss: number;
  wrong: number;
  maxCombo: number;
  total: number;
  accuracy: number;
  stars: number;
  score: number;
  boardScore: number;
  avgOffsetMs: number | null;
  newBest: boolean;
};

/** Best base C for the computer-keyboard rows: the one that covers the most scored notes. */
function bestKbBase(midis: number[]) {
  if (!midis.length) return 60;
  let best = 60;
  let bestCount = -1;
  for (let c = 24; c <= 96; c += 12) {
    const n = midis.filter((m) => m >= c && m <= c + 18).length;
    if (n > bestCount || (n === bestCount && Math.abs(c - 60) < Math.abs(best - 60))) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

function windowsFor(source: Source): Windows {
  return source === "mic" ? WINDOWS.mic : WINDOWS.normal;
}

export function PianoGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [view, setView] = useState<View>("pick");
  const [songs, setSongs] = useState<PianoSong[]>([]);
  const [loadError, setLoadError] = useState("");
  const [songId, setSongId] = useState("twinkle-twinkle");
  const [opts, setOptsState] = useState<Options>(() => readJSON(OPTS_KEY, DEFAULT_OPTS));
  const [input, setInputState] = useState<Input>(() => {
    if (typeof window === "undefined") return "midi";
    const v = (() => {
      try {
        return localStorage.getItem(INPUT_KEY);
      } catch {
        return null;
      }
    })();
    return v === "mic" || v === "keys" ? v : "midi";
  });
  const [midiStatus, setMidiStatus] = useState<MidiStatus>(() => (typeof window !== "undefined" && !midiSupported() ? "unsupported" : "idle"));
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [mic, setMic] = useState<MicStatus>("off");
  const [hearing, setHearing] = useState<string | null>(null);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<Record<Source, number>>(() => ({
    midi: readNum(OFFSET_KEY("midi")),
    mic: readNum(OFFSET_KEY("mic")),
    keys: readNum(OFFSET_KEY("keys")),
  }));
  const [result, setResult] = useState<Result | null>(null);
  const [paused, setPaused] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [error, setError] = useState("");
  const [canFull, setCanFull] = useState(false);
  const [isFull, setIsFull] = useState(false);

  const engineRef = useRef<PianoEngine | null>(null);
  const midiRef = useRef<MidiKeyboard | null>(null);
  const runRef = useRef<Run | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);
  /** Where note-on events go: the play loop, the calibration screen, or the setup screen. */
  const sinkRef = useRef<((midi: number, heard: number, source: Source, vel: number) => void) | null>(null);
  const offRef = useRef<((midi: number) => void) | null>(null);
  const pointersRef = useRef(new Map<number, number>());
  const hearingRef = useRef<string | null>(null);
  const optsRef = useRef(opts);
  const inputRef = useRef(input);
  const offsetsRef = useRef(offsets);
  useEffect(() => {
    optsRef.current = opts;
    inputRef.current = input;
    offsetsRef.current = offsets;
  }, [opts, input, offsets]);

  const setOpts = useCallback((patch: Partial<Options>) => {
    setOptsState((prev) => {
      const next = { ...prev, ...patch };
      save(OPTS_KEY, next);
      return next;
    });
  }, []);
  const setInput = useCallback((v: Input) => {
    setInputState(v);
    save(INPUT_KEY, v);
  }, []);
  const setOffset = useCallback((s: Source, ms: number) => {
    const v = Math.max(-INPUT_LIMIT_MS, Math.min(INPUT_LIMIT_MS, Math.round(ms)));
    setOffsets((o) => ({ ...o, [s]: v }));
    save(OFFSET_KEY(s), String(v));
  }, []);

  const song = songs.find((s) => s.id === songId) ?? songs[0];

  const engine = useCallback(() => {
    if (!engineRef.current) {
      const e = new PianoEngine();
      e.onMicLevel = (peak) => {
        if (meterRef.current) meterRef.current.style.width = `${Math.round(Math.min(1, peak * 6) * 100)}%`;
      };
      e.onHearing = (m) => setHearing(m === null ? null : midiToName(m));
      e.onNote = (n) => {
        if (inputRef.current !== "mic") return;
        setLastNote(`${midiToName(n.midi)} (${n.cents > 0 ? "+" : ""}${n.cents}¢)`);
        sinkRef.current?.(n.midi, n.heard, "mic", 0.8);
      };
      engineRef.current = e;
    }
    return engineRef.current;
  }, []);

  // ---- note on/off from MIDI, computer keys and taps ----
  const noteOn = useCallback(
    (midi: number, heard: number, source: Source, vel: number) => {
      if (source !== "mic" && optsRef.current.keySound) engine().noteOn(midi, vel);
      if (source !== "mic") setLastNote(midiToName(midi));
      sinkRef.current?.(midi, heard, source, vel);
    },
    [engine],
  );
  const noteOff = useCallback((midi: number) => {
    engineRef.current?.noteOff(midi);
    offRef.current?.(midi);
  }, []);

  // ---- load songs, set up MIDI (auto-connect if the site is already allowed) ----
  useEffect(() => {
    let alive = true;
    loadPianoSongs()
      .then((list) => alive && setSongs(list))
      .catch(() => alive && setLoadError("Could not load the songs. Check your connection and reload the page."));
    const kb = new MidiKeyboard();
    midiRef.current = kb;
    kb.onDevices = (list) => {
      setDevices(list);
      if (list.length) setInput("midi"); // a keyboard was plugged in: use it
    };
    kb.onNote = (ev) => {
      const e = engine();
      if (ev.on) noteOn(ev.midi, e.eventToCtx(ev.perfTime), "midi", ev.velocity);
      else noteOff(ev.midi);
    };
    if (midiSupported())
      void MidiKeyboard.alreadyAllowed().then(async (ok) => {
        if (!ok || !alive) return;
        const st = await kb.connect();
        if (!alive) return;
        setMidiStatus(st);
        setDevices([...kb.devices]);
        if (kb.devices.length) setInput("midi");
      });
    return () => {
      alive = false;
      kb.disconnect();
      engineRef.current?.close();
      engineRef.current = null;
    };
  }, [engine, noteOn, noteOff, setInput]);

  const connectMidi = useCallback(async () => {
    const kb = midiRef.current;
    if (!kb) return;
    setMidiStatus("asking");
    void engine().resume();
    const st = await kb.connect();
    setMidiStatus(st);
    setDevices([...kb.devices]);
    setInput("midi");
  }, [engine, setInput]);

  const enableMic = useCallback(async () => {
    setMic("asking");
    const e = engine();
    await e.resume();
    let st: MicStatus = "unsupported";
    try {
      st = await e.startPianoMic();
    } catch {
      st = "unsupported";
    }
    e.setPianoSensitivity(optsRef.current.sensitivity);
    setMic(st);
    if (st === "on") {
      setInput("mic");
      // the game's own piano would be heard by the mic: start with it quiet
      setOpts({ guide: false, accomp: false });
    }
  }, [engine, setInput, setOpts]);

  // ---------- play ----------

  const finish = useCallback(() => {
    const run = runRef.current;
    if (!run || run.finished) return;
    run.finished = true;
    const e = engineRef.current;
    e?.stopAll();
    e?.allNotesOff();
    const total = run.scoredTotal;
    // Wait mode has no misses, so its accuracy is right keys vs wrong keys.
    const accuracy =
      run.mode === "wait"
        ? total
          ? (run.perfect + run.good) / Math.max(1, run.perfect + run.good + run.wrong)
          : 0
        : accuracyOf(run.perfect, run.good, total);
    const stars = starsFor(accuracy);
    const ranked = run.mode === "play";
    const boardScore = ranked ? boardScoreOf(accuracy, run.maxCombo, total, run.rate) : 0;
    const prev = readBest(run.song.id);
    const newBest = ranked && total > 0 && (!prev || boardScore > prev.score);
    if (newBest) save(BEST_KEY(run.song.id), { score: boardScore, stars, accuracy });
    const avg = run.offsets.length ? run.offsets.reduce((a, b) => a + b, 0) / run.offsets.length : null;
    setResult({
      song: run.song,
      mode: run.mode,
      input: run.input,
      speed: run.rate,
      perfect: run.perfect,
      good: run.good,
      miss: run.miss,
      wrong: run.wrong,
      maxCombo: run.maxCombo,
      total,
      accuracy,
      stars,
      score: run.score,
      boardScore,
      avgOffsetMs: avg === null ? null : Math.round(avg * 1000),
      newBest,
    });
    setView("results");
  }, []);

  const judgePress = useCallback((midi: number, heard: number, source: Source) => {
    const run = runRef.current;
    const st = run?.stage;
    const color = (c: string) => {
      if (!run) return;
      const held = source !== "mic";
      run.userKeys.set(midi, { color: c, until: held ? -1 : st!.now + 0.35 });
    };
    if (!run || run.finished || run.paused) return;
    if (run.mode === "listen" || run.songT < run.countStart) {
      color("#a5b4fc");
      return;
    }
    const offsetSec = (offsetsRef.current[source] ?? 0) / 1000;
    const t = heard - offsetSec;
    const songAt = run.mode === "wait" ? run.songT : run.startSong + (t - run.anchorCtx) * run.rate;
    const w = run.mode === "wait" ? { perfect: 0.25, good: 0.6 } : windowsFor(source);
    let m = matchPress(run.notes, midi, songAt, run.rate, w, (h, e) => pitchMatches(h, e, source === "mic"));
    if (!m && run.mode === "wait") {
      // Wait mode: the next note (or any key of the next chord) is accepted even if played early.
      const next = run.notes.find((n) => n.scored && !n.judged);
      const idx = next
        ? run.notes.findIndex((n) => n.scored && !n.judged && Math.abs(n.t - next.t) < 1e-6 && pitchMatches(midi, n.midi, source === "mic"))
        : -1;
      if (idx >= 0) m = { index: idx, offset: (songAt - run.notes[idx].t) / run.rate, grade: "good" };
    }
    const l = layout(st!.width, st!.height, st!.lo, st!.hi);
    const k = l.x(midi);
    if (!m) {
      if (source === "mic") {
        color("#94a3b8");
        return;
      }
      color("#f87171");
      const first = run.notes.find((n) => n.scored);
      if (first && songAt > first.t - 0.5) {
        run.wrong += 1;
        run.combo = 0;
        st!.popups.push({ text: "✗", color: "#f87171", x: k.x + k.w / 2, born: st!.now });
      }
      return;
    }
    const n = run.notes[m.index];
    let grade = m.grade;
    if (run.mode === "wait" && run.waiting && heard - run.waitStart > 0.35) grade = "good";
    n.judged = true;
    n.state = grade;
    n.hitAt = st!.now;
    run.combo += 1;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.score += pointsFor(grade, run.combo);
    if (grade === "perfect") run.perfect += 1;
    else run.good += 1;
    if (run.mode === "play") run.offsets.push(m.offset);
    const c = grade === "perfect" ? "#facc15" : "#22d3ee";
    color("#4ade80");
    const nk = l.x(n.midi);
    st!.popups.push({
      text: grade === "perfect" ? "Perfect" : run.mode === "wait" ? "Good" : m.offset < 0 ? "Good · early" : "Good · late",
      color: c,
      x: nk.x + nk.w / 2,
      born: st!.now,
    });
    burst(st!, nk.x + nk.w / 2, l.hitY, c);
  }, []);

  const start = useCallback(
    async (modeOverride?: Mode) => {
      if (!song) return;
      setError("");
      const e = engine();
      await e.resume();
      e.stopAll();
      const o = optsRef.current;
      const mode = modeOverride ?? o.mode;
      const inp = inputRef.current;
      const hasL = song.tracks.some((t) => t.hand === "L");
      const hands = !hasL && o.hands === "L" ? "both" : o.hands;
      const rate = o.speed;
      const notes: RunNote[] = song.notes.map((n) => {
        const handOk = hands === "both" || n.hand === hands;
        const micOk = inp !== "mic" || (n.main && (hands !== "both" || n.hand === "R"));
        return {
          id: n.id,
          midi: n.midi,
          t: n.t,
          dur: n.dur,
          hand: n.hand,
          scored: mode !== "listen" && handOk && micOk,
          judged: false,
          state: "pending",
          hitAt: 0,
        };
      });
      const spb = 60 / song.bpm;
      const clickSec = clickBeat(song.timeSig) * spb;
      const barSec = song.beatsPerBar * spb;
      const pickupSec = (song.pickup ?? 0) * spb;
      let bars = Math.max(1, Math.ceil((2 * rate) / barSec));
      let countStart = pickupSec - bars * barSec;
      while (-countStart / clickSec < 2.99) {
        bars += 1;
        countStart = pickupSec - bars * barSec;
      }
      const startSong = Math.min(countStart, -LOOKAHEAD * rate) - 0.3 * rate;
      const anchorCtx = e.ctx.currentTime + 0.2;
      const toCtx = (st: number) => anchorCtx + (st - startSong) / rate;
      const lastEnd = Math.max(...song.notes.map((n) => n.t + n.dur));
      const [lo, hi] = keyboardRange(song.minMidi, song.maxMidi);
      const labels = o.labels === "auto" ? (song.labels === "sargam" ? "sargam" : "letters") : o.labels;
      const scoredMidis = notes.filter((n) => n.scored || mode === "listen").map((n) => n.midi);
      const kbBase = bestKbBase(scoredMidis);
      const tonic = noteToMidi(`${(song.key ?? "C").replace("m", "")}4`) ?? 60;

      const events: { at: number; play: (at: number) => void }[] = [];
      for (let ct = countStart; ct < -1e-6; ct += clickSec) {
        const accent = Math.abs(((ct - pickupSec) / barSec) - Math.round((ct - pickupSec) / barSec)) < 1e-3;
        events.push({ at: toCtx(ct), play: (at) => e.tick(at, accent, 0.6) });
      }
      if (mode !== "wait") {
        if (o.metronome && mode !== "listen") {
          for (let ct = 0; ct < lastEnd - 1e-6; ct += clickSec) {
            const accent = Math.abs(((ct - pickupSec) / barSec) - Math.round((ct - pickupSec) / barSec)) < 1e-3;
            events.push({ at: toCtx(ct), play: (at) => e.tick(at, accent, 0.35) });
          }
        }
        for (const n of notes) {
          const play = mode === "listen" || (n.scored ? o.guide : o.accomp);
          if (!play) continue;
          const dur = (n.dur * 0.95) / rate;
          events.push({ at: toCtx(n.t), play: (at) => e.pianoNote(n.midi, at, dur, n.scored ? 0.75 : 0.55) });
        }
      }
      e.runSchedule(events);

      const stage: StageState = {
        width: 800,
        height: 500,
        dpr: 1,
        lo,
        hi,
        notes,
        songT: startSong,
        rate,
        now: performance.now() / 1000,
        lookahead: LOOKAHEAD,
        labels,
        tonic,
        pressed: new Map(),
        guideKeys: new Set(),
        keyHints: new Map(),
        popups: [],
        sparks: [],
        hud: { title: song.title, score: 0, combo: 0, accuracy: null, progress: 0, countIn: null, banner: null, hearing: null, sub: "" },
      };
      runRef.current = {
        song,
        mode,
        input: inp,
        rate,
        notes,
        anchorCtx,
        startSong,
        songT: startSong,
        lastHeard: e.heardAt(),
        waiting: false,
        waitStart: 0,
        firstPending: 0,
        autoIdx: 0,
        clickSec,
        countStart,
        endT: lastEnd + 0.8 * rate,
        perfect: 0,
        good: 0,
        miss: 0,
        wrong: 0,
        combo: 0,
        maxCombo: 0,
        score: 0,
        offsets: [],
        paused: false,
        finished: false,
        stage,
        userKeys: new Map(),
        kbBase,
        scoredTotal: notes.filter((n) => n.scored).length,
        opts: o,
      };
      setPaused(false);
      setView("play");
      // phones: go full screen and sideways when the browser allows it
      if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
        const el = document.documentElement;
        void el
          .requestFullscreen?.()
          .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape"))
          .catch(() => undefined);
      }
    },
    [engine, song],
  );

  const togglePause = useCallback(async () => {
    const run = runRef.current;
    const e = engineRef.current;
    if (!run || !e || run.finished) return;
    if (!run.paused) {
      run.paused = true;
      await e.ctx.suspend();
      setPaused(true);
    } else {
      await e.ctx.resume();
      run.lastHeard = e.heardAt();
      run.paused = false;
      setPaused(false);
    }
  }, []);

  const quit = useCallback(() => {
    const run = runRef.current;
    if (run) run.finished = true;
    const e = engineRef.current;
    if (e) {
      e.stopAll();
      e.allNotesOff();
      if (e.ctx.state === "suspended") void e.ctx.resume();
    }
    setView("pick");
  }, []);

  // route inputs while playing
  useEffect(() => {
    if (view !== "play") return;
    sinkRef.current = (midi, heard, source) => judgePress(midi, heard, source);
    offRef.current = (midi) => runRef.current?.userKeys.delete(midi);
    return () => {
      sinkRef.current = null;
      offRef.current = null;
    };
  }, [view, judgePress]);

  // ---- the animation loop ----
  useEffect(() => {
    if (view !== "play") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const e = engineRef.current;
    if (!canvas || !wrap || !e) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      const run = runRef.current;
      if (run) {
        run.stage.width = r.width;
        run.stage.height = r.height;
        run.stage.dpr = dpr;
      }
      setPortrait(r.height > r.width && r.width < 700);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    let raf = 0;
    let lastPerf = performance.now();
    // ?pianodebug=1 exposes the song clock for automated timing tests
    const debug = new URLSearchParams(window.location.search).has("pianodebug");
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const run = runRef.current;
      if (!run) return;
      const perf = performance.now();
      const st = run.stage;
      st.now = perf / 1000;
      const dt = Math.min(0.1, (perf - lastPerf) / 1000);
      lastPerf = perf;
      if (!run.paused && !run.finished) {
        const heard = e.heardAt(perf);
        if (run.mode === "wait") {
          const prev = run.songT;
          let cand = prev + Math.max(0, heard - run.lastHeard) * run.rate;
          while (run.firstPending < run.notes.length && (!run.notes[run.firstPending].scored || run.notes[run.firstPending].judged))
            run.firstPending++;
          const next = run.notes[run.firstPending];
          if (next && cand >= next.t) {
            cand = next.t;
            if (!run.waiting) {
              run.waiting = true;
              run.waitStart = heard;
            }
          } else run.waiting = false;
          run.songT = cand;
          // the other hand plays along as the song moves
          while (run.autoIdx < run.notes.length && run.notes[run.autoIdx].t <= run.songT) {
            const n = run.notes[run.autoIdx++];
            if (!n.scored && n.t > prev - 1e-6 && run.opts.accomp) e.pianoNote(n.midi, e.ctx.currentTime, n.dur / run.rate, 0.55);
          }
        } else {
          run.songT = run.startSong + (heard - run.anchorCtx) * run.rate;
        }
        run.lastHeard = heard;
        if (run.mode === "play") {
          const slack = Math.max(0, (offsetsRef.current[run.input] ?? 0) / 1000) + (run.input === "mic" ? 0.1 : 0.03);
          for (const i of expiredNotes(run.notes, run.songT, run.rate, windowsFor(run.input), slack)) {
            const n = run.notes[i];
            n.judged = true;
            n.state = "miss";
            run.miss += 1;
            run.combo = 0;
            const l = layout(st.width, st.height, st.lo, st.hi);
            const k = l.x(n.midi);
            st.popups.push({ text: "Miss", color: "#f43f5e", x: k.x + k.w / 2, born: st.now });
          }
        }
        if (run.songT >= run.endT) {
          finish();
          return;
        }
      }
      // keys to light: what the user holds, plus notes the game plays itself
      const pressed = new Map<number, KeyLight>();
      const guide = new Set<number>();
      for (const n of run.notes) {
        if (n.t > run.songT + 0.5) break;
        const sounding = n.t <= run.songT && run.songT < n.t + n.dur;
        if (sounding && (!n.scored || run.mode === "listen")) pressed.set(n.midi, { color: n.hand === "R" ? "#7dd3fc" : "#fdba74", until: -1 });
        if (n.scored && !n.judged && Math.abs(n.t - run.songT) / run.rate < 0.2) guide.add(n.midi);
      }
      for (const [m, k] of run.userKeys) pressed.set(m, k);
      st.pressed = pressed;
      st.guideKeys = guide;
      stepEffects(st, dt);
      // drop expired user-key flashes
      for (const [m, k] of run.userKeys) if (k.until > 0 && k.until < st.now) run.userKeys.delete(m);
      const hints = new Map<number, string>();
      if (run.input === "keys") for (const [code, semi] of Object.entries(KEYMAP)) hints.set(run.kbBase + semi, KEYLABEL[code]);
      st.keyHints = hints;
      st.songT = run.songT;
      if (debug) (window as unknown as { __piano?: object }).__piano = { songT: run.songT, rate: run.rate, notes: run.notes, perfect: run.perfect, good: run.good, miss: run.miss };
      const judged = run.perfect + run.good + run.miss;
      const firstT = run.notes.length ? run.notes[0].t : 0;
      st.hud = {
        title: `${run.song.title}${run.mode === "wait" ? " · Wait mode" : run.mode === "listen" ? " · Listen" : ""}`,
        score: run.score,
        combo: run.combo,
        accuracy: judged && run.mode === "play" ? accuracyOf(run.perfect, run.good, judged) : null,
        progress: (run.songT - firstT) / Math.max(0.1, run.endT - firstT),
        countIn:
          run.songT >= run.countStart && run.songT < -1e-3 ? Math.max(1, Math.ceil(-run.songT / run.clickSec - 1e-6)) : null,
        banner: run.paused
          ? "Paused"
          : run.mode === "wait" && run.waiting
            ? `Play ${[...guide].map((m) => midiToName(m)).join(" + ") || "the next note"}`
            : run.songT < run.countStart
              ? "Get ready…"
              : null,
        hearing: run.input === "mic" ? (hearingRef.current ?? "…") : null,
        sub: `${Math.round(run.rate * 100)}% · ${run.input === "midi" ? "MIDI" : run.input === "mic" ? "Mic" : "Keys"}${
          run.wrong ? ` · ${run.wrong} wrong` : ""
        }`,
      };
      draw(g, st);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [view, finish]);

  useEffect(() => {
    hearingRef.current = hearing;
  }, [hearing]);

  // full screen + scroll lock on the play stage
  useEffect(() => {
    if (view !== "play") return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const id = window.setTimeout(() => setCanFull(Boolean(document.fullscreenEnabled && wrapRef.current?.requestFullscreen)), 0);
    const onFs = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.clearTimeout(id);
      document.documentElement.style.overflow = prev;
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [view]);

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current?.parentElement;
    if (!wrap) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void wrap.requestFullscreen?.().catch(() => undefined);
  }, []);

  // computer keyboard: piano rows, Z/X octave, P/Esc pause
  useEffect(() => {
    if (view !== "play" && view !== "calibrate" && view !== "pick") return;
    const down = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT" || tgt.isContentEditable)) return;
      if (view === "pick" && inputRef.current !== "keys") return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const run = runRef.current;
      if (view === "play" && (ev.code === "Escape" || ev.code === "Space")) {
        ev.preventDefault();
        if (!ev.repeat) void togglePause();
        return;
      }
      if (ev.code === "KeyZ" || ev.code === "KeyX") {
        ev.preventDefault();
        if (run && !ev.repeat) run.kbBase = Math.max(24, Math.min(96, run.kbBase + (ev.code === "KeyZ" ? -12 : 12)));
        return;
      }
      const semi = KEYMAP[ev.code];
      if (semi === undefined) return;
      ev.preventDefault();
      if (ev.repeat) return;
      const base = view === "play" && run ? run.kbBase : 60;
      noteOn(base + semi, engine().eventToCtx(ev.timeStamp), "keys", 0.8);
      held.set(ev.code, base + semi);
    };
    const held = new Map<string, number>();
    const up = (ev: KeyboardEvent) => {
      const m = held.get(ev.code);
      if (m === undefined) return;
      held.delete(ev.code);
      noteOff(m);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [view, engine, noteOn, noteOff, togglePause]);

  // on the setup screen, played notes just light the "last note" read-out
  useEffect(() => {
    if (view !== "pick") return;
    sinkRef.current = null;
  }, [view]);

  // ---------- views ----------

  if (view === "calibrate") {
    return (
      <Calibration
        engine={engine}
        input={input}
        sinkRef={sinkRef}
        onDone={(ms) => {
          if (ms !== null) setOffset(input, ms);
          setView("pick");
        }}
      />
    );
  }

  if (view === "play" && song) {
    const btn =
      "rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/25 sm:px-5 sm:py-2.5 sm:text-sm";
    const pointers = pointersRef.current;
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-[#05040f]/95 sm:p-3 lg:p-4" role="dialog" aria-modal="true" aria-label={`Playing ${song.title}`}>
        <div className="relative h-full w-full select-none overflow-hidden sm:rounded-3xl sm:shadow-2xl" style={{ background: "#0b0820" }}>
          <div
            ref={wrapRef}
            className="absolute inset-0"
            style={{ touchAction: "none" }}
            onPointerDown={(ev) => {
              const run = runRef.current;
              if (!run) return;
              const r = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
              const st = run.stage;
              const l = layout(st.width, st.height, st.lo, st.hi);
              const m = keyAt(l, st.lo, st.hi, ev.clientX - r.left, ev.clientY - r.top);
              if (m === null) return;
              pointers.set(ev.pointerId, m);
              noteOn(m, engine().eventToCtx(ev.timeStamp), "keys", 0.8);
            }}
            onPointerUp={(ev) => {
              const m = pointers.get(ev.pointerId);
              if (m !== undefined) {
                pointers.delete(ev.pointerId);
                noteOff(m);
              }
            }}
            onPointerCancel={(ev) => {
              const m = pointers.get(ev.pointerId);
              if (m !== undefined) {
                pointers.delete(ev.pointerId);
                noteOff(m);
              }
            }}
          >
            <canvas ref={canvasRef} className="block" aria-label={`Falling notes for ${song.title}`} />
          </div>
          <div className="absolute right-3 top-14 flex gap-2 sm:right-5 sm:top-16">
            {canFull ? (
              <button type="button" onClick={toggleFullscreen} className={btn} aria-pressed={isFull}>
                {isFull ? "Exit full screen" : "Full screen"}
              </button>
            ) : null}
            <button type="button" onClick={() => void togglePause()} className={btn}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" onClick={quit} className={btn}>
              Quit
            </button>
          </div>
          {portrait ? (
            <p className="absolute inset-x-3 top-24 rounded-xl bg-amber-400/90 px-3 py-2 text-center text-xs font-semibold text-[#1b1446]">
              Turn your phone sideways for a bigger keyboard 🔄
            </p>
          ) : null}
          {error ? <p className="absolute inset-x-0 top-24 px-5 text-center text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>,
      document.body,
    );
  }

  if (view === "results" && result) {
    return (
      <Results
        result={result}
        onReplay={() => void start(result.mode)}
        onPick={() => setView("pick")}
        onPost={() => onFinish(result.boardScore)}
      />
    );
  }

  // ----- setup / song picker -----
  const offsetMs = offsets[input];
  const byLevel = [1, 2, 3, 4].map((lv) => ({ lv, list: songs.filter((s) => s.level === lv) }));
  const hasL = !!song?.tracks.some((t) => t.hand === "L");

  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-[#0b0820] via-[#14204a] to-[#1b1446] p-5 text-white sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Piano trainer</p>
        <h3 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
          Play the falling notes 🎹
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Notes fall towards the keyboard in time with the song. Play each key just as its note touches the glowing line —
          every note is scored Perfect, Good or Miss.
        </p>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/60">Step 1 · Connect your piano</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-[1.25fr_1fr]">
          {/* MIDI first: the main way to play */}
          <div className={`rounded-2xl p-4 ${input === "midi" ? "bg-white/15 ring-2 ring-amber-400" : "bg-white/10"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">🎹 Digital piano or keyboard (MIDI)</p>
              <span className="rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0b0820]">Best</span>
            </div>
            <p className="mt-1 text-xs text-white/70">
              Connect your keyboard to this device with a USB cable (or a USB-MIDI adapter). Every key, chord and how hard
              you press is read exactly.
            </p>
            {midiStatus === "unsupported" ? (
              <p className="mt-3 text-sm text-amber-200">
                This browser can&apos;t read MIDI keyboards. Use Chrome or Edge on a computer or Android device — or use your
                microphone below.
              </p>
            ) : midiStatus === "asking" ? (
              <p className="mt-3 text-sm text-white/85">Allow MIDI access in the browser pop-up…</p>
            ) : midiStatus === "denied" ? (
              <div className="mt-3">
                <p className="text-sm text-amber-200">MIDI access was blocked. Allow MIDI devices for this site in the browser settings and try again.</p>
                <button type="button" onClick={() => void connectMidi()} className="mt-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold">
                  Try again
                </button>
              </div>
            ) : midiStatus === "ready" && devices.length ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-emerald-300">✅ Connected: {devices.map((d) => d.name).join(", ")}</p>
                {input !== "midi" ? (
                  <button type="button" onClick={() => setInput("midi")} className="mt-2 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#1b1446]">
                    Use this keyboard
                  </button>
                ) : (
                  <p className="mt-1 text-xs text-white/70">Press a key to test it{lastNote ? ` — last key: ${lastNote}` : ""}.</p>
                )}
              </div>
            ) : midiStatus === "ready" ? (
              <div className="mt-3 rounded-xl bg-black/20 p-3">
                <p className="text-sm text-white/90">Looking for a keyboard… none found yet.</p>
                <p className="mt-1 text-xs text-white/65">
                  Plug in the USB cable and switch the keyboard on — it is picked up automatically, no need to reload.
                </p>
                <p className="mt-2 text-xs font-semibold text-amber-300">No cable? Use your microphone instead ↓</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void connectMidi()}
                className="mt-3 w-full rounded-xl bg-amber-400 px-3 py-2.5 text-sm font-bold text-[#1b1446] hover:bg-amber-300"
              >
                Connect MIDI keyboard
              </button>
            )}
          </div>

          <div className="grid gap-3">
            <div className={`rounded-2xl p-4 ${input === "mic" ? "bg-white/15 ring-2 ring-amber-400" : "bg-white/10"}`}>
              <p className="font-semibold">🎤 No cable? Use your microphone</p>
              <p className="mt-1 text-xs text-white/70">
                For an acoustic piano, or a keyboard you can&apos;t connect. Put this device near the piano. The mic hears one
                note at a time, so melody songs work best; in two-hand songs only the right-hand tune is checked.
              </p>
              {mic === "on" ? (
                input === "mic" ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                        <div ref={meterRef} className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400" style={{ width: "0%" }} />
                      </div>
                      <span className="min-w-[4.5rem] text-right font-mono text-xs text-emerald-300">{hearing ?? "—"}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/60">Play a single key — its name should show here{lastNote ? ` (last: ${lastNote})` : ""}.</p>
                    <label className="mt-2 block text-[11px] text-white/70">
                      Sensitivity
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={opts.sensitivity}
                        onChange={(ev) => {
                          const v = Number(ev.target.value);
                          setOpts({ sensitivity: v });
                          engineRef.current?.setPianoSensitivity(v);
                        }}
                        className="mt-1 block w-full accent-amber-400"
                      />
                    </label>
                  </div>
                ) : (
                  <button type="button" onClick={() => setInput("mic")} className="mt-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold">
                    Use the microphone
                  </button>
                )
              ) : mic === "asking" ? (
                <p className="mt-2 text-sm text-white/80">Allow the microphone in the browser pop-up…</p>
              ) : mic === "denied" || mic === "unsupported" ? (
                <p className="mt-2 text-sm text-amber-200">The microphone is blocked or not available. Allow it for this site and try again.</p>
              ) : (
                <button type="button" onClick={() => void enableMic()} className="mt-2 w-full rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25">
                  Turn on the microphone
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInput("keys")}
              className={`rounded-2xl p-3 text-left ${input === "keys" ? "bg-white/15 ring-2 ring-amber-400" : "bg-white/5 hover:bg-white/10"}`}
            >
              <p className="text-sm font-semibold">⌨️ No piano right now? Just try it</p>
              <p className="mt-0.5 text-[11px] text-white/65">
                Tap the keys on screen, or use the computer keyboard: A S D F G H J K = white keys, W E T Y U = black keys, Z / X =
                octave down / up.
              </p>
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white/5 p-3">
          <div className="flex items-center justify-between text-xs text-white/70">
            <label htmlFor="piano-input-delay">
              Input delay ({input === "midi" ? "MIDI keyboard" : input === "mic" ? "microphone" : "keys / taps"})
            </label>
            <span className="font-mono">
              {offsetMs > 0 ? "+" : ""}
              {offsetMs} ms
              {offsetMs !== 0 ? (
                <button type="button" onClick={() => setOffset(input, 0)} className="ml-2 text-amber-300 hover:underline">
                  reset
                </button>
              ) : null}
            </span>
          </div>
          <input
            id="piano-input-delay"
            type="range"
            min={-INPUT_LIMIT_MS}
            max={INPUT_LIMIT_MS}
            step={5}
            value={offsetMs}
            onChange={(ev) => setOffset(input, Number(ev.target.value))}
            className="mt-1 w-full accent-amber-400"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/55">Notes judged late when you play on time? Slide right. Early? Slide left.</p>
            <button
              type="button"
              onClick={() => setView("calibrate")}
              className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-[#1b1446]"
            >
              Auto-calibrate
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/60">Step 2 · How to play</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="flex gap-2">
              {(
                [
                  ["play", "🏆 Play"],
                  ["wait", "🐢 Wait mode"],
                  ["listen", "🎧 Listen"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setOpts({ mode: m })}
                  className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                    opts.mode === m ? "bg-white text-[#1b1446]" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-white/60">
              {opts.mode === "play"
                ? "Play: the song keeps going — full scoring, stars and the leaderboard."
                : opts.mode === "wait"
                  ? "Wait mode: the song stops at each note until you play the right key. Great for learning a new song."
                  : "Listen: the song plays itself and the keys light up, so you can hear and see how it goes."}
            </p>
            <p className="mt-3 text-xs text-white/70">Speed</p>
            <div className="mt-1 flex gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpts({ speed: s })}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${opts.speed === s ? "bg-amber-400 text-[#1b1446]" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
            {hasL ? (
              <>
                <p className="mt-3 text-xs text-white/70">Hands (this song has a left-hand part)</p>
                <div className="mt-1 flex gap-1.5">
                  {(
                    [
                      ["both", "Both hands"],
                      ["R", "Right only"],
                      ["L", "Left only"],
                    ] as const
                  ).map(([h, label]) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setOpts({ hands: h })}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${opts.hands === h ? "bg-amber-400 text-[#1b1446]" : "bg-white/10 hover:bg-white/20"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-white/55">The hand you don&apos;t play is shown faded and can play along by itself.</p>
              </>
            ) : null}
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/70">Note names on the falling notes</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(
                [
                  ["auto", "Auto"],
                  ["letters", "C D E"],
                  ["sargam", "Sa Re Ga"],
                  ["off", "Off"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOpts({ labels: v })}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${opts.labels === v ? "bg-amber-400 text-[#1b1446]" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-1.5">
              <Toggle label="Metronome tick" checked={opts.metronome} onChange={(v) => setOpts({ metronome: v })} />
              <Toggle label="Sound for my keys (turn off if your piano has its own speakers)" checked={opts.keySound} onChange={(v) => setOpts({ keySound: v })} />
              <Toggle label="Hear the melody while I play" checked={opts.guide} onChange={(v) => setOpts({ guide: v })} />
              {hasL ? <Toggle label="Play the other hand for me" checked={opts.accomp} onChange={(v) => setOpts({ accomp: v })} /> : null}
            </div>
            {input === "mic" && (opts.guide || opts.accomp) ? (
              <p className="mt-2 text-[11px] text-amber-200">With the microphone, wear headphones so it hears your piano and not the game.</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!song}
            onClick={() => void start()}
            className="rounded-full bg-gradient-to-r from-[#1a9fd4] to-[#e8962e] px-8 py-3 text-base font-bold shadow-lg disabled:opacity-50"
          >
            ▶ {opts.mode === "listen" ? "Listen to" : "Play"} {song ? song.title : "…"}
          </button>
          {song && opts.mode !== "listen" ? (
            <button type="button" onClick={() => void start("listen")} className="rounded-full bg-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/25">
              🎧 Listen first
            </button>
          ) : null}
        </div>
      </div>

      <h4 className="mt-7 text-lg font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
        Pick a song
      </h4>
      <p className="text-sm text-[var(--muted)]">Classical pieces, nursery rhymes and exercises — from Beginner to Advanced.</p>
      {loadError ? <p className="mt-2 text-sm text-rose-600">{loadError}</p> : null}
      {!songs.length && !loadError ? <p className="mt-2 text-sm text-[var(--muted)]">Loading songs…</p> : null}
      {byLevel.map(({ lv, list }) =>
        list.length ? (
          <div key={lv} className="mt-4">
            <p className="text-sm font-semibold">
              {"★".repeat(lv)}
              <span className="text-[var(--muted)]">{"☆".repeat(4 - lv)}</span> {LEVELS[lv]}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <SongCard key={s.id} song={s} selected={s.id === song?.id} onPick={() => setSongId(s.id)} />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-0.5 text-white/85">
      <span className="text-xs">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-amber-400" />
    </label>
  );
}

const LEVEL_COLORS = ["", "#16a34a", "#0ea5e9", "#7c3aed", "#e11d48"];

function SongCard({ song, selected, onPick }: { song: PianoSong; selected: boolean; onPick: () => void }) {
  const [best] = useState(() => readBest(song.id));
  const accent = LEVEL_COLORS[song.level];
  const twoHands = song.tracks.some((t) => t.hand === "L");
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
        selected ? "border-transparent shadow-md" : "border-[var(--border)] hover:border-[var(--brand-blue)]"
      }`}
      style={selected ? { boxShadow: `0 0 0 2px ${accent}`, background: `${accent}10` } : undefined}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-white" style={{ background: accent }}>
        🎹
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{song.title}</span>
        <span className="mt-0.5 block text-xs text-[var(--muted)]">
          {LEVELS[song.level]} · {twoHands ? "both hands" : "right hand"} · {song.timeSig.join("/")} · {song.bpm} bpm
        </span>
        {song.blurb ? <span className="mt-1 block text-xs text-[var(--muted)]">{song.blurb}</span> : null}
        {best ? (
          <span className="mt-1 block text-xs font-semibold text-amber-600">
            Best {"★".repeat(best.stars)} · {Math.round(best.accuracy * 100)}%
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Results({ result: r, onReplay, onPick, onPost }: { result: Result; onReplay: () => void; onPick: () => void; onPost: () => void }) {
  const ranked = r.mode === "play";
  const tip =
    r.mode === "listen"
      ? "Now try it yourself — Wait mode is a gentle way to start."
      : r.mode === "wait"
        ? "Wait mode is practice. When the notes feel easy, try Play mode at 75% speed."
        : r.avgOffsetMs === null
          ? r.input === "mic"
            ? "No notes were heard. Check that the mic shows the note names on the setup screen."
            : "No notes were played in time. Try Wait mode or a slower speed."
          : Math.abs(r.avgOffsetMs) < 30
            ? "Your timing is right on the beat."
            : r.avgOffsetMs < 0
              ? `You tend to play a little early (about ${Math.abs(r.avgOffsetMs)} ms). Wait for the note to touch the line.`
              : `You tend to play a little late (about ${r.avgOffsetMs} ms). Watch the notes coming — or run Auto-calibrate.`;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#0b0820] via-[#14204a] to-[#1b1446] p-6 text-center text-white sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
        {r.song.title} · {Math.round(r.speed * 100)}% speed · {r.mode === "play" ? "Play" : r.mode === "wait" ? "Wait mode" : "Listen"}
      </p>
      {r.mode !== "listen" ? (
        <>
          <div className="mt-4 text-5xl tracking-widest sm:text-6xl" aria-label={`${r.stars} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < r.stars ? "text-amber-400" : "text-white/15"} style={i < r.stars ? { textShadow: "0 0 18px #f59e0b" } : undefined}>
                ★
              </span>
            ))}
          </div>
          <p className="mt-3 text-4xl font-black">{Math.round(r.accuracy * 100)}%</p>
          <p className="text-sm text-white/70">accuracy</p>
          {r.newBest ? <p className="mt-2 text-sm font-bold text-amber-300">New personal best!</p> : null}
          <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Perfect" value={r.perfect} color="#facc15" />
            <Stat label="Good" value={r.good} color="#22d3ee" />
            <Stat label="Miss" value={r.miss} color="#f43f5e" />
            <Stat label="Wrong keys" value={r.wrong} color="#fb923c" />
            <Stat label="Best combo" value={r.maxCombo} color="#f472b6" />
          </div>
          {ranked ? (
            <p className="mt-4 text-sm text-white/75">
              Points {r.score.toLocaleString()} · Leaderboard score <strong>{r.boardScore}</strong>
              {r.speed < 1 ? " (scaled for slower speed)" : ""}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-2xl font-bold">That&apos;s how it goes! 🎶</p>
      )}
      <p className="mx-auto mt-2 max-w-md text-xs text-white/60">{tip}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onReplay} className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#1b1446]">
          {r.mode === "listen" ? "Listen again" : "Play again"}
        </button>
        <button type="button" onClick={onPick} className="rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold">
          Choose a song
        </button>
        {ranked && r.total > 0 ? (
          <button type="button" onClick={onPost} className="rounded-full bg-gradient-to-r from-[#1a9fd4] to-[#e8962e] px-6 py-2.5 text-sm font-bold">
            Post to leaderboard
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3">
      <p className="text-2xl font-black" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
    </div>
  );
}

/** Ticks at a steady beat; the player plays any key on each tick. The median offset becomes the input delay. */
function Calibration({
  engine,
  input,
  sinkRef,
  onDone,
}: {
  engine: () => PianoEngine;
  input: Input;
  sinkRef: RefObject<((midi: number, heard: number, source: Source, vel: number) => void) | null>;
  onDone: (ms: number | null) => void;
}) {
  const [phase, setPhase] = useState<"ready" | "running" | "done">("ready");
  const [count, setCount] = useState(0);
  const [beat, setBeat] = useState(-1);
  const [resultMs, setResultMs] = useState<number | null>(null);
  const ticksRef = useRef<number[]>([]);
  const hitsRef = useRef<number[]>([]);
  const N = 12;
  const INTERVAL = 0.6;

  const run = useCallback(async () => {
    const e = engine();
    await e.resume();
    const t0 = e.ctx.currentTime + 1;
    ticksRef.current = Array.from({ length: N }, (_, i) => t0 + i * INTERVAL);
    hitsRef.current = [];
    setCount(0);
    setPhase("running");
    e.runSchedule(ticksRef.current.map((at, i) => ({ at, play: (a: number) => e.tick(a, i % 4 === 0, 0.8) })));
  }, [engine]);

  useEffect(() => {
    if (phase !== "running") return;
    sinkRef.current = (_midi, heard, source) => {
      if (source !== input && !(input === "keys" && source === "keys")) return;
      const ticks = ticksRef.current;
      let best = 0;
      for (let i = 1; i < ticks.length; i++) if (Math.abs(ticks[i] - heard) < Math.abs(ticks[best] - heard)) best = i;
      const off = heard - ticks[best];
      if (best >= 2 && Math.abs(off) < 0.3) {
        hitsRef.current.push(off);
        setCount(hitsRef.current.length);
      }
    };
    const e = engine();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const h = e.heardAt();
      const ticks = ticksRef.current;
      let b = -1;
      for (let i = 0; i < ticks.length; i++) if (h >= ticks[i] - 0.02) b = i;
      setBeat(b);
      if (h > ticks[ticks.length - 1] + 0.5) {
        cancelAnimationFrame(raf);
        const hits = [...hitsRef.current].sort((a, z) => a - z);
        const med = hits.length >= 4 ? hits[Math.floor(hits.length / 2)] : null;
        setResultMs(med === null ? null : Math.round((med * 1000) / 5) * 5);
        setPhase("done");
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sinkRef.current = null;
    };
  }, [phase, engine, input, sinkRef]);

  const how =
    input === "midi"
      ? "Press any key on your MIDI keyboard"
      : input === "mic"
        ? "Play any single key on your piano (loud and short)"
        : "Press any letter key (A S D F…) or tap the circle";
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#0b0820] via-[#14204a] to-[#1b1446] p-6 text-center text-white sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Timing calibration</p>
      <h3 className="mt-2 text-2xl font-bold">{how} exactly on each tick</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
        You&apos;ll hear {N} ticks. Start playing from the third tick. We measure how late your {input === "midi" ? "keyboard" : input === "mic" ? "microphone" : "device"} reports
        each note and correct for it.
      </p>
      <button
        type="button"
        aria-label="Tap on the tick"
        onPointerDown={(ev) => {
          if (phase === "running") sinkRef.current?.(60, engine().eventToCtx(ev.timeStamp), "keys", 0.8);
        }}
        className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full text-4xl font-black transition"
        style={{ background: beat >= 0 && phase === "running" ? (beat % 2 ? "#7c3aed" : "#f59e0b") : "rgba(255,255,255,0.1)" }}
      >
        {phase === "running" ? (beat >= 0 ? beat + 1 : "…") : "🎹"}
      </button>
      <p className="mt-3 text-sm text-white/70">{phase === "running" ? `${count} notes heard` : null}</p>
      {phase === "done" ? (
        resultMs === null ? (
          <p className="mt-3 text-sm text-amber-200">Not enough notes were heard on the ticks. Try again.</p>
        ) : (
          <p className="mt-3 text-lg font-bold">
            Your input delay: {resultMs > 0 ? "+" : ""}
            {resultMs} ms
          </p>
        )
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {phase !== "running" ? (
          <button type="button" onClick={() => void run()} className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-[#1b1446]">
            {phase === "done" ? "Again" : "Start"}
          </button>
        ) : null}
        {phase === "done" && resultMs !== null ? (
          <button type="button" onClick={() => onDone(resultMs)} className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#1b1446]">
            Save
          </button>
        ) : null}
        <button type="button" onClick={() => onDone(null)} className="rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold">
          Back
        </button>
      </div>
    </div>
  );
}
