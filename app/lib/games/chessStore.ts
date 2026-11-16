// Storage for online multiplayer chess.
//
// Production uses the existing Supabase project (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY) and the tables/functions in
// supabase/chess_multiplayer.sql. Local development without Supabase falls
// back to an in-memory store with the same rules, so the feature can be tried
// with two browser tabs. The memory store is never used on Vercel because
// serverless instances don't share memory.
import { createHash } from "node:crypto";
import { getSupabase } from "../supabase";
import {
  CLAIM_WIN_MS,
  QUEUE_STALE_MS,
  START_FEN,
  applyRoomUpdate,
  rowToGame,
  type Color,
  type Role,
  type RoomUpdate,
  type GameResult,
  type GameStatus,
  type OnlineGame,
} from "../../games/chess/online";

export type MatchState = { state: "waiting" } | { state: "matched"; gameId: string; color: Color } | { state: "cancelled" } | { state: "gone" };
export type Seat = { color: Color; opponentIdleMs: number };
export type StoredMove = {
  uci: string;
  fen: string;
  lastMove: { from: string; to: string };
  status: GameStatus;
  result: GameResult;
  reason: string | null;
};

export type RoomSeat = { role: Role; color: Color; opponentIdleMs: number; code: string; studentJoined: boolean };
export type RoomJoin = { state: "joined"; gameId: string; role: Role } | { state: "full" } | { state: "missing" };

export interface ChessStore {
  kind: "supabase" | "memory";
  matchmake(ticket: string, name: string, secretHash: string): Promise<MatchState>;
  cancel(ticket: string, secretHash: string): Promise<MatchState>;
  /** Heartbeat for a seated player; null if the secret doesn't own a seat. */
  touch(gameId: string, secretHash: string): Promise<Seat | null>;
  getGame(gameId: string): Promise<OnlineGame | null>;
  applyMove(gameId: string, secretHash: string, expectedPly: number, move: StoredMove): Promise<boolean>;
  endGame(gameId: string, secretHash: string, kind: "resign" | "claim"): Promise<boolean>;
  // Private teacher rooms (supabase/chess_teacher_lobby.sql)
  createRoom(name: string, secretHash: string): Promise<{ gameId: string; code: string }>;
  joinRoom(code: string, name: string, secretHash: string): Promise<RoomJoin>;
  touchRoom(gameId: string, secretHash: string): Promise<RoomSeat | null>;
  updateRoom(gameId: string, secretHash: string, expectedVersion: number, update: RoomUpdate): Promise<boolean>;
}

export class ChessStoreError extends Error {
  constructor(
    message: string,
    public readonly code: "not-configured" | "missing-tables" | "forbidden" | "failed",
  ) {
    super(message);
  }
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(`uniedd-chess:${secret}`).digest("hex");
}

// ------------------------------------------------------------------ Supabase

function supabaseError(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "Unknown error";
  if (error?.code === "PGRST202" || error?.code === "42P01" || error?.code === "PGRST205" || /does not exist|could not find/i.test(msg)) {
    throw new ChessStoreError(
      /room/.test(msg)
        ? "Private lobbies aren't switched on yet. Run supabase/chess_teacher_lobby.sql in Supabase."
        : "Online chess tables are missing. Run supabase/chess_multiplayer.sql in Supabase.",
      "missing-tables",
    );
  }
  if (error?.code === "42501") throw new ChessStoreError("Not allowed.", "forbidden");
  throw new ChessStoreError(msg, "failed");
}

type MatchRow = { state: string; game_id: string | null; color: string | null };
function toMatch(row: MatchRow | undefined): MatchState {
  if (!row) return { state: "gone" };
  if (row.state === "matched" && row.game_id && (row.color === "w" || row.color === "b")) return { state: "matched", gameId: row.game_id, color: row.color };
  if (row.state === "waiting") return { state: "waiting" };
  if (row.state === "cancelled") return { state: "cancelled" };
  return { state: "gone" };
}

