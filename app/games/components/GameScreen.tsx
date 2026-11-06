"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type GameDef } from "../catalog";
import { BANKS, type Question } from "../questions";
import { playMiss, playSuccess } from "../audio";
import { shuffleAt } from "../theory";
import { ChoiceGrid } from "./visuals";
import { PlayGame } from "../play";
import { Hud } from "./Hud";

const CHEERS = ["Sparkly!", "You nailed it!", "High five!", "On fire!", "Composer energy!", "Yes!"];
const NUDGES = ["Almost!", "So close!", "Shake it off!", "Next one is yours!", "Good try!"];

type Board = {
  allTime: { name: string; score: number; at: number }[];
  week: { name: string; score: number; at: number }[];
  persistent: boolean;
  storage: string;
};

export function GameScreen({ game }: { game: GameDef }) {
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [score, setScore] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    const res = await fetch("/api/games/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: game.slug }),
    });
    const data = (await res.json()) as { token?: string; error?: string };
    if (!res.ok || !data.token) {
      setError(data.error || "Could not start the game.");
      return;
    }
    setToken(data.token);
    setScore(0);
    setPhase("play");
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4" style={{ background: `${game.accent}14` }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{game.minutes}</p>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {game.title}
          </h2>
        </div>
        <Link href="/games" className="text-sm text-[var(--brand-blue)] hover:underline">
          All games
        </Link>
      </div>

      <div className="p-5 sm:p-8">
        {phase === "ready" ? (
          <div className="mx-auto max-w-lg text-center">
            <p className="text-[var(--muted)] leading-relaxed">{game.blurb}</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Scores can land on the global leaderboard. Pick a friendly nickname at the end (no email).
            </p>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            <button
              type="button"
              onClick={start}
              className="mt-6 rounded-full px-8 py-3 text-sm font-semibold text-white shadow"
              style={{ background: game.accent }}
            >
              Play
            </button>
          </div>
        ) : null}

        {phase === "play" ? (
          game.kind === "quiz" ? (
            <QuizPlay bank={game.quizBank || "music"} onFinish={(value) => { setScore(value); setPhase("done"); }} />
          ) : (
            <PlayGame game={game} onFinish={(value) => { setScore(value); setPhase("done"); }} />
          )
        ) : null}

        {phase === "done" ? (
          <EndScreen game={game} score={score} token={token} onReplay={start} />
        ) : null}
      </div>
    </div>
  );
}

