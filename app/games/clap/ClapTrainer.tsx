"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClapEngine, type MicStatus } from "./engine";
import {
  BUILT_IN_SONGS,
  UPLOAD_SLOTS,
  autoStars,
  clapNotes,
  clapTimes,
  loadUploadedSongs,
  lyricLines,
  songDuration,
  starsFor,
  starsLabel,
  type ClapSong,
} from "./songs";
import { draw, hitPoint, spawnBurst, stepEffects, type DrawState, type Judgement, type RunNote } from "./highway";

type View = "pick" | "calibrate" | "play" | "results" | "maker";
type InputMode = "mic" | "tap";

type Options = {
  speed: number;
  practice: boolean;
  metronome: boolean;
  melody: boolean;
  guideClaps: boolean;
  input: InputMode;
  sensitivity: number;
};

type Result = {
  song: ClapSong;
  practice: boolean;
  speed: number;
  perfect: number;
  good: number;
  miss: number;
  stray: number;
  maxCombo: number;
  total: number;
  accuracy: number;
  stars: number;
  score: number;
  boardScore: number;
  avgOffsetMs: number | null;
  newBest: boolean;
};

const PERFECT_S = 0.06;
const GOOD_S = 0.13;
const PRACTICE_PERFECT_S = 0.075;
const PRACTICE_GOOD_S = 0.17;
const SPEEDS = [0.5, 0.75, 0.9, 1, 1.15];

const OFFSET_KEY = (m: InputMode) => `uniedd-clap-offset:${m}`;
const BEST_KEY = (id: string) => `uniedd-clap-best:${id}`;
const OPTS_KEY = "uniedd-clap-options";

function readNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : Number(v) || fallback;
  } catch {
    return fallback;
  }
}

function readBest(id: string): { score: number; stars: number; accuracy: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BEST_KEY(id));
    return raw ? (JSON.parse(raw) as { score: number; stars: number; accuracy: number }) : null;
  } catch {
    return null;
  }
}

const DEFAULT_OPTS: Options = {
  speed: 1,
  practice: false,
  metronome: false,
  melody: true,
  guideClaps: false,
  input: "mic",
  sensitivity: 0.6,
};

function readOptions(): Options {
  if (typeof window === "undefined") return DEFAULT_OPTS;
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    return raw ? { ...DEFAULT_OPTS, ...(JSON.parse(raw) as Partial<Options>) } : DEFAULT_OPTS;
  } catch {
    return DEFAULT_OPTS;
  }
}

/** Live state of one play-through (kept in a ref, drawn every frame). */
type Run = {
  song: ClapSong;
  notes: RunNote[];
  rate: number;
  practice: boolean;
  // clock: songTime(ctxT) = anchorSong + (ctxT - anchorCtx) * rate
  anchorCtx: number;
  anchorSong: number;
  audio: HTMLAudioElement | null;
  audioStarted: boolean;
  audioSmooth: number;
  lastPerf: number;
  firstBeatTime: number;
  countInStart: number;
  endTime: number;
  nextIdx: number;
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  stray: number;
  offsets: number[];
  paused: boolean;
  finished: boolean;
  draw: DrawState;
  micOffset: number;
  tapOffset: number;
};