function supabaseStore(): ChessStore | null {
  const sb = getSupabase();
  if (!sb) return null;
  return {
    kind: "supabase",
    async matchmake(ticket, name, secretHash) {
      const { data, error } = await sb.rpc("chess_matchmake", { p_ticket: ticket, p_name: name, p_secret_hash: secretHash });
      if (error) supabaseError(error);
      return toMatch((data as MatchRow[] | null)?.[0]);
    },
    async cancel(ticket, secretHash) {
      const { data, error } = await sb.rpc("chess_cancel", { p_ticket: ticket, p_secret_hash: secretHash });
      if (error) supabaseError(error);
      return toMatch((data as MatchRow[] | null)?.[0]);
    },
    async touch(gameId, secretHash) {
      const { data, error } = await sb.rpc("chess_touch", { p_game: gameId, p_secret_hash: secretHash });
      if (error) supabaseError(error);
      const row = (data as { color: string; opponent_idle_ms: number | string }[] | null)?.[0];
      if (!row || (row.color !== "w" && row.color !== "b")) return null;
      return { color: row.color, opponentIdleMs: Number(row.opponent_idle_ms) || 0 };
    },
    async getGame(gameId) {
      const { data, error } = await sb.from("chess_games").select("*").eq("id", gameId).maybeSingle();
      if (error) supabaseError(error);
      return data ? rowToGame(data as Record<string, unknown>) : null;
    },
    async applyMove(gameId, secretHash, expectedPly, m) {
      const { data, error } = await sb.rpc("chess_apply_move", {
        p_game: gameId,
        p_secret_hash: secretHash,
        p_expected_ply: expectedPly,
        p_uci: m.uci,
        p_fen: m.fen,
        p_last_move: m.lastMove,
        p_status: m.status,
        p_result: m.result,
        p_reason: m.reason,
      });
      if (error) supabaseError(error);
      return data === true;
    },
    async endGame(gameId, secretHash, kind) {
      const { data, error } = await sb.rpc("chess_end_game", { p_game: gameId, p_secret_hash: secretHash, p_kind: kind });
      if (error) supabaseError(error);
      return data === true;
    },
    async createRoom(name, secretHash) {
      const { data, error } = await sb.rpc("chess_room_create", { p_name: name, p_secret_hash: secretHash });
      if (error) supabaseError(error);
      const row = (data as { game_id: string; code: string }[] | null)?.[0];
      if (!row) throw new ChessStoreError("Couldn't create the room.", "failed");
      return { gameId: row.game_id, code: row.code };
    },
    async joinRoom(code, name, secretHash) {
      const { data, error } = await sb.rpc("chess_room_join", { p_code: code, p_name: name, p_secret_hash: secretHash });
      if (error) supabaseError(error);
      const row = (data as { state: string; game_id: string | null; role: string | null }[] | null)?.[0];
      if (row?.state === "joined" && row.game_id && (row.role === "teacher" || row.role === "student")) return { state: "joined", gameId: row.game_id, role: row.role };
      return { state: row?.state === "full" ? "full" : "missing" };
    },
    async touchRoom(gameId, secretHash) {
      const { data, error } = await sb.rpc("chess_room_touch", { p_game: gameId, p_secret_hash: secretHash });
      if (error) supabaseError(error);
      const row = (data as { role: string; color: string; opponent_idle_ms: number | string; code: string; student_joined: boolean }[] | null)?.[0];
      if (!row || (row.role !== "teacher" && row.role !== "student") || (row.color !== "w" && row.color !== "b")) return null;
      return { role: row.role, color: row.color, opponentIdleMs: Number(row.opponent_idle_ms) || 0, code: row.code, studentJoined: !!row.student_joined };
    },
    async updateRoom(gameId, secretHash, expectedVersion, u) {
      const { data, error } = await sb.rpc("chess_room_update", {
        p_game: gameId,
        p_secret_hash: secretHash,
        p_expected_version: expectedVersion,
        p_kind: u.kind,
        p_moves: u.moves ?? null,
        p_fen: u.fen ?? null,
        p_last_move: u.lastMove ?? null,
        p_status: u.status ?? null,
        p_result: u.result ?? null,
        p_reason: u.reason ?? null,
        p_flag: u.flag ?? null,
        p_teacher_color: u.teacherColor ?? null,
      });
      if (error) supabaseError(error);
      return data === true;
    },
  };
}

// ------------------------------------------------------------------ memory

type Ticket = { id: string; name: string; secretHash: string; joinedAt: number; seenAt: number; gameId: string | null; color: Color | null };
type MemSeat = { name: string; secretHash: string; seenAt: number };
type MemGame = { game: OnlineGame; seats: Record<Color, MemSeat>; updated: number };
type MemRoom = { gameId: string; code: string; teacherHash: string; studentHash: string | null; teacherSeen: number; studentSeen: number | null };

