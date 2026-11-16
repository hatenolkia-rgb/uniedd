"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { Board, type MoveInput } from "./Board";
import { moveSound, sounds } from "./sound";
import {
  CLAIM_WIN_MS,
  DISCONNECT_NOTICE_MS,
  GAME_HEARTBEAT_MS,
  GAME_POLL_MS,
  LOBBY_POLL_MS,
  checkMove,
  newerGame,
  resultText,
  rowToGame,
  sanList,
  type Color,
  type OnlineGame,
} from "./online";
import { nicknameError, normalizeNickname } from "../../lib/games/nickname";
import { ReactionBar, useFloatingReactions } from "./Reactions";
import type { ReactionId } from "./reactions";

const API = "/api/games/chess";
const NAME_KEY = "uniedd-chess-online-name";
const SESSION_KEY = "uniedd-chess-online-game";

type Session = { gameId: string; color: Color; secret: string };
type Ticket = { ticket: string; secret: string };
type Realtime = { url: string; anonKey: string } | null;

function randomSecret() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

function readStorage(area: "localStorage" | "sessionStorage", key: string) {
  try {
    return window[area].getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(area: "localStorage" | "sessionStorage", key: string, value: string | null) {
  try {
    if (value === null) window[area].removeItem(key);
    else window[area].setItem(key, value);
  } catch {
    // storage blocked: the game still works for this page view
  }
}

function loadSession(): Session | null {
  const raw = readStorage("sessionStorage", SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    return s.gameId && s.secret && (s.color === "w" || s.color === "b") ? s : null;
  } catch {
    return null;
  }
}

async function call<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<{ status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { status: res.status, data };
  } catch {
    return { status: 0, data: { error: "You seem to be offline. Retrying…" } as T & { error?: string } };
  }
}

// One browser client per page, reused across games (avoids duplicate auth clients).
let rtClient: { key: string; client: Promise<SupabaseClient> } | null = null;
function realtimeClient(cfg: { url: string; anonKey: string }) {
  const key = `${cfg.url}|${cfg.anonKey}`;
  if (rtClient?.key !== key) {
    rtClient = {
      key,
      client: import("@supabase/supabase-js").then(({ createClient }) =>
        createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
      ),
    };
  }
  return rtClient.client;
}

type MatchReply = { state?: "waiting" | "matched" | "cancelled" | "gone"; gameId?: string; color?: Color };

export default function PlayOnline() {
  const [name, setName] = useState(() => readStorage("localStorage", NAME_KEY) ?? "");
  const [session, setSession] = useState<Session | null>(loadSession);
  const [waiting, setWaiting] = useState<{ since: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ticket = useRef<Ticket | null>(null);

  const enterGame = useCallback((t: Ticket, gameId: string, color: Color) => {
    const s = { gameId, color, secret: t.secret };
    writeStorage("sessionStorage", SESSION_KEY, JSON.stringify(s));
    ticket.current = null;
    setWaiting(null);
    setSession(s);
    sounds.correct();
  }, []);

  const handleMatch = useCallback(
    (t: Ticket, status: number, data: MatchReply & { error?: string }) => {
      if (data.state === "matched" && data.gameId && data.color) {
        enterGame(t, data.gameId, data.color);
        return true;
      }
      if (status >= 400 && status !== 429) {
        ticket.current = null;
        setWaiting(null);
        setError(data.error || "Couldn't join the waiting room.");
        return true;
      }
      return false;
    },
    [enterGame],
  );

  async function findOpponent() {
    const clean = normalizeNickname(name);
    const err = nicknameError(clean);
    if (err) return setError(err);
    setError("");
    setBusy(true);
    writeStorage("localStorage", NAME_KEY, clean);
    const t = { ticket: crypto.randomUUID(), secret: randomSecret() };
    ticket.current = t;
    const { status, data } = await call<MatchReply>({ action: "find", ticket: t.ticket, secret: t.secret, name: clean });
    setBusy(false);
    if (ticket.current !== t) return;
    if (!handleMatch(t, status, data)) setWaiting({ since: Date.now() });
  }

  async function cancel() {
    const t = ticket.current;
    ticket.current = null;
    setWaiting(null);
    if (!t) return;
    const { data } = await call<MatchReply>({ action: "cancel", ticket: t.ticket, secret: t.secret });
    // Matched in the same instant: join the game rather than leave someone stranded.
    if (data.state === "matched" && data.gameId && data.color) enterGame(t, data.gameId, data.color);
  }

  // While waiting: re-check every couple of seconds (also keeps the ticket alive).
  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const id = window.setInterval(async () => {
      const t = ticket.current;
      if (!t || stop) return;
      const { status, data } = await call<MatchReply>({ action: "find", ticket: t.ticket, secret: t.secret, name: normalizeNickname(name) });
      if (!stop && ticket.current === t) handleMatch(t, status, data);
    }, LOBBY_POLL_MS);
    // Closing the tab leaves the queue straight away (the server also drops silent tickets).
    const leave = () => {
      const t = ticket.current;
      if (t) navigator.sendBeacon?.(API, JSON.stringify({ action: "cancel", ticket: t.ticket, secret: t.secret }));
    };
    window.addEventListener("pagehide", leave);
    return () => {
      stop = true;
      window.clearInterval(id);
      window.removeEventListener("pagehide", leave);
    };
  }, [waiting, name, handleMatch]);

  function backToLobby() {
    writeStorage("sessionStorage", SESSION_KEY, null);
    setSession(null);
    setError("");
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[#0f766e14] px-5 py-3">
        <p className="font-semibold">🌐 Play Online</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/games/chess" className="text-[var(--brand-blue)] hover:underline">
            Play vs computer
          </Link>
          <Link href="/games/chess-puzzles" className="text-[var(--brand-blue)] hover:underline">
            Chess puzzles
          </Link>
          <Link href="/games" className="text-[var(--brand-blue)] hover:underline">
            All games
          </Link>
        </div>
      </div>
      {session ? (
        <OnlineGameView key={session.gameId} session={session} onExit={backToLobby} />
      ) : (
        <Lobby name={name} setName={setName} waiting={waiting} busy={busy} error={error} onFind={findOpponent} onCancel={cancel} />
      )}
    </div>
  );
}

function Lobby({
  name,
  setName,
  waiting,
  busy,
  error,
  onFind,
  onCancel,
}: {
  name: string;
  setName: (v: string) => void;
  waiting: { since: number } | null;
  busy: boolean;
  error: string;
  onFind: () => void;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [waiting]);
  const secs = waiting ? Math.max(0, Math.floor((now - waiting.since) / 1000)) : 0;

  return (
    <div className="mx-auto max-w-md p-5 sm:p-8">
      {waiting ? (
        <div className="text-center" aria-live="polite">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--brand-blue)]" aria-hidden />
          <p className="mt-5 text-lg font-semibold">Waiting for a player…</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            You&apos;ll be matched with the next player who joins.{" "}
            {secs > 0 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : ""}
          </p>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Playing a friend? Ask them to open <span className="font-semibold">uniedd.com/games/chess-online</span> and press Find opponent now.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-rose-400"
          >
            Cancel
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onFind();
          }}
        >
          <p className="text-lg font-semibold">Online waiting room</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Pick a name, then we&apos;ll match you with the next available player. No sign-up needed.</p>
          <label htmlFor="chess-online-name" className="mt-5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Your display name
          </label>
          <input
            id="chess-online-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoComplete="nickname"
            placeholder="e.g. Knight_Rider"
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--brand-blue)]"
          />
          {error ? (
            <p className="mt-2 text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-full bg-[var(--brand-blue)] px-6 py-3 font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Joining…" : "Find opponent"}
          </button>
          <p className="mt-4 text-xs text-[var(--muted)]">Colours are picked at random. Be kind — your name is shown to your opponent.</p>
        </form>
      )}
    </div>
  );
}