function QuizPlay({ bank, onFinish }: { bank: string; onFinish: (score: number) => void }) {
  const questions = useMemo(() => shuffleAt(BANKS[bank] || BANKS.music, bank.length + 42).slice(0, 10), [bank]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [seconds, setSeconds] = useState(15);
  const [feedback, setFeedback] = useState("");
  const [powers, setPowers] = useState({ fifty: true, time: true, skip: true });
  const q = questions[index] as Question | undefined;

  useEffect(() => {
    if (!q || picked !== null) return;
    if (seconds <= 0) {
      const id = window.setTimeout(() => {
        setPicked(-1);
        setStreak(0);
        setFeedback(NUDGES[index % NUDGES.length]);
        playMiss();
      }, 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [seconds, picked, q, index]);

  function next(afterScore: number) {
    if (index + 1 >= questions.length) {
      onFinish(Math.min(5000, afterScore));
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setHidden([]);
    setSeconds(15);
    setFeedback("");
  }

  function choose(i: number) {
    if (!q || picked !== null) return;
    setPicked(i);
    const correct = i === q.answer;
    if (correct) {
      const speed = seconds >= 10 ? 40 : seconds >= 6 ? 20 : 0;
      const bonus = streak * 15;
      const gained = 100 + speed + bonus;
      const nextScore = score + gained;
      setScore(nextScore);
      setStreak((s) => s + 1);
      setFeedback(`${CHEERS[index % CHEERS.length]} +${gained}`);
      playSuccess();
      window.setTimeout(() => next(nextScore), 850);
    } else {
      setStreak(0);
      setFeedback(NUDGES[index % NUDGES.length]);
      playMiss();
      window.setTimeout(() => next(score), 850);
    }
  }

  if (!q) return null;

  const visible = q.choices.map((choice, i) => ({ choice, i })).filter((row) => !hidden.includes(row.i));

  return (
    <div>
      <Hud score={score} streak={streak} label={`${index + 1} / ${questions.length}`} extra={`${seconds}s`} />
      <p className="mt-5 text-lg font-semibold leading-snug">{q.q}</p>
      <div className="mt-4">
        <ChoiceGrid
          choices={visible.map((row) => row.choice)}
          picked={picked === null ? null : visible.findIndex((row) => row.i === picked)}
          answer={visible.findIndex((row) => row.i === q.answer)}
          reveal={picked !== null}
          disabled={picked !== null}
          onPick={(visibleIndex) => choose(visible[visibleIndex].i)}
        />
      </div>
      <p className="mt-3 min-h-6 text-sm font-medium text-[var(--brand-orange)]">{feedback}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Power
          label="50 / 50"
          unused={powers.fifty}
          onClick={() => {
            if (!powers.fifty || picked !== null) return;
            const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
            setHidden(shuffleAt(wrong, index + 9).slice(0, 2));
            setPowers((p) => ({ ...p, fifty: false }));
          }}
        />
        <Power
          label="+8 seconds"
          unused={powers.time}
          onClick={() => {
            if (!powers.time || picked !== null) return;
            setSeconds((s) => s + 8);
            setPowers((p) => ({ ...p, time: false }));
          }}
        />
        <Power
          label="Skip"
          unused={powers.skip}
          onClick={() => {
            if (!powers.skip || picked !== null) return;
            setPowers((p) => ({ ...p, skip: false }));
            next(score);
          }}
        />
      </div>
    </div>
  );
}

function Power({ label, unused, onClick }: { label: string; unused: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={!unused}
      onClick={onClick}
      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function EndScreen({
  game,
  score,
  token,
  onReplay,
}: {
  game: GameDef;
  score: number;
  token: string | null;
  onReplay: () => void;
}) {
  const storageKey = `uniedd-games-pb:${game.slug}`;
  const nameKey = "uniedd-games-nickname";
  const [nickname, setNickname] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(nameKey) || ""; } catch { return ""; }
  });
  const [best] = useState(() => {
    if (typeof window === "undefined") return score;
    try {
      const stored = Number(localStorage.getItem(storageKey) || 0);
      const next = Math.max(stored, score);
      localStorage.setItem(storageKey, String(next));
      return next;
    } catch {
      return score;
    }
  });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    void loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.slug]);

  async function loadBoard() {
    const res = await fetch(`/api/games/leaderboard?game=${game.slug}`, { cache: "no-store" });
    if (res.ok) setBoard((await res.json()) as Board);
  }

  async function submit() {
    if (!token) return;
    setSaving(true);
    setStatus("");
    try {
      localStorage.setItem(nameKey, nickname);
    } catch {
      /* ignore */
    }
    const res = await fetch("/api/games/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, nickname, score }),
    });
    const data = (await res.json()) as { error?: string; persistent?: boolean; note?: string };
    setSaving(false);
    if (!res.ok) {
      setStatus(data.error || "Could not save that score.");
      return;
    }
    setStatus(data.persistent ? "Saved to the global board!" : data.note || "Saved on this server for now.");
    void loadBoard();
  }

  return (
    <div>
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Your score</p>
        <p className="text-5xl font-bold" style={{ color: game.accent }}>
          {score}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">Personal best on this device: {best}</p>
      </div>

      <form
        className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          minLength={3}
          maxLength={16}
          placeholder="Nickname (3–16 letters)"
          className="flex-1 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: game.accent }}
        >
          {saving ? "Saving…" : "Post score"}
        </button>
      </form>
      {status ? <p className="mt-2 text-center text-sm text-[var(--muted)]">{status}</p> : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <BoardList title="Top 10 all-time" rows={board?.allTime || []} />
        <BoardList title="This week" rows={board?.week || []} />
      </div>
      {board && !board.persistent ? (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          Global scores are running in temporary memory until Redis or the Supabase game_scores table is enabled.
        </p>
      ) : null}

      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={onReplay} className="rounded-full border border-[var(--border)] px-5 py-2 text-sm">
          Play again
        </button>
        <Link href="/games" className="rounded-full px-5 py-2 text-sm text-white" style={{ background: game.accent }}>
          More games
        </Link>
      </div>
    </div>
  );
}

function BoardList({ title, rows }: { title: string; rows: { name: string; score: number }[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4">
      <h3 className="font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No scores yet — be the first!</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {rows.map((row, i) => (
            <li key={`${row.name}-${i}`} className="flex items-center justify-between gap-3">
              <span>
                <span className="mr-2 text-xs text-[var(--muted)]">{i + 1}.</span>
                {row.name}
              </span>
              <strong>{row.score}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