const PUBLIC_DEFAULTS = {
  version: 0,
  isPrivate: false,
  teacherName: null,
  studentName: null,
  teacherColor: null,
  allowTakebacks: false,
  demoMode: false,
  takebackRequest: null,
} satisfies Partial<OnlineGame>;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** In-memory store mirroring supabase/chess_multiplayer.sql (also used by unit tests). */
export function createMemoryStore(now: () => number = Date.now, random: () => number = Math.random): ChessStore {
  const queue = new Map<string, Ticket>();
  const games = new Map<string, MemGame>();
  const rooms = new Map<string, MemRoom>(); // by game id
  const privateGames = new Map<string, OnlineGame>();
  let seq = 0;

  function roomRole(gameId: string, secretHash: string): { room: MemRoom; role: Role } | null {
    const room = rooms.get(gameId);
    if (!room) return null;
    if (room.teacherHash === secretHash) return { room, role: "teacher" };
    if (room.studentHash && room.studentHash === secretHash) return { room, role: "student" };
    return null;
  }

  function cleanup() {
    const t = now();
    for (const [id, q] of queue) {
      if (!q.gameId && q.seenAt < t - 60_000) queue.delete(id);
      else if (q.gameId && q.seenAt < t - 10 * 60_000) queue.delete(id);
    }
    for (const [id, g] of games) if (g.updated < t - 2 * 86_400_000) games.delete(id);
  }

  function seatOf(gameId: string, secretHash: string): { g: MemGame; color: Color } | null {
    const g = games.get(gameId);
    if (!g) return null;
    if (g.seats.w.secretHash === secretHash) return { g, color: "w" };
    if (g.seats.b.secretHash === secretHash) return { g, color: "b" };
    return null;
  }

  return {
    kind: "memory",
    async matchmake(ticket, name, secretHash) {
      cleanup();
      const t = now();
      let me = queue.get(ticket);
      if (me) {
        if (me.secretHash !== secretHash) throw new ChessStoreError("Not allowed.", "forbidden");
        me.seenAt = t;
        if (me.gameId && me.color) return { state: "matched", gameId: me.gameId, color: me.color };
      } else {
        me = { id: ticket, name: name.slice(0, 32), secretHash, joinedAt: t + seq++ / 1000, seenAt: t, gameId: null, color: null };
        queue.set(ticket, me);
      }
      const opp = [...queue.values()]
        .filter((q) => !q.gameId && q.id !== ticket && q.seenAt >= t - QUEUE_STALE_MS)
        .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0];
      if (!opp) return { state: "waiting" };
      const meColor: Color = random() < 0.5 ? "w" : "b";
      const oppColor: Color = meColor === "w" ? "b" : "w";
      const id = crypto.randomUUID();
      const white = meColor === "w" ? me : opp;
      const black = meColor === "w" ? opp : me;
      games.set(id, {
        game: {
          id,
          whiteName: white.name,
          blackName: black.name,
          moves: [],
          fen: START_FEN,
          ply: 0,
          status: "active",
          result: null,
          reason: null,
          lastMove: null,
          updatedAt: new Date(t).toISOString(),
          ...PUBLIC_DEFAULTS,
        },
        seats: {
          w: { name: white.name, secretHash: white.secretHash, seenAt: t },
          b: { name: black.name, secretHash: black.secretHash, seenAt: t },
        },
        updated: t,
      });
      Object.assign(me, { gameId: id, color: meColor });
      Object.assign(opp, { gameId: id, color: oppColor });
      return { state: "matched", gameId: id, color: meColor };
    },
    async cancel(ticket, secretHash) {
      const me = queue.get(ticket);
      if (!me || me.secretHash !== secretHash) return { state: "gone" };
      if (me.gameId && me.color) return { state: "matched", gameId: me.gameId, color: me.color };
      queue.delete(ticket);
      return { state: "cancelled" };
    },
    async touch(gameId, secretHash) {
      const s = seatOf(gameId, secretHash);
      if (!s) return null;
      const t = now();
      s.g.seats[s.color].seenAt = t;
      return { color: s.color, opponentIdleMs: t - s.g.seats[s.color === "w" ? "b" : "w"].seenAt };
    },
    async getGame(gameId) {
      const g = games.get(gameId)?.game ?? privateGames.get(gameId);
      return g ? structuredClone(g) : null;
    },
    async applyMove(gameId, secretHash, expectedPly, m) {
      const s = seatOf(gameId, secretHash);
      if (!s) return false;
      const turn: Color = expectedPly % 2 === 0 ? "w" : "b";
      if (s.color !== turn) return false;
      const g = s.g.game;
      s.g.seats[s.color].seenAt = now();
      if (g.ply !== expectedPly || g.status !== "active") return false;
      Object.assign(g, {
        moves: [...g.moves, m.uci],
        fen: m.fen,
        ply: g.ply + 1,
        lastMove: m.lastMove,
        status: m.status,
        result: m.result,
        reason: m.reason,
        version: g.version + 1,
        updatedAt: new Date(now()).toISOString(),
      });
      s.g.updated = now();
      return true;
    },
    async endGame(gameId, secretHash, kind) {
      const s = seatOf(gameId, secretHash);
      if (!s || s.g.game.status !== "active") return false;
      const g = s.g.game;
      const white = s.color === "w";
      if (kind === "resign") {
        Object.assign(g, { status: "resigned", result: white ? "0-1" : "1-0", reason: white ? "White resigned" : "Black resigned" });
      } else {
        const opp = s.g.seats[white ? "b" : "w"];
        if (opp.seenAt > now() - CLAIM_WIN_MS) return false;
        Object.assign(g, { status: "abandoned", result: white ? "1-0" : "0-1", reason: white ? "Black left the game" : "White left the game" });
      }
      g.updatedAt = new Date(now()).toISOString();
      g.version += 1;
      s.g.updated = now();
      return true;
    },
    async createRoom(name, secretHash) {
      const taken = new Set([...rooms.values()].map((r) => r.code));
      let code = "";
      do code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join("");
      while (taken.has(code));
      const id = crypto.randomUUID();
      const t = now();
      const teacher = name.slice(0, 32);
      privateGames.set(id, {
        id,
        whiteName: teacher,
        blackName: "Student",
        moves: [],
        fen: START_FEN,
        ply: 0,
        status: "waiting",
        result: null,
        reason: null,
        lastMove: null,
        updatedAt: new Date(t).toISOString(),
        ...PUBLIC_DEFAULTS,
        isPrivate: true,
        teacherName: teacher,
        teacherColor: "w",
      });
      rooms.set(id, { gameId: id, code, teacherHash: secretHash, studentHash: null, teacherSeen: t, studentSeen: null });
      return { gameId: id, code };
    },
    async joinRoom(code, name, secretHash) {
      const room = [...rooms.values()].find((r) => r.code === code.trim().toUpperCase());
      if (!room) return { state: "missing" };
      const t = now();
      if (room.teacherHash === secretHash) return { state: "joined", gameId: room.gameId, role: "teacher" };
      if (room.studentHash === secretHash) {
        room.studentSeen = t;
        return { state: "joined", gameId: room.gameId, role: "student" };
      }
      if (room.studentHash && room.studentSeen !== null && room.studentSeen > t - 60_000) return { state: "full" };
      room.studentHash = secretHash;
      room.studentSeen = t;
      const g = privateGames.get(room.gameId)!;
      const student = name.slice(0, 32);
      Object.assign(g, {
        studentName: student,
        whiteName: g.teacherColor === "w" ? g.teacherName : student,
        blackName: g.teacherColor === "w" ? student : g.teacherName,
        status: g.status === "waiting" ? "active" : g.status,
        takebackRequest: null,
        version: g.version + 1,
      });
      return { state: "joined", gameId: room.gameId, role: "student" };
    },
    async touchRoom(gameId, secretHash) {
      const r = roomRole(gameId, secretHash);
      if (!r) return null;
      const t = now();
      const g = privateGames.get(gameId)!;
      const tc: Color = g.teacherColor ?? "w";
      if (r.role === "teacher") {
        r.room.teacherSeen = t;
        return { role: "teacher", color: tc, opponentIdleMs: r.room.studentSeen === null ? 0 : t - r.room.studentSeen, code: r.room.code, studentJoined: !!r.room.studentHash };
      }
      r.room.studentSeen = t;
      return { role: "student", color: tc === "w" ? "b" : "w", opponentIdleMs: t - r.room.teacherSeen, code: r.room.code, studentJoined: true };
    },
    async updateRoom(gameId, secretHash, expectedVersion, u) {
      const r = roomRole(gameId, secretHash);
      const g = privateGames.get(gameId);
      if (!r || !g || g.version !== expectedVersion) return false;
      const next = applyRoomUpdate(g, r.role, u, !!r.room.studentHash);
      if (!next) return false;
      next.updatedAt = new Date(now()).toISOString();
      privateGames.set(gameId, next);
      if (r.role === "teacher") r.room.teacherSeen = now();
      else r.room.studentSeen = now();
      return true;
    },
  };
}

// ------------------------------------------------------------------ pick one

// Kept on globalThis so dev-server hot reloads don't wipe running games.
const holder = globalThis as typeof globalThis & { __unieddChessMemory?: ChessStore };

export function getChessStore(): ChessStore {
  const sb = supabaseStore();
  if (sb) return sb;
  const allowMemory = process.env.NODE_ENV !== "production" || process.env.CHESS_MEMORY_STORE === "1";
  if (!allowMemory) throw new ChessStoreError("Online chess isn't set up on this server yet.", "not-configured");
  holder.__unieddChessMemory ??= createMemoryStore();
  return holder.__unieddChessMemory;
}

/** Public Realtime settings for the browser (anon key is safe to share; RLS only allows reading games). */
export function realtimeConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || !getSupabase()) return null;
  return { url, anonKey };
}
