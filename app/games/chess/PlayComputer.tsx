"use client";

import { Chess, type Move } from "chess.js";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Board, type MoveInput } from "./Board";
import { moveSound, sounds } from "./sound";

type Level = { id: number; name: string; skill: number; depth?: number; movetime?: number; random?: number };

/** Computer strength: level 1 is a friendly random-ish mover, the rest use the engine. */
export const CPU_LEVELS: Level[] = [
  { id: 1, name: "Beginner", skill: 0, random: 1 },
  { id: 2, name: "Easy", skill: 0, depth: 2 },
  { id: 3, name: "Medium", skill: 6, depth: 5 },
  { id: 4, name: "Hard", skill: 13, depth: 10 },
  { id: 5, name: "Expert", skill: 20, movetime: 1200 },
];

const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Very light move picker (used for Beginner and as a fallback if the engine can't load). */
function simpleMove(g: Chess, randomness: number): Move {
  const moves = g.moves({ verbose: true });
  const scored = moves.map((m) => {
    let s = Math.random() * 2 * randomness;
    if (m.captured) s += VALUE[m.captured];
    if (m.san.includes("#")) s += 100;
    if (m.promotion) s += 6;
    // avoid hanging the moved piece to a simple recapture (roughly)
    const t = new Chess(g.fen());
    t.move(m);
    if (t.moves({ verbose: true }).some((r) => r.to === m.to)) s -= VALUE[m.piece] * 0.6;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].m;
}

export default function PlayComputer() {
  const [fen, setFen] = useState(new Chess().fen());
  const [history, setHistory] = useState<string[]>([]);
  const [sans, setSans] = useState<string[]>([]);
  const [color, setColor] = useState<"w" | "b">("w");
  const [level, setLevel] = useState(2);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [engineOk, setEngineOk] = useState<boolean | null>(null);
  const [flipped, setFlipped] = useState(false);
  const worker = useRef<Worker | null>(null);
  const pending = useRef<((uci: string | null) => void) | null>(null);
  const gameId = useRef(0);

  useEffect(() => {
    let w: Worker | null = null;
    try {
      w = new Worker(ENGINE_URL);
    } catch {
      queueMicrotask(() => setEngineOk(false));
      return;
    }
    worker.current = w;
    const timeout = window.setTimeout(() => setEngineOk((ok) => ok ?? false), 8000);
    w.onmessage = (e: MessageEvent) => {
      const line = String(e.data);
      if (line === "uciok") {
        setEngineOk(true);
        window.clearTimeout(timeout);
      }
      if (line.startsWith("bestmove")) {
        const uci = line.split(" ")[1];
        const cb = pending.current;
        pending.current = null;
        cb?.(uci && uci !== "(none)" ? uci : null);
      }
    };
    w.onerror = () => setEngineOk(false);
    w.postMessage("uci");
    return () => {
      window.clearTimeout(timeout);
      w?.terminate();
      worker.current = null;
    };
  }, []);

  const engineMove = useCallback(
    (f: string, lv: Level): Promise<string | null> =>
      new Promise((resolve) => {
        const w = worker.current;
        if (!w || !engineOk) return resolve(null);
        pending.current = resolve;
        w.postMessage("ucinewgame");
        w.postMessage(`setoption name Skill Level value ${lv.skill}`);
        w.postMessage(`position fen ${f}`);
        w.postMessage(lv.movetime ? `go movetime ${lv.movetime}` : `go depth ${lv.depth ?? 4}`);
      }),
    [engineOk],
  );

  const game = new Chess(fen);
  const over = game.isGameOver();
  const myTurn = !over && !thinking && game.turn() === color;

  const computerTurn = useCallback(
    async (f: string) => {
      const id = gameId.current;
      const g = new Chess(f);
      if (g.isGameOver()) return;
      setThinking(true);
      const lv = CPU_LEVELS.find((l) => l.id === level) ?? CPU_LEVELS[1];
      const started = Date.now();
      let uci: string | null = null;
      if (!lv.random) uci = await engineMove(f, lv);
      let mv: Move;
      try {
        mv = uci ? g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }) : g.move(simpleMove(g, lv.random ? 2.5 : 0.3));
      } catch {
        mv = g.move(simpleMove(g, 0.3));
      }
      const wait = Math.max(0, 450 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (id !== gameId.current) return;
      moveSound(mv.san, !!mv.captured);
      setFen(g.fen());
      setHistory((h) => [...h, f]);
      setSans((s) => [...s, mv.san]);
      setLastMove({ from: mv.from, to: mv.to });
      setThinking(false);
      if (g.isCheckmate()) sounds.wrong();
    },
    [engineMove, level],
  );

  function onMove(m: MoveInput) {
    if (!myTurn) return false;
    const g = new Chess(fen);
    let mv: Move;
    try {
      mv = g.move(m);
    } catch {
      return false;
    }
    moveSound(mv.san, !!mv.captured);
    setHistory((h) => [...h, fen]);
    setSans((s) => [...s, mv.san]);
    setFen(g.fen());
    setLastMove({ from: mv.from, to: mv.to });
    if (g.isCheckmate()) sounds.solved();
    else void computerTurn(g.fen());
    return true;
  }

  function newGame(c: "w" | "b" | "random" = color) {
    gameId.current++;
    pending.current = null;
    worker.current?.postMessage("stop");
    const col = c === "random" ? (Math.random() < 0.5 ? "w" : "b") : c;
    const start = new Chess().fen();
    setColor(col);
    setFlipped(false);
    setFen(start);
    setHistory([]);
    setSans([]);
    setLastMove(null);
    setThinking(false);
    if (col === "b") window.setTimeout(() => void computerTurn(start), 300);
  }

  function undo() {
    if (thinking || history.length === 0) return;
    // take back to the last position where it was the player's turn
    let h = [...history];
    let s = [...sans];
    let f = fen;
    do {
      f = h.pop()!;
      s.pop();
    } while (h.length && new Chess(f).turn() !== color);
    if (new Chess(f).turn() !== color) {
      h = [];
      s = [];
      f = new Chess().fen();
    }
    setHistory(h);
    setSans(s);
    setFen(f);
    setLastMove(null);
  }

  let result = "";
  if (game.isCheckmate()) result = game.turn() === color ? "Checkmate — the computer wins." : "Checkmate — you win! 🎉";
  else if (game.isStalemate()) result = "Stalemate — it’s a draw.";
  else if (game.isThreefoldRepetition()) result = "Draw by repetition.";
  else if (game.isInsufficientMaterial()) result = "Draw — not enough pieces to checkmate.";
  else if (game.isDraw()) result = "Draw (50-move rule).";

  const orientation = (color === "w") !== flipped ? "white" : "black";
  const lv = CPU_LEVELS.find((l) => l.id === level)!;

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[#e8962e14] px-5 py-3">
        <p className="font-semibold">♟️ Play vs Computer</p>
        <div className="flex gap-3 text-sm">
          <Link href="/games/chess-puzzles" className="text-[var(--brand-blue)] hover:underline">
            Chess puzzles
          </Link>
          <Link href="/games" className="text-[var(--brand-blue)] hover:underline">
            All games
          </Link>
        </div>
      </div>
      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full max-w-[min(640px,calc(100vh-220px))] min-w-[280px]">
          <Board fen={fen} orientation={orientation} playerColor={myTurn ? color : null} onMove={onMove} lastMove={lastMove} />
        </div>
        <aside className="space-y-4">
          <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${result ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-800"}`} aria-live="polite">
            {result || (thinking ? "Computer is thinking…" : game.inCheck() ? "Check! Your move." : myTurn ? "Your move." : "…")}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Computer level</p>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {CPU_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  title={l.name}
                  className={`rounded-xl px-1 py-2 text-center text-xs font-semibold transition ${
                    level === l.id ? "bg-[var(--brand-blue)] text-white" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <span className="block text-sm">{l.id}</span>
                  <span className={level === l.id ? "text-amber-300" : "text-amber-500"}>{"★".repeat(l.id)}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {lv.name}
              {engineOk === false && !lv.random ? " — engine unavailable, using a simpler computer" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => newGame("w")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)]">
              ♔ New game as White
            </button>
            <button type="button" onClick={() => newGame("b")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)]">
              ♚ As Black
            </button>
            <button type="button" onClick={() => newGame("random")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)]">
              🎲 Random
            </button>
            <button type="button" onClick={undo} disabled={thinking || !history.length} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)] disabled:opacity-40">
              ↶ Take back
            </button>
            <button type="button" onClick={() => setFlipped((f) => !f)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)]">
              ⇅ Flip board
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-[var(--border)] px-3 py-2 font-mono text-sm">
            {sans.length ? (
              <ol className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-2">
                {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => (
                  <li key={i} className="contents">
                    <span className="text-[var(--muted)]">{i + 1}.</span>
                    <span>{sans[i * 2]}</span>
                    <span>{sans[i * 2 + 1] ?? ""}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[var(--muted)]">Moves will appear here.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