export function ClapTrainer({ onFinish }: { onFinish: (score: number) => void }) {
  const [view, setView] = useState<View>("pick");
  const [uploaded, setUploaded] = useState<ClapSong[]>([]);
  const [songId, setSongId] = useState(BUILT_IN_SONGS[0].id);
  const [opts, setOptsState] = useState<Options>(readOptions);
  const [mic, setMic] = useState<MicStatus>("off");
  const [micOffsetMs, setMicOffsetMs] = useState(() => readNumber(OFFSET_KEY("mic"), 0));
  const [tapOffsetMs, setTapOffsetMs] = useState(() => readNumber(OFFSET_KEY("tap"), 0));
  const [result, setResult] = useState<Result | null>(null);
  const [paused, setPaused] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [error, setError] = useState("");
  const [clapFlash, setClapFlash] = useState(0);
  const [customSong, setCustomSong] = useState<ClapSong | null>(null);

  const engineRef = useRef<ClapEngine | null>(null);
  const runRef = useRef<Run | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const levelRef = useRef(0);
  const inputHandlerRef = useRef<((ctxT: number, source: InputMode) => void) | null>(null);

  const allSongs = [...BUILT_IN_SONGS, ...uploaded, ...(customSong ? [customSong] : [])];
  const song = allSongs.find((s) => s.id === songId) || BUILT_IN_SONGS[0];

  const setOpts = useCallback((patch: Partial<Options>) => {
    setOptsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(OPTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void loadUploadedSongs().then((list) => {
      if (alive) setUploaded(list);
    });
    return () => {
      alive = false;
      runRef.current?.audio?.pause();
      engineRef.current?.close();
      engineRef.current = null;
    };
  }, []);

  const engine = useCallback(() => {
    if (!engineRef.current) {
      const e = new ClapEngine();
      e.onLevel = (rms) => {
        const lvl = Math.min(1, rms * 8);
        levelRef.current = lvl;
        if (meterRef.current) meterRef.current.style.width = `${Math.round(lvl * 100)}%`;
      };
      e.onClap = (t) => {
        setClapFlash((n) => n + 1);
        inputHandlerRef.current?.(t, "mic");
      };
      engineRef.current = e;
    }
    return engineRef.current;
  }, []);

  const enableMic = useCallback(async () => {
    setMic("asking");
    const e = engine();
    await e.resume();
    let status: MicStatus = "unsupported";
    try {
      status = await e.startMic();
    } catch {
      status = "unsupported";
    }
    e.setSensitivity(opts.sensitivity);
    setMic(status);
    if (status !== "on") setOpts({ input: "tap" });
    else setOpts({ input: "mic" });
    return status;
  }, [engine, opts.sensitivity, setOpts]);

  // ---------- Play loop ----------

  const songTimeAt = (run: Run, ctxT: number) => run.anchorSong + (ctxT - run.anchorCtx) * run.rate;

  const judge = useCallback((ctxT: number, source: InputMode) => {
    const run = runRef.current;
    if (!run || run.paused || run.finished) return;
    const offset = (source === "mic" ? run.micOffset : run.tapOffset) / 1000;
    const s = songTimeAt(run, ctxT - offset);
    const perfectW = (run.practice ? PRACTICE_PERFECT_S : PERFECT_S) * run.rate;
    const goodW = (run.practice ? PRACTICE_GOOD_S : GOOD_S) * run.rate;
    let best = -1;
    let bestD = Infinity;
    for (let i = run.nextIdx; i < run.notes.length; i++) {
      const n = run.notes[i];
      if (n.t > s + goodW) break;
      if (n.judged) continue;
      const d = Math.abs(n.t - s);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const st = run.draw;
    const hp = canvasRef.current ? hitPoint(canvasRef.current.clientWidth, canvasRef.current.clientHeight) : { x: 0, y: 0 };
    const perfNow = performance.now();
    st.pulse = 1;
    if (best < 0 || bestD > goodW) {
      run.stray += 1;
      st.pulseColor = "#94a3b8";
      return;
    }
    const n = run.notes[best];
    const kind: Judgement = bestD <= perfectW ? "perfect" : "good";
    n.judged = kind;
    n.judgedAt = perfNow;
    run.offsets.push((s - n.t) / run.rate);
    run.combo += 1;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    const mult = Math.min(4, 1 + Math.floor(run.combo / 10));
    const gained = (kind === "perfect" ? 100 : 60) * mult;
    run.score += gained;
    if (kind === "perfect") run.perfect += 1;
    else run.good += 1;
    const early = s < n.t;
    const color = kind === "perfect" ? "#facc15" : "#22d3ee";
    st.pulseColor = color;
    st.popups.push({
      text: kind === "perfect" ? "PERFECT" : early ? "GOOD · early" : "GOOD · late",
      color,
      born: perfNow,
      x: hp.x,
      y: hp.y - 46,
    });
    if (!run.practice) st.popups.push({ text: `+${gained}`, color: "#ffffff", born: perfNow, x: hp.x + 90, y: hp.y - 10 });
    if (run.combo > 0 && run.combo % 10 === 0) {
      st.popups.push({ text: `${run.combo} STREAK!`, color: "#f472b6", born: perfNow, x: hp.x, y: hp.y - 120, big: true });
      spawnBurst(st.particles, hp.x, hp.y, "#f472b6", 40);
    }
    spawnBurst(st.particles, hp.x, hp.y, color, kind === "perfect" ? 28 : 14);
    while (run.nextIdx < run.notes.length && run.notes[run.nextIdx].judged) run.nextIdx++;
  }, []);

  useEffect(() => {
    inputHandlerRef.current = judge;
  }, [judge]);

  const finish = useCallback(() => {
    const run = runRef.current;
    if (!run || run.finished) return;
    run.finished = true;
    run.audio?.pause();
    engineRef.current?.stopAll();
    const total = run.notes.length;
    const accuracy = total ? (run.perfect + run.good * 0.6) / total : 0;
    const stars = starsFor(accuracy);
    const boardScore = Math.round(
      Math.min(5000, (accuracy * 4000 + (run.maxCombo / Math.max(1, total)) * 1000) * Math.min(1, run.rate)),
    );
    const prev = readBest(run.song.id);
    const newBest = !run.practice && (!prev || boardScore > prev.score);
    if (newBest) {
      try {
        localStorage.setItem(BEST_KEY(run.song.id), JSON.stringify({ score: boardScore, stars, accuracy }));
      } catch {
        /* ignore */
      }
    }
    const avg = run.offsets.length ? run.offsets.reduce((a, b) => a + b, 0) / run.offsets.length : null;
    setResult({
      song: run.song,
      practice: run.practice,
      speed: run.rate,
      perfect: run.perfect,
      good: run.good,
      miss: run.miss,
      stray: run.stray,
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

  const start = useCallback(async () => {
    setError("");
    const e = engine();
    await e.resume();
    if (opts.input === "mic" && !e.micOn) {
      const status = await enableMic();
      if (status !== "on") setError("Mic is not available, so tap mode is on: press Space or tap the stage.");
    }
    e.setSensitivity(opts.sensitivity);
    const rate = opts.speed;
    const spb = 60 / song.bpm; // song seconds per beat
    const times = clapTimes(song);
    const notes: RunNote[] = clapNotes(song).map((n, i) => ({
      t: times[i],
      end: times[i] + n.len * spb,
      lyric: n.lyric,
      joinNext: /-$/.test(n.lyric || ""),
      line: 0,
      judged: null,
      judgedAt: 0,
    }));
    const lines = lyricLines(clapNotes(song).map((n, i) => ({ t: times[i], lyric: n.lyric, br: n.br })));
    lines.forEach((line, li) => line.forEach((i) => (notes[i].line = li)));
    const hasLyrics = notes.some((n) => n.lyric);
    const firstBeatTime = song.offset ?? 0;
    const countInStart = firstBeatTime - song.beatsPerBar * spb;
    const preRoll = 0.9 * rate; // a little breathing room before the count-in
    const startSong = countInStart - preRoll;
    const now = e.ctx.currentTime + 0.12;
    let audio: HTMLAudioElement | null = null;
    if (song.audio) {
      setLoadingAudio(true);
      audio = new Audio(song.audio);
      audio.preload = "auto";
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      audio.playbackRate = rate;
      const ok = await new Promise<boolean>((resolve) => {
        const done = (v: boolean) => {
          audio?.removeEventListener("canplaythrough", yes);
          audio?.removeEventListener("error", no);
          resolve(v);
        };
        const yes = () => done(true);
        const no = () => done(false);
        audio?.addEventListener("canplaythrough", yes);
        audio?.addEventListener("error", no);
        audio?.load();
        window.setTimeout(() => done(audio ? audio.readyState >= 3 : false), 15000);
      });
      setLoadingAudio(false);
      if (!ok) {
        setError(`Could not load the audio file for “${song.title}”. Check the file name in songs.json.`);
        return;
      }
    }
    const anchorCtx = now;
    const anchorSong = startSong;
    // schedule the count-in clicks and (for built-in songs) the synth performance
    const ctxFor = (songT: number) => anchorCtx + (songT - anchorSong) / rate;
    for (let b = 0; b < song.beatsPerBar; b++) e.click(ctxFor(countInStart + b * spb), b === 0, 0.55);
    if (!song.audio) {
      e.scheduleSong(song, ctxFor(firstBeatTime), rate, {
        melody: opts.melody,
        backing: opts.melody,
        metronome: opts.metronome,
        guideClaps: opts.guideClaps,
      });
    } else {
      if (opts.metronome) {
        for (let b = 0; b < song.lengthBeats; b++) e.click(ctxFor(firstBeatTime + b * spb), b % song.beatsPerBar === 0, 0.35);
      }
      if (opts.guideClaps) for (const n of notes) e.clap(ctxFor(n.t), 0.22);
    }
    const lastNote = notes.length ? notes[notes.length - 1].t : 0;
    const endTime = Math.max(lastNote + 1.6 * rate, song.audio ? Math.min(songDuration(song), lastNote + 4) : songDuration(song) + 0.4);
    runRef.current = {
      song,
      notes,
      rate,
      practice: opts.practice,
      anchorCtx,
      anchorSong,
      audio,
      audioStarted: false,
      audioSmooth: 0,
      lastPerf: performance.now(),
      firstBeatTime,
      countInStart,
      endTime,
      nextIdx: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      good: 0,
      miss: 0,
      stray: 0,
      offsets: [],
      paused: false,
      finished: false,
      micOffset: micOffsetMs,
      tapOffset: tapOffsetMs,
      draw: {
        song,
        notes,
        now: startSong,
        rate,
        firstBeatTime,
        countInStart,
        score: 0,
        combo: 0,
        multiplier: 1,
        accuracy: null,
        progress: 0,
        pulse: 0,
        pulseColor: "#ffffff",
        popups: [],
        particles: [],
        practice: opts.practice,
        paused: false,
        micLevel: 0,
        lines: hasLyrics ? lines : [],
        inputLabel: e.micOn && opts.input === "mic" ? "🎤 Listening for claps · Space / tap also works" : "⌨️ Space or tap the stage",
      },
    };
    setPaused(false);
    setView("play");
  }, [engine, enableMic, opts, song, micOffsetMs, tapOffsetMs]);

  // animation + timing loop while playing
  useEffect(() => {
    if (view !== "play") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const e = engineRef.current;
    if (!canvas || !wrap || !e) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    let raf = 0;
    let lastFrame = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const run = runRef.current;
      if (!run) return;
      const perfNow = performance.now();
      const dt = Math.min(0.05, (perfNow - lastFrame) / 1000);
      lastFrame = perfNow;
      const st = run.draw;
      if (!run.paused && !run.finished) {
        const heard = e.heardNow(perfNow);
        // audio files: start the element when its time comes, then follow its clock
        if (run.audio) {
          const songNow = songTimeAt(run, heard);
          if (!run.audioStarted && songNow >= 0) {
            run.audio.currentTime = Math.max(0, songNow);
            void run.audio.play().catch(() => setError("The browser blocked audio playback — press Play again."));
            run.audioStarted = true;
            run.audioSmooth = songNow;
          } else if (run.audioStarted && !run.audio.paused) {
            run.audioSmooth += dt * run.rate;
            const actual = run.audio.currentTime;
            const drift = actual - run.audioSmooth;
            if (Math.abs(drift) > 0.08) run.audioSmooth = actual;
            else run.audioSmooth += drift * 0.08;
            run.anchorSong = run.audioSmooth;
            run.anchorCtx = heard;
          }
          if (run.audioStarted && run.audio.ended) run.endTime = Math.min(run.endTime, songTimeAt(run, heard));
        }
        const now = songTimeAt(run, heard);
        st.now = now;
        // misses: a note is gone once it is past the late window (plus input delay)
        const lateW = (run.practice ? PRACTICE_GOOD_S : GOOD_S) * run.rate;
        const slack = (Math.max(run.micOffset, run.tapOffset, 0) / 1000 + 0.04) * run.rate;
        for (let i = run.nextIdx; i < run.notes.length; i++) {
          const n = run.notes[i];
          if (n.t + lateW + slack > now) break;
          if (!n.judged) {
            n.judged = "miss";
            n.judgedAt = perfNow;
            run.combo = 0;
            run.miss += 1;
            const hp = hitPoint(wrap.clientWidth, wrap.clientHeight);
            st.popups.push({ text: "MISS", color: "#f43f5e", born: perfNow, x: hp.x, y: hp.y - 46 });
          }
        }
        while (run.nextIdx < run.notes.length && run.notes[run.nextIdx].judged) run.nextIdx++;
        const judged = run.perfect + run.good + run.miss;
        st.score = run.score;
        st.combo = run.combo;
        st.multiplier = Math.min(4, 1 + Math.floor(run.combo / 10));
        st.accuracy = judged ? (run.perfect + run.good * 0.6) / judged : null;
        st.progress = (now - run.firstBeatTime) / Math.max(0.1, run.endTime - run.firstBeatTime);
        st.micLevel = e.micOn ? levelRef.current : 0;
        st.popups = st.popups.filter((p) => perfNow - p.born < 800);
        stepEffects(st, dt);
        if (now >= run.endTime) {
          finish();
          return;
        }
      }
      st.paused = run.paused;
      draw(ctx2d, wrap.clientWidth, wrap.clientHeight, st, perfNow);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [view, finish]);

  const togglePause = useCallback(async () => {
    const run = runRef.current;
    const e = engineRef.current;
    if (!run || !e || run.finished) return;
    if (!run.paused) {
      run.paused = true;
      run.audio?.pause();
      await e.ctx.suspend();
      setPaused(true);
    } else {
      await e.ctx.resume();
      if (run.audio && run.audioStarted) void run.audio.play();
      run.paused = false;
      setPaused(false);
    }
  }, []);

  const quit = useCallback(() => {
    const run = runRef.current;
    if (run) {
      run.finished = true;
      run.audio?.pause();
    }
    const e = engineRef.current;
    if (e) {
      e.stopAll();
      if (e.ctx.state === "suspended") void e.ctx.resume();
    }
    setView("pick");
  }, []);

  // keyboard: Space/Enter/J/F = clap, P/Escape = pause
  useEffect(() => {
    if (view !== "play") return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.code === "Space" || ev.code === "Enter" || ev.code === "KeyJ" || ev.code === "KeyF") {
        ev.preventDefault();
        const e = engineRef.current;
        if (e) judge(e.eventToCtx(ev.timeStamp), "tap");
      } else if (ev.code === "KeyP" || ev.code === "Escape") {
        ev.preventDefault();
        void togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, judge, togglePause]);

  // ---------- Views ----------

  if (view === "calibrate") {
    return (
      <Calibration
        engine={engine}
        mic={mic}
        input={opts.input}
        onEnableMic={enableMic}
        onDone={(mode, ms) => {
          if (ms !== null) {
            try {
              localStorage.setItem(OFFSET_KEY(mode), String(ms));
            } catch {
              /* ignore */
            }
            if (mode === "mic") setMicOffsetMs(ms);
            else setTapOffsetMs(ms);
          }
          setView("pick");
        }}
      />
    );
  }

  if (view === "maker") {
    return (
      <SongMaker
        engine={engine}
        tapOffsetMs={tapOffsetMs}
        onBack={() => setView("pick")}
        onTry={(s) => {
          setCustomSong(s);
          setSongId(s.id);
          setView("pick");
        }}
      />
    );
  }

  if (view === "play") {
    return (
      <div className="-mx-5 sm:mx-0">
        <div
          ref={wrapRef}
          className="relative w-full select-none overflow-hidden sm:rounded-3xl"
          style={{
            height: "min(calc(100svh - 180px), 620px)",
            minHeight: 360,
            touchAction: "none",
            background: "#0b0820",
            scrollMarginTop: 84,
          }}
          onPointerDown={(ev) => {
            if ((ev.target as HTMLElement).closest("button")) return;
            const e = engineRef.current;
            if (e) judge(e.eventToCtx(ev.timeStamp), "tap");
          }}
        >
          <canvas ref={canvasRef} className="block" aria-label={`Clap rhythm highway for ${song.title}`} />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <button
              type="button"
              onClick={() => void togglePause()}
              className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/25"
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={quit}
              className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/25"
            >
              Quit
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 px-5 text-sm text-rose-600 sm:px-0">{error}</p> : null}
        <p className="mt-3 px-5 text-center text-xs text-[var(--muted)] sm:px-0">
          Clap when a 👏 marker reaches the glowing ring. Space, Enter or a tap on the stage also counts.
        </p>
      </div>
    );
  }

  if (view === "results" && result) {
    return (
      <Results
        result={result}
        onReplay={() => void start()}
        onPick={() => setView("pick")}
        onPost={() => onFinish(result.boardScore)}
      />
    );
  }

  // ----- Song picker / setup -----
  const mains = BUILT_IN_SONGS.filter((s) => !s.kids);
  const kids = BUILT_IN_SONGS.filter((s) => s.kids);
  const emptySlots = Math.max(0, UPLOAD_SLOTS - uploaded.length);
  const offsetMs = opts.input === "mic" ? micOffsetMs : tapOffsetMs;

  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-[#0b0820] via-[#1b1446] to-[#2a1240] p-5 text-white sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Rhythm trainer</p>
        <h3 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
          Clap the rhythm of the song 👏
        </h3>
        <p className="mt-2 max-w-xl text-sm text-white/75">
          Clap markers slide down the stage in time with the tune. Clap (or tap) just as each one meets the glowing ring.
          The mic hears your real claps and scores every one: Perfect, Good or Miss.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">How you clap</p>
            <div className="mt-2 flex gap-2">
              {(["mic", "tap"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => (m === "mic" && mic !== "on" ? void enableMic() : setOpts({ input: m }))}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    opts.input === m ? "bg-white text-[#1b1446]" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {m === "mic" ? "🎤 Real claps (mic)" : "⌨️ Tap / Space"}
                </button>
              ))}
            </div>
            {opts.input === "mic" ? (
              <div className="mt-3">
                {mic === "on" ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                        <div ref={meterRef} className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400" style={{ width: "0%" }} />
                      </div>
                      <span
                        key={clapFlash}
                        className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-[#1b1446]"
                        style={{ animation: clapFlash ? "uniedd-clap-pop 0.5s ease-out" : undefined, opacity: clapFlash ? 1 : 0.35 }}
                      >
                        👏 {clapFlash}
                      </span>
                    </div>
                    <label className="mt-3 block text-xs text-white/70">
                      Clap sensitivity
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={opts.sensitivity}
                        onChange={(ev) => {
                          const v = Number(ev.target.value);
                          setOpts({ sensitivity: v });
                          engineRef.current?.setSensitivity(v);
                        }}
                        className="mt-1 block w-full accent-amber-400"
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-white/60">
                      Clap once — the counter should go up by one. Talking should not count. Headphones keep the music out of the mic.
                    </p>
                  </>
                ) : mic === "asking" ? (
                  <p className="text-sm text-white/80">Waiting for your OK… allow the microphone in the browser pop-up.</p>
                ) : mic === "denied" || mic === "unsupported" ? (
                  <p className="text-sm text-amber-200">
                    The mic is blocked or not available, so tap mode is on. To use claps, allow the microphone for this site and press “Real claps” again.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void enableMic()}
                    className="mt-1 w-full rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-[#1b1446]"
                  >
                    Turn on the mic
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/70">Press Space (or J/F) on a keyboard, or tap the stage on a phone.</p>
            )}
            <button
              type="button"
              onClick={() => setView("calibrate")}
              className="mt-3 text-xs font-semibold text-amber-300 hover:underline"
            >
              ⏱ Calibrate timing {offsetMs ? `(now ${offsetMs > 0 ? "+" : ""}${offsetMs} ms)` : "(recommended once)"}
            </button>
          </div>

          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Options</p>
            <div className="mt-2 flex gap-2">
              {([false, true] as const).map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  onClick={() => setOpts({ practice: p })}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    opts.practice === p ? "bg-white text-[#1b1446]" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {p ? "🧘 Practice" : "🏆 Play"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-white/60">
              {opts.practice
                ? "Practice: wider timing windows, no score pressure. Great with the metronome and slow speed."
                : "Play: full scoring, stars and the leaderboard."}
            </p>
            <p className="mt-3 text-xs text-white/70">Speed</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpts({ speed: s })}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    opts.speed === s ? "bg-amber-400 text-[#1b1446]" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
              <Toggle label="Play the tune" checked={opts.melody} onChange={(v) => setOpts({ melody: v })} />
              <Toggle label="Metronome click" checked={opts.metronome} onChange={(v) => setOpts({ metronome: v })} />
              <Toggle
                label="Guide claps (use headphones with the mic)"
                checked={opts.guideClaps}
                onChange={(v) => setOpts({ guideClaps: v })}
              />
            </div>
          </div>
        </div>
      </div>

      <h4 className="mt-7 text-lg font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
        Pick a song
      </h4>
      <p className="text-sm text-[var(--muted)]">10 song slots — more songs are on the way.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[...mains, ...uploaded].map((s, i) => (
          <SongCard key={s.id} song={s} slot={i + 1} selected={s.id === song.id} onPick={() => setSongId(s.id)} />
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div
            key={`slot-${i}`}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] p-4 text-[var(--muted)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f4f5] text-sm font-bold">
              {mains.length + uploaded.length + i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold">Song slot {mains.length + uploaded.length + i + 1}</p>
              <p className="text-xs">Coming soon</p>
            </div>
          </div>
        ))}
      </div>

      <h4 className="mt-7 text-lg font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
        🧸 Kids &amp; Nursery Rhymes
      </h4>
      <p className="text-sm text-[var(--muted)]">Short, friendly tunes — perfect first clapping songs.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[...kids, ...(customSong ? [customSong] : [])].map((s) => (
          <SongCard key={s.id} song={s} selected={s.id === song.id} onPick={() => setSongId(s.id)} />
        ))}
      </div>

      <div className="sticky bottom-3 z-10 mt-6 flex flex-col items-center gap-2">
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="button"
          onClick={() => void start()}
          disabled={loadingAudio}
          className="rounded-full px-10 py-4 text-base font-bold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${song.accent}, #1b1446)` }}
        >
          {loadingAudio ? "Loading song…" : `▶ Start “${song.title}”`}
        </button>
      </div>

      <details className="mt-8 rounded-2xl border border-[var(--border)] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">For teachers: make a clap chart for your own song</summary>
        <p className="mt-2 text-[var(--muted)]">
          Load an audio file, tap along to its rhythm, and download a song file you can add to the game.
        </p>
        <button
          type="button"
          onClick={() => setView("maker")}
          className="mt-3 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:border-[var(--brand-blue)]"
        >
          Open the chart maker
        </button>
      </details>
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

function SongCard({ song, slot, selected, onPick }: { song: ClapSong; slot?: number; selected: boolean; onPick: () => void }) {
  const [best] = useState(() => readBest(song.id));
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
        selected ? "border-transparent shadow-md ring-2" : "border-[var(--border)] hover:border-[var(--brand-blue)]"
      }`}
      style={selected ? { boxShadow: `0 0 0 2px ${song.accent}`, background: `${song.accent}10` } : undefined}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ background: song.accent }}
      >
        {slot ?? "♪"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <Stars value={song.stars} />
          <span className="truncate font-semibold">{song.title}</span>
        </span>
        <span className="block truncate text-xs text-[var(--muted)]">
          {starsLabel(song.stars)} · {clapNotes(song).length} claps{song.subtitle ? ` · ${song.subtitle}` : ""}
        </span>
      </span>
      {best ? (
        <span className="shrink-0 text-right text-[10px] leading-tight text-[var(--muted)]" title={`Best score ${best.score}`}>
          Best
          <br />
          <strong className="text-xs text-[var(--foreground)]">{Math.round(best.accuracy * 100)}%</strong>
        </span>
      ) : null}
    </button>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="shrink-0 text-sm leading-none tracking-tight" aria-label={`Difficulty ${value} of 5 stars`} title={`Difficulty ${value}/5`}>
      <span className="text-amber-500">{"★".repeat(value)}</span>
      <span className="text-[#d4d4d8]">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function Results({
  result,
  onReplay,
  onPick,
  onPost,
}: {
  result: Result;
  onReplay: () => void;
  onPick: () => void;
  onPost: () => void;
}) {
  const r = result;
  const tip =
    r.avgOffsetMs === null
      ? "No claps were heard. Check the mic level on the setup screen, or switch to tap mode."
      : Math.abs(r.avgOffsetMs) < 25
        ? "Your timing is centered nicely on the beat."
        : r.avgOffsetMs < 0
          ? `You tend to clap a little early (about ${Math.abs(r.avgOffsetMs)} ms). Relax and wait for the ring.`
          : `You tend to clap a little late (about ${r.avgOffsetMs} ms). Try to feel the beat coming — or re-run calibration.`;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#0b0820] via-[#1b1446] to-[#2a1240] p-6 text-center text-white sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
        {r.song.title} · {Math.round(r.speed * 100)}% speed {r.practice ? "· practice" : ""}
      </p>
      <div className="mt-4 text-5xl tracking-widest sm:text-6xl" aria-label={`${r.stars} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={i < r.stars ? "text-amber-400" : "text-white/15"}
            style={i < r.stars ? { animation: `uniedd-clap-pop 0.5s ease-out ${i * 0.12}s both`, textShadow: "0 0 18px #f59e0b" } : undefined}
          >
            ★
          </span>
        ))}
      </div>
      <p className="mt-3 text-4xl font-black">{Math.round(r.accuracy * 100)}%</p>
      <p className="text-sm text-white/70">accuracy</p>
      {r.newBest ? <p className="mt-2 text-sm font-bold text-amber-300">New personal best!</p> : null}
      <div className="mx-auto mt-6 grid max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Perfect" value={r.perfect} color="#facc15" />
        <Stat label="Good" value={r.good} color="#22d3ee" />
        <Stat label="Miss" value={r.miss} color="#f43f5e" />
        <Stat label="Best streak" value={r.maxCombo} color="#f472b6" />
      </div>
      {!r.practice ? (
        <p className="mt-4 text-sm text-white/75">
          Points {r.score.toLocaleString()} · Leaderboard score <strong>{r.boardScore}</strong>
          {r.speed < 1 ? " (scaled for slower speed)" : ""}
        </p>
      ) : (
        <p className="mt-4 text-sm text-white/75">Practice run — switch to Play mode to post a score.</p>
      )}
      <p className="mx-auto mt-2 max-w-md text-xs text-white/60">{tip}</p>
      {r.stray > 3 ? (
        <p className="mx-auto mt-1 max-w-md text-xs text-white/50">
          {r.stray} extra claps were heard between notes. If you didn’t make them, lower the sensitivity or use headphones.
        </p>
      ) : null}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onReplay} className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#1b1446]">
          Play again
        </button>
        <button type="button" onClick={onPick} className="rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold">
          Choose a song
        </button>
        {!r.practice ? (
          <button
            type="button"
            onClick={onPost}
            className="rounded-full bg-gradient-to-r from-[#1a9fd4] to-[#e8962e] px-6 py-2.5 text-sm font-bold"
          >
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

// ---------- Calibration ----------

const CAL_BPM = 90;
const CAL_COUNT_IN = 4;
const CAL_CLICKS = 12;

function Calibration({
  engine,
  mic,
  input,
  onEnableMic,
  onDone,
}: {
  engine: () => ClapEngine;
  mic: MicStatus;
  input: InputMode;
  onEnableMic: () => Promise<MicStatus>;
  onDone: (mode: InputMode, ms: number | null) => void;
}) {
  const [mode, setMode] = useState<InputMode>(mic === "on" ? input : "tap");
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [beat, setBeat] = useState(-1);
  const [hits, setHits] = useState(0);
  const [measured, setMeasured] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const sessionRef = useRef<{ clicks: number[]; inputs: number[]; mode: InputMode } | null>(null);

  const finishCal = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    const spb = 60 / CAL_BPM;
    const deltas: number[] = [];
    for (const t of s.inputs) {
      let best = Infinity;
      for (const c of s.clicks.slice(CAL_COUNT_IN)) if (Math.abs(t - c) < Math.abs(best)) best = t - c;
      if (Math.abs(best) < spb * 0.45) deltas.push(best);
    }
    sessionRef.current = null;
    setPhase("done");
    if (deltas.length < 5) {
      setMeasured(null);
      setNote("Not enough claps were heard to measure. Try again, a bit louder or closer to the mic.");
      return;
    }
    deltas.sort((a, b) => a - b);
    const median = deltas[Math.floor(deltas.length / 2)];
    setMeasured(Math.round(median * 1000));
    setNote(`${deltas.length} claps measured.`);
  }, []);

  useEffect(() => {
    const e = engine();
    const prev = e.onClap;
    e.onClap = (t, level) => {
      prev?.(t, level);
      const s = sessionRef.current;
      if (s && s.mode === "mic") {
        s.inputs.push(t);
        setHits((n) => n + 1);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.code !== "Space") return;
      ev.preventDefault();
      const s = sessionRef.current;
      if (s && s.mode === "tap") {
        s.inputs.push(e.eventToCtx(ev.timeStamp));
        setHits((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      e.onClap = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [engine]);

  async function run() {
    const e = engine();
    await e.resume();
    if (mode === "mic" && !e.micOn) {
      const st = await onEnableMic();
      if (st !== "on") {
        setMode("tap");
        setNote("The mic isn't available, so we'll calibrate tapping instead.");
        return;
      }
    }
    const spb = 60 / CAL_BPM;
    const t0 = e.ctx.currentTime + 0.5;
    const clicks: number[] = [];
    for (let i = 0; i < CAL_COUNT_IN + CAL_CLICKS; i++) {
      const t = t0 + i * spb;
      clicks.push(t);
      e.click(t, i % 4 === 0, 0.7);
    }
    sessionRef.current = { clicks, inputs: [], mode };
    setHits(0);
    setMeasured(null);
    setNote("");
    setPhase("running");
    // simple beat display
    const startPerf = performance.now() + 500;
    const total = CAL_COUNT_IN + CAL_CLICKS;
    const tick = () => {
      if (!sessionRef.current) return;
      const b = Math.floor((performance.now() - startPerf) / (spb * 1000));
      setBeat(b);
      if (b >= total + 1) {
        finishCal();
        return;
      }
      window.setTimeout(tick, 30);
    };
    tick();
  }

  const countIn = phase === "running" && beat < CAL_COUNT_IN;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#0b0820] via-[#1b1446] to-[#2a1240] p-6 text-center text-white sm:p-10">
      <h3 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
        Timing calibration
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/75">
        Every phone, laptop and headset has a tiny delay. Listen to the clicks and {mode === "mic" ? "clap" : "press Space / tap"} exactly on each
        one. We measure your delay and fix it for you.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {(["mic", "tap"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={phase === "running"}
            onClick={() => setMode(m)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === m ? "bg-white text-[#1b1446]" : "bg-white/10"}`}
          >
            {m === "mic" ? "🎤 Claps" : "⌨️ Taps"}
          </button>
        ))}
      </div>
      <div
        className="mx-auto mt-8 flex h-40 w-40 items-center justify-center rounded-full border-4 text-5xl font-black transition-transform"
        style={{
          borderColor: countIn ? "#94a3b8" : "#e8962e",
          boxShadow: phase === "running" ? "0 0 40px #e8962e88" : undefined,
          transform: phase === "running" && beat >= 0 ? `scale(${beat % 2 ? 1 : 1.06})` : undefined,
        }}
        onPointerDown={(ev) => {
          const s = sessionRef.current;
          if (s && s.mode === "tap") {
            s.inputs.push(engine().eventToCtx(ev.timeStamp));
            setHits((n) => n + 1);
          }
        }}
      >
        {phase === "running" ? (countIn ? CAL_COUNT_IN - beat : "👏") : phase === "done" ? "✓" : "⏱"}
      </div>
      <p className="mt-4 min-h-6 text-sm text-white/80">
        {phase === "running" ? (countIn ? "Listen… start on the next clicks" : `Heard ${hits}`) : note}
      </p>
      {phase === "done" && measured !== null ? (
        <p className="mt-2 text-lg font-bold">
          Your delay: {measured > 0 ? "+" : ""}
          {measured} ms
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {phase !== "running" ? (
          <button type="button" onClick={() => void run()} className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-[#1b1446]">
            {phase === "done" ? "Try again" : "Start"}
          </button>
        ) : null}
        {phase === "done" && measured !== null ? (
          <button type="button" onClick={() => onDone(mode, measured)} className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#1b1446]">
            Save & go back
          </button>
        ) : null}
        <button type="button" onClick={() => onDone(mode, null)} className="rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold">
          Back
        </button>
        {phase !== "running" ? (
          <button type="button" onClick={() => onDone(mode, 0)} className="rounded-full bg-white/5 px-4 py-2.5 text-xs text-white/70">
            Reset to 0
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Song maker (teachers) ----------

function SongMaker({
  engine,
  tapOffsetMs,
  onBack,
  onTry,
}: {
  engine: () => ClapEngine;
  tapOffsetMs: number;
  onBack: () => void;
  onTry: (song: ClapSong) => void;
}) {
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState(100);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [offset, setOffset] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.code !== "Space") return;
      ev.preventDefault();
      record();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function record() {
    const a = audioRef.current;
    if (!a || a.paused) return;
    const t = Math.max(0, a.currentTime - tapOffsetMs / 1000);
    setTaps((prev) => [...prev, Math.round(t * 1000) / 1000]);
  }

  function songFile() {
    const sorted = [...taps].sort((a, b) => a - b);
    return {
      title: title || file?.name.replace(/\.[^.]+$/, "") || "My song",
      bpm,
      timeSignature: `${beatsPerBar}/4`,
      audio: file?.name || "my-song.mp3",
      offset,
      clapTimes: sorted,
    };
  }

  function download() {
    const data = songFile();
    const id = (data.title || "song").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "song";
    const blob = new Blob([JSON.stringify({ id, ...data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${id}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function tryIt() {
    if (!file || taps.length < 2) return;
    const spb = 60 / bpm;
    const sorted = [...taps].sort((a, b) => a - b);
    const notes = sorted.map((t, i) => ({
      beat: (t - offset) / spb,
      len: Math.max(0.25, ((sorted[i + 1] ?? t + spb) - t) / spb),
    }));
    const last = notes[notes.length - 1];
    onTry({
      id: "custom-chart",
      title: `${title || "My chart"} (test)`,
      subtitle: "Your new chart",
      stars: autoStars({ notes, bpm, offset }),
      bpm,
      beatsPerBar,
      lengthBeats: last.beat + last.len + 1,
      notes,
      audio: file.url,
      offset,
      uploaded: true,
      accent: "#f43f5e",
    });
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] p-5 sm:p-7">
      <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
        Clap chart maker
      </h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
        <li>Choose the song’s audio file (stays on this device).</li>
        <li>Press play and tap Space (or the big button) on every clap of the rhythm.</li>
        <li>Press “Try it” to play your chart, then “Download song file” and add it to the game.</li>
      </ol>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Audio file
          <input
            type="file"
            accept="audio/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (file) URL.revokeObjectURL(file.url);
              setFile({ url: URL.createObjectURL(f), name: f.name });
              setTaps([]);
            }}
          />
        </label>
        <label className="text-sm">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" />
        </label>
        <label className="text-sm">
          BPM (for the beat lines)
          <input type="number" min={30} max={300} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 100)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" />
        </label>
        <label className="text-sm">
          Beats per bar
          <input type="number" min={2} max={12} value={beatsPerBar} onChange={(e) => setBeatsPerBar(Number(e.target.value) || 4)} className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2" />
        </label>
        <label className="text-sm sm:col-span-2">
          First downbeat at (seconds into the audio)
          <div className="mt-1 flex gap-2">
            <input type="number" step={0.01} value={offset} onChange={(e) => setOffset(Number(e.target.value) || 0)} className="block w-full rounded-xl border border-[var(--border)] px-3 py-2" />
            <button type="button" disabled={!taps.length} onClick={() => setOffset(Math.min(...taps))} className="shrink-0 rounded-xl border border-[var(--border)] px-3 text-xs disabled:opacity-40">
              Use first tap
            </button>
          </div>
        </label>
      </div>
      {file ? (
        <audio
          ref={audioRef}
          src={file.url}
          controls
          className="mt-4 w-full"
          onPlay={() => {
            void engine().resume();
            setRecording(true);
          }}
          onPause={() => setRecording(false)}
        />
      ) : null}
      <button
        type="button"
        disabled={!recording}
        onPointerDown={record}
        className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#1a9fd4] to-[#e8962e] py-6 text-lg font-black text-white disabled:opacity-40"
      >
        👏 Tap the rhythm ({taps.length})
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTaps([])} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm">
          Clear taps
        </button>
        <button type="button" onClick={() => setTaps((t) => t.slice(0, -1))} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm">
          Undo last
        </button>
        <button type="button" disabled={!file || taps.length < 2} onClick={tryIt} className="rounded-full bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Try it
        </button>
        <button type="button" disabled={taps.length < 2} onClick={download} className="rounded-full bg-[var(--brand-orange)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Download song file
        </button>
        <button type="button" onClick={onBack} className="rounded-full px-4 py-2 text-sm text-[var(--brand-blue)] hover:underline">
          Back to songs
        </button>
      </div>
    </div>
  );
}
