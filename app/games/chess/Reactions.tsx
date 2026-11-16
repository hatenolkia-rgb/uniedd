"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REACTIONS, REACTION_COOLDOWN_MS, reactionEmoji, reactionLabel, takeNewReactions, type ReactionId, type Reactions, type Side } from "./reactions";

type Float = { key: string; emoji: string; label: string; mine: boolean; x: number };

/**
 * Floating emoji over the board. The opponent's reactions come from the game
 * state (Realtime / polling); our own are shown straight away by `spawnMine`.
 */
export function useFloatingReactions(loaded: boolean, reactions: Reactions | undefined, me: Side, opponentName: string) {
  const seen = useRef<Set<string> | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const timers = useRef<number[]>([]);

  const spawn = useCallback((f: Omit<Float, "key" | "x">) => {
    const key = `${Date.now()}-${Math.random()}`;
    const x = 20 + Math.random() * 60;
    setFloats((list) => [...list.slice(-5), { ...f, key, x }]);
    timers.current.push(window.setTimeout(() => setFloats((list) => list.filter((it) => it.key !== key)), 2700));
  }, []);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null) {
      // Don't replay reactions that were sent before this page loaded.
      seen.current = new Set();
      takeNewReactions(reactions, seen.current);
      return;
    }
    for (const { side, reaction } of takeNewReactions(reactions, seen.current)) {
      if (side === me) continue; // already shown when we tapped it
      spawn({ emoji: reactionEmoji(reaction.e), label: opponentName, mine: false });
    }
  }, [loaded, reactions, me, opponentName, spawn]);

  const spawnMine = useCallback((e: ReactionId) => spawn({ emoji: reactionEmoji(e), label: "You", mine: true }), [spawn]);

  const overlay = (
    <div aria-live="polite" className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl" data-testid="chess-reaction-overlay">
      {floats.map((f) => (
        <span key={f.key} className="ct-float" style={{ left: `${f.x}%`, top: f.mine ? "62%" : "22%" }} role="img" aria-label={`${f.label}: ${f.emoji}`}>
          {f.emoji}
          <span className="ct-float-label">{f.label}</span>
        </span>
      ))}
    </div>
  );

  return { overlay, spawnMine };
}

/** Row of allowlisted emoji buttons. */
export function ReactionBar({ onReact }: { onReact: (e: ReactionId) => Promise<string | null> }) {
  const [cooling, setCooling] = useState(false);
  const [msg, setMsg] = useState("");

  async function tap(e: ReactionId) {
    if (cooling) return;
    setCooling(true);
    setMsg("");
    window.setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS);
    const err = await onReact(e);
    if (err) setMsg(err);
  }

  return (
    <div data-testid="chess-reactions">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Send a reaction</p>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5">
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            title={r.label}
            aria-label={`Send ${reactionLabel(r.id)} ${r.emoji}`}
            data-reaction={r.id}
            disabled={cooling}
            onClick={() => void tap(r.id)}
            className="rounded-xl bg-slate-50 py-1.5 text-2xl transition hover:scale-110 hover:bg-amber-50 active:scale-95 disabled:opacity-50"
          >
            {r.emoji}
          </button>
        ))}
      </div>
      {msg ? <p className="mt-1 text-xs text-[var(--muted)]">{msg}</p> : null}
    </div>
  );
}
