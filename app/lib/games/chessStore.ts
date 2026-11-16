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
  rowToGame,
  type Color,
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

export interface ChessStore {
  kind: "supabase" | "memory";
  matchmake(ticket: string, name: string, secretHash: string): Promise<MatchState>;
  cancel(ticket: string, secretHash: string): Promise<MatchState>;
  /** Heartbeat for a seated player; null if the secret doesn't own a seat. */
  touch(gameId: string, secretHash: string): Promise<Seat | null>;
  getGame(gameId: string): Promise<OnlineGame | null>;
  applyMove(gameId: string, secretHash: string, expectedPly: number, move: StoredMove): Promise<boolean>;
  endGame(gameId: string, secretHash: string, kind: "resign" | "claim"): Promise<boolean>;
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
    throw new ChessStoreError("Online chess tables are missing. Run supabase/chess_multiplayer.sql in Supabase.", "missing-tables");
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
  };
}

// ------------------------------------------------------------------ memory

type Ticket = { id: string; name: string; secretHash: string; joinedAt: number; seenAt: number; gameId: string | null; color: Color | null };
type MemSeat = { name: string; secretHash: string; seenAt: number };
type MemGame = { game: OnlineGame; seats: Record<Color, MemSeat>; updated: number };

/** In-memory store mirroring supabase/chess_multiplayer.sql (also used by unit tests). */
export function createMemoryStore(now: () => number = Date.now, random: () => number = Math.random): ChessStore {
  const queue = new Map<string, Ticket>();
  const games = new Map<string, MemGame>();
  let seq = 0;

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
      const g = games.get(gameId);
      return g ? structuredClone(g.game) : null;
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
      s.g.updated = now();
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