type StateReply = { game?: OnlineGame; color?: Color; opponentIdleMs?: number; realtime?: Realtime };

function OnlineGameView({ session, onExit }: { session: Session; onExit: () => void }) {
  const { gameId, color, secret } = session;
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [idle, setIdle] = useState(0);
  const [realtime, setRealtime] = useState<Realtime>(null);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState("");
  const [gone, setGone] = useState("");
  const [confirmResign, setConfirmResign] = useState(false);
  const [sending, setSending] = useState(false);
  const seenPly = useRef<number | null>(null);

  const accept = useCallback((data: StateReply, force = false) => {
    const g = data.game;
    if (g) setGame((prev) => (force ? g : newerGame(prev, g)));
    if (typeof data.opponentIdleMs === "number") setIdle(data.opponentIdleMs);
    const rt = data.realtime;
    if (rt !== undefined) setRealtime((prev) => (prev?.url === rt?.url && prev?.anonKey === rt?.anonKey ? prev : rt));
  }, []);

  const refresh = useCallback(async () => {
    const { status, data } = await call<StateReply>({ action: "state", gameId, secret });
    if (status === 403 || status === 404) setGone(data.error || "This game is no longer available.");
    else if (status === 200) {
      accept(data);
      setNotice("");
    } else if (data.error) setNotice(data.error);
  }, [gameId, secret, accept]);

  // Heartbeat + fallback polling (fast when Realtime isn't connected).
  useEffect(() => {
    let stop = false;
    let timer = 0;
    const tick = async () => {
      await refresh();
      if (!stop) timer = window.setTimeout(tick, live ? GAME_HEARTBEAT_MS : GAME_POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [refresh, live]);

  // Supabase Realtime: instant move updates when the server shares its public settings.
  useEffect(() => {
    if (!realtime) return;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void realtimeClient(realtime).then((c) => {
      if (cancelled) return;
      client = c;
      channel = client
        .channel(`chess-game-${gameId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chess_games", filter: `id=eq.${gameId}` }, (payload) => {
          setGame((prev) => newerGame(prev, rowToGame(payload.new as Record<string, unknown>)));
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    });
    return () => {
      cancelled = true;
      setLive(false);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [realtime, gameId]);

  // Sound when the opponent moves or the game ends.
  useEffect(() => {
    if (!game) return;
    const prev = seenPly.current;
    seenPly.current = game.ply;
    if (prev === null || game.ply <= prev) return;
    const moverColor: Color = (game.ply - 1) % 2 === 0 ? "w" : "b";
    if (moverColor !== color) {
      const sans = sanList(game.moves);
      const san = sans[sans.length - 1] ?? "";
      moveSound(san, san.includes("x"));
    }
  }, [game, color]);

  const ended = game ? game.status !== "active" : false;
  const lost = !!game && ((game.result === "1-0" && color === "b") || (game.result === "0-1" && color === "w"));
  useEffect(() => {
    if (ended) (lost ? sounds.wrong : sounds.solved)();
  }, [ended, lost]);

  const sans = useMemo(() => (game ? sanList(game.moves) : []), [game]);

  const oppNameForReactions = game ? (color === "w" ? game.blackName : game.whiteName) : "";
  const { overlay: reactionOverlay, spawnMine } = useFloatingReactions(!!game, game?.reactions, color, oppNameForReactions);
  const react = useCallback(
    async (e: ReactionId) => {
      spawnMine(e);
      const { status, data } = await call<StateReply>({ action: "react", gameId, secret, emoji: e });
      if (data.game) accept(data);
      return status === 200 ? null : data.error || "Couldn't send that reaction.";
    },
    [gameId, secret, accept, spawnMine],
  );

  if (gone) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="font-semibold">{gone}</p>
        <button type="button" onClick={onExit} className="mt-5 rounded-full bg-[var(--brand-blue)] px-6 py-2.5 font-semibold text-white">
          Back to the waiting room
        </button>
      </div>
    );
  }

  if (!game) {
    return <div className="flex aspect-square max-h-[480px] w-full items-center justify-center text-[var(--muted)]">{notice || "Loading the game…"}</div>;
  }

  const turn: Color = game.ply % 2 === 0 ? "w" : "b";
  const myTurn = !ended && turn === color && !sending;
  const myName = color === "w" ? game.whiteName : game.blackName;
  const oppName = color === "w" ? game.blackName : game.whiteName;
  const inCheck = !ended && /[+#]$/.test(sans[sans.length - 1] ?? "");
  const oppAway = !ended && idle >= DISCONNECT_NOTICE_MS;
  const canClaim = !ended && idle >= CLAIM_WIN_MS;

  function onMove(m: MoveInput) {
    if (!game || !myTurn) return false;
    const check = checkMove(game.moves, color, m, game.status);
    if (!check.ok) return false;
    const before = game;
    moveSound(check.san, check.captured);
    setGame({
      ...game,
      moves: [...game.moves, check.uci],
      fen: check.fen,
      ply: game.ply + 1,
      lastMove: { from: check.from, to: check.to },
      status: check.status,
      result: check.result,
      reason: check.reason,
    });
    setSending(true);
    void call<StateReply>({ action: "move", gameId, secret, ply: before.ply, from: m.from, to: m.to, promotion: m.promotion }).then(({ status, data }) => {
      setSending(false);
      if (status === 200) accept(data);
      else if (data.game) {
        accept(data, true);
        setNotice(data.error || "");
      } else {
        // Network trouble: put the board back and let polling resync.
        setGame(before);
        setNotice(data.error || "Your move didn't go through. Try again.");
      }
    });
    return true;
  }

  async function endGame(kind: "resign" | "claim") {
    setConfirmResign(false);
    const { data } = await call<StateReply>({ action: kind, gameId, secret });
    if (data.game) accept(data, true);
    if (data.error) setNotice(data.error);
  }

  let status: string;
  if (ended) status = resultText(game, color);
  else if (myTurn || (turn === color && sending)) status = inCheck ? "Check! Your move." : "Your move.";
  else status = inCheck ? `Check! ${oppName} to move…` : `${oppName} is thinking…`;

  const player = (who: "me" | "opp") => {
    const c: Color = who === "me" ? color : color === "w" ? "b" : "w";
    const active = !ended && turn === c;
    return (
      <div className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm ${active ? "bg-[#0f766e14] ring-2 ring-teal-600/40" : "bg-slate-50"}`}>
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <span aria-hidden className={`inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-slate-400 ${c === "w" ? "bg-white" : "bg-slate-900"}`} />
          <span className="truncate">{who === "me" ? `${myName} (you)` : oppName}</span>
        </span>
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {who === "opp" && oppAway ? "disconnected?" : active ? "to move" : c === "w" ? "White" : "Black"}
        </span>
      </div>
    );
  };

  return (
    <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto w-full max-w-[min(640px,calc(100vh-260px))] min-w-[280px] space-y-2">
        <p className={`rounded-xl px-3 py-1.5 text-center text-sm font-semibold lg:hidden ${ended ? "bg-amber-50 text-amber-900" : myTurn ? "bg-emerald-50 text-emerald-900" : "text-[var(--muted)]"}`}>{status}</p>
        {player("opp")}
        <Board fen={game.fen} orientation={color === "w" ? "white" : "black"} playerColor={myTurn ? color : null} onMove={onMove} lastMove={game.lastMove} overlay={reactionOverlay} />
        {player("me")}
      </div>
      <aside className="space-y-4">
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${ended ? "bg-amber-50 text-amber-900" : myTurn ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-800"}`}
          aria-live="polite"
          data-testid="chess-online-status"
        >
          {status}
        </div>
        {oppAway ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            <p className="font-semibold">{oppName} seems to have disconnected.</p>
            <p className="mt-1">
              {canClaim
                ? "They haven't come back. You can claim the win or keep waiting."
                : `Waiting for them to come back… you can claim the win in ${Math.ceil((CLAIM_WIN_MS - idle) / 1000)} s.`}
            </p>
            {canClaim ? (
              <button type="button" onClick={() => void endGame("claim")} className="mt-2 rounded-full bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white">
                Claim the win
              </button>
            ) : null}
          </div>
        ) : null}
        {notice ? <p className="text-sm text-[var(--muted)]">{notice}</p> : null}
        <ReactionBar onReact={react} />
        <div className="flex flex-wrap gap-2">
          {ended ? (
            <button type="button" onClick={onExit} className="rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90">
              ↻ Play again
            </button>
          ) : confirmResign ? (
            <>
              <button type="button" onClick={() => void endGame("resign")} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                Yes, resign
              </button>
              <button type="button" onClick={() => setConfirmResign(false)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)]">
                Keep playing
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmResign(true)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-rose-400">
              🏳 Resign
            </button>
          )}
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
            <p className="text-[var(--muted)]">{color === "w" ? "You play White — make the first move." : "You play Black — White moves first."}</p>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">{live ? "● Live" : "Connected"} · Game {gameId.slice(0, 8)}</p>
      </aside>
    </div>
  );
}
