"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Board, type Arrow, type MoveInput } from "./Board";
import { moveSound, sounds } from "./sound";
import {
  DEFAULT_PROGRESS,
  THEME_LABELS,
  dailyPuzzle,
  dayKey,
  levelForRating,
  loadManifest,
  loadProgress,
  markSeen,
  parseUci,
  pickPuzzle,
  saveProgress,
  updateRating,
  type LevelId,
  type Manifest,
  type Progress,
  type Puzzle,
} from "./puzzles";

type Mode = "rated" | "level" | "daily" | "rush";
type Status = "loading" | "opponent" | "your-turn" | "wrong" | "solved" | "shown" | "rush-over" | "error";

const RUSH_SECONDS = 180;
const RUSH_STRIKES = 3;

function Stars({ n, of = 5 }: { n: number; of?: number }) {
  return (
    <span aria-label={`${n} of ${of} stars`} className="tracking-tight text-amber-500">
      {"★".repeat(n)}
      <span className="text-slate-300">{"★".repeat(of - n)}</span>
    </span>
  );
}

export default function PuzzleTrainer() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [progress, setProgress] = useState<Progress>(() => (typeof window === "undefined" ? DEFAULT_PROGRESS : loadProgress()));
  const [mode, setMode] = useState<Mode>("rated");
  const [level, setLevel] = useState<LevelId>("easy");
  const [theme, setTheme] = useState("");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState("8/8/8/8/8/8/8/8 w - - 0 1");
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [hint, setHint] = useState(0);
  const [failed, setFailed] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);
  const [rush, setRush] = useState({ left: RUSH_SECONDS, score: 0, strikes: 0, running: false, n: 0 });
  const token = useRef(0);
  const counted = useRef(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;


  const commit = useCallback((p: Progress) => {
    setProgress(p);
    saveProgress(p);
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    const t = token.current;
    window.setTimeout(() => {
      if (t === token.current) fn();
    }, ms);
  }, []);

  /** Apply a move given in UCI to a FEN; returns the new FEN and SAN. */
  function applyUci(f: string, uci: string) {
    const g = new Chess(f);
    const mv = g.move(parseUci(uci));
    return { fen: g.fen(), san: mv.san, captured: !!mv.captured, from: mv.from, to: mv.to };
  }

  const startPuzzle = useCallback(
    (p: Puzzle) => {
      token.current++;
      counted.current = false;
      setPuzzle(p);
      setFen(p.fen);
      setIdx(0);
      setHint(0);
      setFailed(false);
      setDelta(null);
      setFlash(null);
      setLastMove(null);
      setStatus("opponent");
      markSeen(p.id);
      later(650, () => {
        const r = applyUci(p.fen, p.moves[0]);
        moveSound(r.san, r.captured);
        setFen(r.fen);
        setLastMove({ from: r.from, to: r.to });
        setIdx(1);
        setStatus("your-turn");
      });
    },
    [later],
  );

  const manifestRef = useRef<Manifest | null>(null);
  const loadNext = useCallback(
    async (m: Mode = mode, opts: { rushN?: number; level?: LevelId } = {}) => {
      const manifest = manifestRef.current;
      if (!manifest) return;
      token.current++;
      setStatus("loading");
      try {
        let p: Puzzle;
        if (m === "daily") p = await dailyPuzzle(manifest);
        else if (m === "rush") {
          const target = 500 + 70 * (opts.rushN ?? 0);
          p = await pickPuzzle(manifest, { rating: target, window: 120 });
        } else if (m === "level") p = await pickPuzzle(manifest, { level: opts.level ?? level, theme: theme || undefined });
        else p = await pickPuzzle(manifest, { rating: progressRef.current.rating, window: 120, theme: theme || undefined });
        startPuzzle(p);
      } catch {
        setStatus("error");
      }
    },
    [mode, level, theme, startPuzzle],
  );

  // load the puzzle index, then the first puzzle
  const firstLoad = useRef(loadNext);
  useEffect(() => {
    loadManifest()
      .then((m) => {
        manifestRef.current = m;
        setManifest(m);
        void firstLoad.current("rated");
      })
      .catch(() => setStatus("error"));
  }, []);

  // rush clock
  useEffect(() => {
    if (!rush.running) return;
    const id = window.setInterval(() => {
      setRush((r) => {
        if (!r.running) return r;
        const left = r.left - 1;
        return left <= 0 ? { ...r, left: 0, running: false } : { ...r, left };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [rush.running]);

  useEffect(() => {
    if (mode === "rush" && !rush.running && rush.n > 0 && status !== "rush-over") endRush(rush.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rush.running]);

  function endRush(score: number) {
    token.current++;
    setStatus("rush-over");
    setRush((r) => ({ ...r, running: false }));
    const p = progressRef.current;
    if (score > p.rushBest) commit({ ...p, rushBest: score });
  }

  const rated = mode === "rated" || mode === "level";

  function recordResult(solved: boolean) {
    if (counted.current || !puzzle) return;
    counted.current = true;
    const p = progressRef.current;
    if (mode === "daily") {
      commit({ ...p, daily: { ...p.daily, [dayKey()]: solved } });
      return;
    }
    if (!rated) return;
    const rating = updateRating(p.rating, puzzle.rating, solved, p.played);
    setDelta(rating - p.rating);
    const streak = solved ? p.streak + 1 : 0;
    commit({
      ...p,
      rating,
      played: p.played + 1,
      solved: p.solved + (solved ? 1 : 0),
      streak,
      bestStreak: Math.max(p.bestStreak, streak),
    });
  }

  function solvedPuzzle(clean: boolean) {
    setStatus("solved");
    setFlash("good");
    sounds.solved();
    recordResult(clean);
    if (mode === "rush") {
      const n = rush.n + 1;
      setRush((r) => ({ ...r, score: r.score + 1, n: r.n + 1 }));
      later(500, () => void loadNext("rush", { rushN: n }));
    }
  }

  function onMove(m: MoveInput) {
    if (!puzzle || status !== "your-turn") return false;
    const g = new Chess(fen);
    let mv;
    try {
      mv = g.move(m);
    } catch {
      return false;
    }
    const uci = mv.from + mv.to + (mv.promotion ?? "");
    const expectedUci = puzzle.moves[idx];
    const isLast = idx === puzzle.moves.length - 1;
    const right = uci === expectedUci || (isLast && g.isCheckmate());
    moveSound(mv.san, !!mv.captured);
    setFen(g.fen());
    setLastMove({ from: mv.from, to: mv.to });
    setHint(0);
    if (!right) {
      sounds.wrong();
      setFlash("bad");
      setFailed(true);
      setStatus("wrong");
      recordResult(false);
      if (mode === "rush") {
        const strikes = rush.strikes + 1;
        const n = rush.n + 1;
        setRush((r) => ({ ...r, strikes: r.strikes + 1, n: r.n + 1 }));
        if (strikes >= RUSH_STRIKES) later(600, () => endRush(rush.score));
        else later(700, () => void loadNext("rush", { rushN: n }));
        return true;
      }
      const before = fen;
      later(650, () => {
        setFen(before);
        setFlash(null);
        setLastMove(null);
      });
      return true;
    }
    setFlash("good");
    later(350, () => setFlash(null));
    if (isLast) {
      solvedPuzzle(!failed);
      return true;
    }
    sounds.correct();
    setStatus("opponent");
    const after = g.fen();
    later(450, () => {
      const r = applyUci(after, puzzle.moves[idx + 1]);
      moveSound(r.san, r.captured);
      setFen(r.fen);
      setLastMove({ from: r.from, to: r.to });
      if (idx + 2 >= puzzle.moves.length) solvedPuzzle(!failed);
      else {
        setIdx(idx + 2);
        setStatus("your-turn");
      }
    });
    return true;
  }

  function tryAgain() {
    if (status === "wrong") {
      setFlash(null);
      setStatus("your-turn");
    }
  }

  function showHint() {
    if (!puzzle || status !== "your-turn") return;
    setHint((h) => Math.min(2, h + 1));
    setFailed(true);
    recordResult(false);
  }

  function showSolution() {
    if (!puzzle) return;
    token.current++;
    setFailed(true);
    recordResult(false);
    setStatus("shown");
    setHint(0);
    setFlash(null);
    // replay from the position before the wrong move / current position
    let f = fen;
    let i = idx;
    if (status === "wrong") {
      // the wrong move is on the board for a moment: rebuild from the start
      f = puzzle.fen;
      for (let k = 0; k < idx; k++) f = applyUci(f, puzzle.moves[k]).fen;
      setFen(f);
    }
    const step = () => {
      if (i >= puzzle.moves.length) return;
      const r = applyUci(f, puzzle.moves[i]);
      moveSound(r.san, r.captured);
      f = r.fen;
      setFen(f);
      setLastMove({ from: r.from, to: r.to });
      i++;
      setIdx(i);
      later(800, step);
    };
    later(300, step);
  }

  function retry() {
    if (puzzle) {
      const keepCounted = counted.current;
      startPuzzle(puzzle);
      counted.current = keepCounted;
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    token.current++;
    if (m === "rush") {
      setRush({ left: RUSH_SECONDS, score: 0, strikes: 0, running: false, n: 0 });
      setPuzzle(null);
      setStatus("rush-over");
      return;
    }
    void loadNext(m);
  }

  function startRush() {
    setRush({ left: RUSH_SECONDS, score: 0, strikes: 0, running: true, n: 0 });
    void loadNext("rush", { rushN: 0 });
  }


  // ----- derived -----
  const startTurn = puzzle ? new Chess(puzzle.fen).turn() : "w";
  const playerColor: "w" | "b" = startTurn === "w" ? "b" : "w";
  const orientation = playerColor === "w" ? "white" : "black";
  const expectedMove = puzzle && idx < puzzle.moves.length ? parseUci(puzzle.moves[idx]) : null;
  const highlights: Record<string, React.CSSProperties> = {};
  const arrows: Arrow[] = [];
  if (expectedMove && status === "your-turn") {
    if (hint >= 1) highlights[expectedMove.from] = { boxShadow: "inset 0 0 0 4px rgba(16,185,129,0.9)" };
    if (hint >= 2) arrows.push({ startSquare: expectedMove.from, endSquare: expectedMove.to, color: "rgba(16,185,129,0.85)" });
  }
  const levelInfo = manifest ? (mode === "level" ? manifest.levels.find((l) => l.id === level) : puzzle ? manifest.levels.find((l) => l.id === puzzle.level) : levelForRating(manifest.levels, progress.rating)) : undefined;
  const done = status === "solved" || status === "shown";
  const themeOptions = manifest
    ? Object.keys(THEME_LABELS)
        .map((t) => {
          const i = manifest.themes.indexOf(t);
          const lv = mode === "level" ? manifest.levels.find((l) => l.id === level) : null;
          const count = i < 0 ? 0 : lv ? lv.themes[i] ?? 0 : manifest.levels.reduce((s, l) => s + (l.themes[i] ?? 0), 0);
          return { t, count };
        })
        .filter((x) => x.count >= 20)
    : [];
  const total = manifest?.levels.reduce((s, l) => s + l.count, 0) ?? 0;
  const todayDone = progress.daily[dayKey()];

  const statusText: Record<Status, string> = {
    loading: "Loading puzzle…",
    opponent: "Opponent is moving…",
    "your-turn": `${playerColor === "w" ? "White" : "Black"} to move — find the best move`,
    wrong: mode === "rush" ? "Not that one — next puzzle!" : "Not the best move. Try again!",
    solved: failed ? "Solved — with help this time" : "Correct! Puzzle solved 🎉",
    shown: "Here’s the solution",
    "rush-over": rush.n ? `Time! You solved ${rush.score} puzzle${rush.score === 1 ? "" : "s"}` : "Puzzle Rush: solve as many as you can in 3 minutes",
    error: "Could not load puzzles. Check your connection and try again.",
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm" data-puzzle={puzzle ? `${puzzle.level}:${puzzle.id}` : undefined} data-status={status}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[#2563eb0f] px-5 py-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Puzzle mode">
          {(
            [
              ["rated", "⭐ Rated"],
              ["level", "🎯 By level"],
              ["daily", "📅 Daily"],
              ["rush", "⚡ Rush 3 min"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                mode === m ? "bg-[var(--brand-blue)] text-white shadow" : "bg-white text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link href="/games" className="text-sm text-[var(--brand-blue)] hover:underline">
          All games
        </Link>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto w-full max-w-[min(640px,calc(100vh-220px))] min-w-[280px]">
          <Board
            fen={fen}
            orientation={orientation}
            playerColor={status === "your-turn" ? playerColor : null}
            onMove={onMove}
            lastMove={lastMove}
            highlights={highlights}
            arrows={arrows}
            flash={flash}
          />
          {status === "rush-over" ? (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={startRush} className="rounded-full bg-[var(--brand-orange)] px-6 py-2.5 font-bold text-white shadow">
                {rush.n ? "Play Rush again" : "Start Puzzle Rush"}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Puzzle rating" value={progress.rating} sub={delta !== null ? `${delta >= 0 ? "+" : ""}${delta}` : undefined} good={delta !== null ? delta >= 0 : undefined} />
            <Stat label="Streak" value={progress.streak} sub={`best ${progress.bestStreak}`} />
            <Stat label="Rush best" value={progress.rushBest} sub={`${progress.solved}/${progress.played} solved`} />
          </div>

          {mode === "rush" ? (
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
              <span className="font-mono text-2xl">
                {Math.floor(rush.left / 60)}:{String(rush.left % 60).padStart(2, "0")}
              </span>
              <span className="text-lg font-bold">✅ {rush.score}</span>
              <span className="text-lg" aria-label={`${rush.strikes} of ${RUSH_STRIKES} mistakes`}>
                {Array.from({ length: RUSH_STRIKES }, (_, i) => (i < rush.strikes ? "❌" : "⚪")).join(" ")}
              </span>
            </div>
          ) : null}

          <div
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              status === "solved" ? "bg-emerald-50 text-emerald-800" : status === "wrong" || status === "error" ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-800"
            }`}
            aria-live="polite"
          >
            <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle ring-1 ring-slate-400" style={{ background: playerColor === "w" ? "#fff" : "#111" }} />
            {statusText[status]}
            {mode === "daily" && todayDone !== undefined && done ? (
              <span className="mt-1 block text-xs font-normal">Come back tomorrow for a new daily puzzle.</span>
            ) : null}
          </div>

          {mode !== "rush" ? (
            <div className="flex flex-wrap gap-2">
              {status === "wrong" ? <Btn onClick={tryAgain} primary>Try again</Btn> : null}
              <Btn onClick={showHint} disabled={status !== "your-turn"}>
                💡 {hint === 0 ? "Hint" : hint === 1 ? "Show move" : "Hint shown"}
              </Btn>
              <Btn onClick={showSolution} disabled={!puzzle || done || status === "loading" || status === "opponent"}>
                👀 Solution
              </Btn>
              <Btn onClick={retry} disabled={!puzzle}>↺ Retry</Btn>
              {mode !== "daily" ? (
                <Btn onClick={() => void loadNext()} primary={done}>
                  Next puzzle →
                </Btn>
              ) : null}
            </div>
          ) : null}

          {puzzle && levelInfo ? (
            <div className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{manifest?.levels.find((l) => l.id === puzzle.level)?.name}</span>
                <Stars n={manifest?.levels.find((l) => l.id === puzzle.level)?.stars ?? 1} />
              </div>
              <p className="mt-1 text-[var(--muted)]">
                Puzzle rating {done || status === "wrong" ? puzzle.rating : "hidden until you finish"}
              </p>
              {done ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {puzzle.themes
                    .filter((t) => THEME_LABELS[t])
                    .map((t) => (
                      <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {THEME_LABELS[t]}
                      </span>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "level" && manifest ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Difficulty</p>
              {manifest.levels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLevel(l.id);
                    void loadNext("level", { level: l.id });
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                    level === l.id ? "bg-[var(--brand-blue)] text-white" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <span>
                    <span className="font-semibold">{l.name}</span>{" "}
                    <span className={level === l.id ? "text-white/75" : "text-[var(--muted)]"}>
                      {l.min === 0 ? `under ${l.max}` : l.max >= 4000 ? `${l.min}+` : `${l.min}–${l.max - 1}`}
                    </span>
                  </span>
                  <span className={level === l.id ? "text-amber-300" : "text-amber-500"}>{"★".repeat(l.stars)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {(mode === "level" || mode === "rated") && manifest ? (
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              >
                <option value="">All themes</option>
                {themeOptions.map(({ t, count }) => (
                  <option key={t} value={t}>
                    {THEME_LABELS[t]} ({count.toLocaleString("en-US")})
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-[var(--muted)]">Applies from the next puzzle.</span>
            </label>
          ) : null}

          {mode === "rated" ? (
            <p className="text-xs text-[var(--muted)]">
              Rated puzzles are picked near your rating ({levelInfo?.name ?? "…"}). Solve on the first try to gain points; a wrong move, hint or solution
              costs points.
            </p>
          ) : null}
          {total ? (
            <p className="text-xs text-[var(--muted)]">{total.toLocaleString("en-US")} puzzles in 5 difficulty levels. Your progress is saved on this device.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, good }: { label: string; value: number; sub?: string; good?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-2 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub ? <p className={`text-xs ${good === undefined ? "text-[var(--muted)]" : good ? "text-emerald-600" : "text-rose-600"}`}>{sub}</p> : null}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? "bg-[var(--brand-orange)] text-white shadow" : "bg-white ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)]"
      }`}
    >
      {children}
    </button>
  );
}
