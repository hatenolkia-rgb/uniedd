"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { Board, type MoveInput } from "./Board";
import { moveSound, sounds } from "./sound";
import {
  CLAIM_WIN_MS,
  ROOM_CODE,
  colorOf,
  planRoomAction,
  type Role,
  type RoomInput,
  type RoomKind,
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

const API = "/api/games/chess";
const NAME_KEY = "uniedd-chess-online-name";
const SESSION_KEY = "uniedd-chess-online-game";

type Session = { gameId: string; color: Color; secret: string; room?: boolean };
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
  const [roomCode, setRoomCode] = useState(() => (new URLSearchParams(window.location.search).get("room") ?? "").toUpperCase().slice(0, 6));
  const [tab, setTab] = useState<"public" | "private">(() => (new URLSearchParams(window.location.search).get("room") ? "private" : "public"));

  async function privateRoom(action: "room-create" | "room-join") {
    const clean = normalizeNickname(name);
    const err = nicknameError(clean);
    if (err) return setError(err);
    const code = roomCode.trim().toUpperCase();
    if (action === "room-join" && !ROOM_CODE.test(code)) return setError("Room codes are 6 letters and numbers, like K7M2QX.");
    setError("");
    setBusy(true);
    writeStorage("localStorage", NAME_KEY, clean);
    const secret = randomSecret();
    const { data } = await call<{ state?: string; gameId?: string; role?: Role }>({ action, secret, name: clean, code });
    setBusy(false);
    if (data.state !== "joined" || !data.gameId) return setError(data.error || "Couldn't open the room.");
    const s: Session = { gameId: data.gameId, color: data.role === "teacher" ? "w" : "b", secret, room: true };
    writeStorage("sessionStorage", SESSION_KEY, JSON.stringify(s));
    setSession(s);
    sounds.correct();
  }

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
        <>
          {waiting ? null : (
            <div className="mx-auto flex max-w-md justify-center gap-2 px-5 pt-5" role="tablist" aria-label="How to play">
              {(
                [
                  ["public", "🌐 Play anyone"],
                  ["private", "🎓 Private lobby"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => {
                    setTab(id);
                    setError("");
                  }}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    tab === id ? "bg-[var(--brand-blue)] text-white shadow" : "bg-white ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {tab === "public" || waiting ? (
            <Lobby name={name} setName={setName} waiting={waiting} busy={busy} error={error} onFind={findOpponent} onCancel={cancel} />
          ) : (
            <PrivateLobby
              name={name}
              setName={setName}
              code={roomCode}
              setCode={setRoomCode}
              busy={busy}
              error={error}
              onCreate={() => void privateRoom("room-create")}
              onJoin={() => void privateRoom("room-join")}
            />
          )}
        </>
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

function PrivateLobby({
  name,
  setName,
  code,
  setCode,
  busy,
  error,
  onCreate,
  onJoin,
}: {
  name: string;
  setName: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  error: string;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const input = "mt-1.5 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--brand-blue)]";
  const label = "block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";
  return (
    <div className="mx-auto max-w-md p-5 sm:p-8">
      <p className="text-lg font-semibold">Private lobby</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        For lessons: a teacher creates a room and shares the code or link, and the student joins with it. Private rooms are never matched with strangers.
      </p>
      <label htmlFor="chess-room-name" className={`mt-5 ${label}`}>
        Your display name
      </label>
      <input id="chess-room-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} autoComplete="nickname" placeholder="e.g. Coach Priya" className={input} />
      {error ? (
        <p className="mt-2 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="font-semibold">I&apos;m the teacher</p>
          <p className="mt-1 text-xs text-[var(--muted)]">You get a room code and teacher controls: take-backs, reset, colours and demo mode.</p>
          <button
            type="button"
            disabled={busy}
            onClick={onCreate}
            className="mt-3 w-full rounded-full bg-[var(--brand-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
          >
            Create private lobby
          </button>
        </div>
        <form
          className="rounded-2xl bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            onJoin();
          }}
        >
          <p className="font-semibold">I&apos;m the student</p>
          <label htmlFor="chess-room-code" className={`mt-2 ${label}`}>
            Room code
          </label>
          <input
            id="chess-room-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="K7M2QX"
            autoCapitalize="characters"
            autoComplete="off"
            className={`${input} font-mono tracking-widest`}
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)] disabled:opacity-50"
          >
            Join room
          </button>
        </form>
      </div>
    </div>
  );
}

type StateReply = {
  game?: OnlineGame;
  color?: Color;
  opponentIdleMs?: number;
  realtime?: Realtime;
  role?: Role;
  code?: string;
  studentJoined?: boolean;
};

const btn = "rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] hover:ring-[var(--brand-blue)] disabled:opacity-40";

function OnlineGameView({ session, onExit }: { session: Session; onExit: () => void }) {
  const { gameId, secret } = session;
  const isRoom = !!session.room;
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [seatColor, setSeatColor] = useState<Color>(session.color);
  const [role, setRole] = useState<Role | null>(null);
  const [code, setCode] = useState("");
  const [studentJoined, setStudentJoined] = useState(true);
  const [idle, setIdle] = useState(0);
  const [realtime, setRealtime] = useState<Realtime>(null);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState("");
  const [gone, setGone] = useState("");
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const seenPly = useRef<number | null>(null);

  const accept = useCallback((data: StateReply, force = false) => {
    const g = data.game;
    if (g) setGame((prev) => (force ? g : newerGame(prev, g)));
    if (typeof data.opponentIdleMs === "number") setIdle(data.opponentIdleMs);
    if (data.color === "w" || data.color === "b") setSeatColor(data.color);
    if (data.role === "teacher" || data.role === "student") setRole(data.role);
    if (typeof data.code === "string") setCode(data.code);
    if (typeof data.studentJoined === "boolean") setStudentJoined(data.studentJoined);
    const rt = data.realtime;
    if (rt !== undefined) setRealtime((prev) => (prev?.url === rt?.url && prev?.anonKey === rt?.anonKey ? prev : rt));
  }, []);

  const refresh = useCallback(async () => {
    const { status, data } = await call<StateReply>({ action: "state", gameId, secret, room: isRoom });
    if (status === 403 || status === 404) setGone(data.error || "This game is no longer available.");
    else if (status === 200) {
      accept(data);
      setNotice((n) => (n.startsWith("Your move didn't") || n.startsWith("You seem") ? "" : n));
    } else if (data.error) setNotice(data.error);
  }, [gameId, secret, isRoom, accept]);

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

  // Supabase Realtime: instant updates when the server shares its public settings.
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

  // In a private room colours can be swapped, so read them from the game.
  const color: Color = isRoom && role && game?.teacherColor ? colorOf(game, role) : seatColor;
  const isTeacher = isRoom && role === "teacher";

  // Sound when the other side moves.
  useEffect(() => {
    if (!game) return;
    const prev = seenPly.current;
    seenPly.current = game.ply;
    if (prev === null || game.ply === prev) return;
    if (game.ply < prev) return sounds.move();
    const moverColor: Color = (game.ply - 1) % 2 === 0 ? "w" : "b";
    if (moverColor !== color) {
      const sans = sanList(game.moves);
      const san = sans[sans.length - 1] ?? "";
      moveSound(san, san.includes("x"));
    }
  }, [game, color]);

  const ended = game ? game.status !== "active" && game.status !== "waiting" : false;
  const lost = !!game && ((game.result === "1-0" && color === "b") || (game.result === "0-1" && color === "w"));
  useEffect(() => {
    if (ended) (lost ? sounds.wrong : sounds.solved)();
  }, [ended, lost]);

  const sans = useMemo(() => (game ? sanList(game.moves) : []), [game]);

  if (gone) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="font-semibold">{gone}</p>
        <button type="button" onClick={onExit} className="mt-5 rounded-full bg-[var(--brand-blue)] px-6 py-2.5 font-semibold text-white">
          Back to the lobby
        </button>
      </div>
    );
  }

  if (!game || (isRoom && !role)) {
    return <div className="flex aspect-square max-h-[480px] w-full items-center justify-center text-[var(--muted)]">{notice || "Loading the game…"}</div>;
  }

  const waitingRoom = game.status === "waiting";
  const turn: Color = game.ply % 2 === 0 ? "w" : "b";
  const demo = isTeacher && game.demoMode;
  const movable: Color | null = ended || waitingRoom || sending ? null : demo ? turn : turn === color ? color : null;
  const myTurn = movable !== null;
  const myName = color === "w" ? game.whiteName : game.blackName;
  const oppName = color === "w" ? game.blackName : game.whiteName;
  const inCheck = !ended && /[+#]$/.test(sans[sans.length - 1] ?? "");
  const oppAway = !ended && !waitingRoom && idle >= DISCONNECT_NOTICE_MS;
  const canClaim = !isRoom && !ended && idle >= CLAIM_WIN_MS;
  const shareLink = code ? `${window.location.origin}/games/chess-online?room=${code}` : "";

  function onMove(m: MoveInput) {
    if (!game || !myTurn) return false;
    const before = game;
    let next: OnlineGame;
    let san: string;
    let captured: boolean;
    if (isRoom && role) {
      const plan = planRoomAction(game, role, "move", m, studentJoined);
      if (!plan.ok) return false;
      next = plan.game;
      san = plan.san ?? "";
      captured = !!plan.captured;
    } else {
      const check = checkMove(game.moves, color, m, game.status);
      if (!check.ok) return false;
      san = check.san;
      captured = check.captured;
      next = {
        ...game,
        moves: [...game.moves, check.uci],
        fen: check.fen,
        ply: game.ply + 1,
        version: game.version + 1,
        lastMove: { from: check.from, to: check.to },
        status: check.status,
        result: check.result,
        reason: check.reason,
      };
    }
    moveSound(san, captured);
    setGame(next);
    setSending(true);
    const body = isRoom
      ? { action: "room", kind: "move", room: true, version: before.version, gameId, secret, from: m.from, to: m.to, promotion: m.promotion }
      : { action: "move", gameId, secret, ply: before.ply, from: m.from, to: m.to, promotion: m.promotion };
    void call<StateReply>(body).then(({ status, data }) => {
      setSending(false);
      if (status === 200) accept(data, true);
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

  async function roomAction(kind: RoomKind, input: RoomInput = {}) {
    if (!game) return;
    setConfirmReset(false);
    setConfirmResign(false);
    const { status, data } = await call<StateReply>({ action: "room", room: true, kind, version: game.version, gameId, secret, ...input });
    if (data.game) accept(data, true);
    setNotice(status === 200 ? "" : data.error || "That didn't work. Try again.");
  }

  async function endGame(kind: "resign" | "claim") {
    setConfirmResign(false);
    if (isRoom) return roomAction("resign");
    const { data } = await call<StateReply>({ action: kind, gameId, secret });
    if (data.game) accept(data, true);
    if (data.error) setNotice(data.error);
  }

  let status: string;
  if (waitingRoom) status = isTeacher ? "Waiting for your student to join…" : "Waiting for the teacher…";
  else if (ended) status = resultText(game, color);
  else if (demo) status = `Demo mode — move either side. ${turn === "w" ? "White" : "Black"} to move.`;
  else if (turn === color) status = inCheck ? "Check! Your move." : "Your move.";
  else status = inCheck ? `Check! ${oppName} to move…` : `${oppName} is thinking…`;

  const player = (who: "me" | "opp") => {
    const c: Color = who === "me" ? color : color === "w" ? "b" : "w";
    const active = !ended && !waitingRoom && turn === c;
    const tag = isRoom && game.teacherColor ? (c === game.teacherColor ? " · teacher" : " · student") : "";
    return (
      <div className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm ${active ? "bg-[#0f766e14] ring-2 ring-teal-600/40" : "bg-slate-50"}`}>
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <span aria-hidden className={`inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-slate-400 ${c === "w" ? "bg-white" : "bg-slate-900"}`} />
          <span className="truncate">
            {who === "me" ? `${myName} (you)` : waitingRoom ? "Waiting for student…" : oppName}
            <span className="font-normal text-[var(--muted)]">{tag}</span>
          </span>
        </span>
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {who === "opp" && oppAway ? "disconnected?" : active ? "to move" : c === "w" ? "White" : "Black"}
        </span>
      </div>
    );
  };

  const statusClass = ended ? "bg-amber-50 text-amber-900" : myTurn ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-800";
  const orientation = (color === "w") !== flipped ? "white" : "black";
  const studentName = game.studentName ?? "Your student";

  return (
    <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto w-full max-w-[min(640px,calc(100vh-260px))] min-w-[280px] space-y-2">
        <p className={`rounded-xl px-3 py-1.5 text-center text-sm font-semibold lg:hidden ${myTurn || ended ? statusClass : "text-[var(--muted)]"}`}>{status}</p>
        {player(flipped ? "me" : "opp")}
        <Board fen={game.fen} orientation={orientation} playerColor={movable} onMove={onMove} lastMove={game.lastMove} />
        {player(flipped ? "opp" : "me")}
      </div>
      <aside className="space-y-4">
        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${statusClass}`} aria-live="polite" data-testid="chess-online-status">
          {status}
        </div>

        {isTeacher && code ? (
          <div className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Room code</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em]" data-testid="room-code">
              {code}
            </p>
            <p className="mt-1 break-all text-xs text-[var(--muted)]">{shareLink}</p>
            <button
              type="button"
              className={`${btn} mt-2`}
              onClick={() => {
                void navigator.clipboard?.writeText(shareLink).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "✓ Copied" : "Copy invite link"}
            </button>
          </div>
        ) : null}

        {isTeacher && game.takebackRequest ? (
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status" data-testid="takeback-request">
            <p className="font-semibold">{studentName} asks to take back their last move.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void roomAction("approve")} className="rounded-full bg-sky-700 px-4 py-1.5 text-sm font-semibold text-white">
                ✓ Approve take-back
              </button>
              <button type="button" onClick={() => void roomAction("decline")} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold ring-1 ring-sky-300">
                Decline
              </button>
            </div>
          </div>
        ) : null}

        {oppAway ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            <p className="font-semibold">{oppName} seems to have disconnected.</p>
            <p className="mt-1">
              {isRoom
                ? "They can come back with the same link or code."
                : canClaim
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

        {isTeacher ? (
          <div className="space-y-3 rounded-2xl border border-[var(--border)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Teacher controls</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} disabled={!game.moves.length || waitingRoom} onClick={() => void roomAction("undo")}>
                ↶ Take back last move
              </button>
              {confirmReset ? (
                <>
                  <button type="button" className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => void roomAction("reset")}>
                    Yes, reset
                  </button>
                  <button type="button" className={btn} onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className={btn} onClick={() => setConfirmReset(true)}>
                  ⟲ Reset board
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--brand-blue)]"
                checked={game.allowTakebacks}
                onChange={(e) => void roomAction("set_takebacks", { flag: e.target.checked })}
                data-testid="allow-takebacks"
              />
              Allow student take-backs
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--brand-blue)]"
                checked={game.demoMode}
                onChange={(e) => void roomAction("set_demo", { flag: e.target.checked })}
                data-testid="demo-mode"
              />
              Demo mode (I move both sides)
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">I play</span>
              {(["w", "b"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => game.teacherColor !== c && void roomAction("set_teacher_color", { teacherColor: c })}
                  className={`rounded-full px-3 py-1.5 font-semibold ${game.teacherColor === c ? "bg-[var(--brand-blue)] text-white" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  {c === "w" ? "♔ White" : "♚ Black"}
                </button>
              ))}
              <button type="button" className={btn} onClick={() => void roomAction("set_teacher_color", { teacherColor: game.teacherColor === "b" ? "w" : "b" })}>
                ⇄ Swap colours
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {isRoom && role === "student" && !waitingRoom ? (
            game.allowTakebacks ? (
              <button type="button" className={btn} disabled={!sans.length} onClick={() => void roomAction("takeback")}>
                ↶ Take back my move
              </button>
            ) : game.takebackRequest ? (
              <button type="button" className={btn} disabled>
                Take-back requested…
              </button>
            ) : (
              <button type="button" className={btn} disabled={!sans.length} onClick={() => void roomAction("request")}>
                ↶ Ask to take back
              </button>
            )
          ) : null}
          {isRoom ? (
            <button type="button" className={btn} onClick={() => setFlipped((f) => !f)}>
              ⇅ Flip board
            </button>
          ) : null}
          {ended && !isRoom ? (
            <button type="button" onClick={onExit} className="rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90">
              ↻ Play again
            </button>
          ) : ended || waitingRoom ? null : confirmResign ? (
            <>
              <button type="button" onClick={() => void endGame("resign")} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                Yes, resign
              </button>
              <button type="button" onClick={() => setConfirmResign(false)} className={btn}>
                Keep playing
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmResign(true)} className={`${btn} hover:ring-rose-400`}>
              🏳 Resign
            </button>
          )}
          {isRoom ? (
            <button type="button" className={btn} onClick={onExit}>
              Leave room
            </button>
          ) : null}
        </div>
        {isRoom && ended && role === "student" ? <p className="text-xs text-[var(--muted)]">Your teacher can take moves back or reset the board for another game.</p> : null}

        <div className="max-h-56 overflow-y-auto rounded-2xl border border-[var(--border)] px-3 py-2 font-mono text-sm" data-testid="move-list">
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
        <p className="text-xs text-[var(--muted)]">
          {live ? "● Live" : "Connected"} · {isRoom ? `Private room${code ? ` ${code}` : ""}` : `Game ${gameId.slice(0, 8)}`}
        </p>
      </aside>
    </div>
  );
}
