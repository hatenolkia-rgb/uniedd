// Shared (browser + server) rules for online multiplayer chess.
// The server replays the whole move list with chess.js before storing a move,
// so both players always see a legal game.
import { Chess, type Square } from "chess.js";

export type Color = "w" | "b";
export type GameStatus = "active" | "checkmate" | "stalemate" | "draw" | "resigned" | "abandoned";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | null;

export type OnlineGame = {
  id: string;
  whiteName: string;
  blackName: string;
  /** Moves in UCI notation, e.g. ["e2e4", "e7e5", "e7e8q"]. */
  moves: string[];
  fen: string;
  ply: number;
  status: GameStatus;
  result: GameResult;
  reason: string | null;
  lastMove: { from: string; to: string } | null;
  updatedAt: string;
};

export type Outcome = { status: GameStatus; result: GameResult; reason: string | null };

export const START_FEN = new Chess().fen();
/** How often a waiting player re-checks the lobby (also its heartbeat). */
export const LOBBY_POLL_MS = 2000;
/** A waiting player not seen for this long is never matched (matches the SQL). */
export const QUEUE_STALE_MS = 15_000;
/** Game heartbeat / fallback polling while Realtime isn't available. */
export const GAME_POLL_MS = 1500;
/** Slower heartbeat used when Realtime pushes moves. */
export const GAME_HEARTBEAT_MS = 5000;
/** Show "opponent disconnected" after this much silence. */
export const DISCONNECT_NOTICE_MS = 15_000;
/** A player may claim the win after the opponent is gone this long (matches the SQL). */
export const CLAIM_WIN_MS = 45_000;

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function toUci(m: { from: string; to: string; promotion?: string }) {
  return `${m.from}${m.to}${m.promotion ?? ""}`;
}

export function parseUci(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

/** Replay a UCI move list from the start position. Throws on an illegal move. */
export function replay(moves: string[]): Chess {
  const g = new Chess();
  for (const uci of moves) {
    if (!UCI.test(uci)) throw new Error(`Bad move ${uci}`);
    g.move(parseUci(uci));
  }
  return g;
}

/** Game result from a position: checkmate, stalemate, draws, or still active. */
export function outcomeOf(g: Chess): Outcome {
  if (g.isCheckmate()) {
    const winner = g.turn() === "w" ? "b" : "w";
    return { status: "checkmate", result: winner === "w" ? "1-0" : "0-1", reason: `Checkmate — ${winner === "w" ? "White" : "Black"} wins` };
  }
  if (g.isStalemate()) return { status: "stalemate", result: "1/2-1/2", reason: "Stalemate" };
  if (g.isInsufficientMaterial()) return { status: "draw", result: "1/2-1/2", reason: "Draw — not enough pieces to checkmate" };
  if (g.isThreefoldRepetition()) return { status: "draw", result: "1/2-1/2", reason: "Draw by threefold repetition" };
  if (g.isDraw()) return { status: "draw", result: "1/2-1/2", reason: "Draw by the 50-move rule" };
  return { status: "active", result: null, reason: null };
}

export type MoveCheck =
  | ({ ok: true; uci: string; san: string; fen: string; from: string; to: string; captured: boolean } & Outcome)
  | { ok: false; error: string };

/**
 * Check a move by `color` against the game so far. Used by the server before a
 * move is stored, and by the browser to show the move straight away.
 */
export function checkMove(
  moves: string[],
  color: Color,
  input: { from: string; to: string; promotion?: string },
  status: GameStatus = "active",
): MoveCheck {
  if (status !== "active") return { ok: false, error: "The game is over." };
  let g: Chess;
  try {
    g = replay(moves);
  } catch {
    return { ok: false, error: "The game record is invalid." };
  }
  if (g.turn() !== color) return { ok: false, error: "It isn't your turn." };
  if (!/^[a-h][1-8]$/.test(input.from) || !/^[a-h][1-8]$/.test(input.to)) return { ok: false, error: "Bad square." };
  if (input.promotion && !/^[qrbn]$/.test(input.promotion)) return { ok: false, error: "Bad promotion piece." };
  const piece = g.get(input.from as Square);
  if (!piece || piece.color !== color) return { ok: false, error: "That isn't your piece." };
  try {
    const mv = g.move({ from: input.from, to: input.to, promotion: input.promotion });
    return {
      ok: true,
      uci: toUci({ from: mv.from, to: mv.to, promotion: mv.promotion }),
      san: mv.san,
      fen: g.fen(),
      from: mv.from,
      to: mv.to,
      captured: !!mv.captured,
      ...outcomeOf(g),
    };
  } catch {
    return { ok: false, error: "Illegal move." };
  }
}

/** SAN list for the move panel. */
export function sanList(moves: string[]): string[] {
  const g = new Chess();
  const out: string[] = [];
  for (const uci of moves) {
    try {
      out.push(g.move(parseUci(uci)).san);
    } catch {
      break;
    }
  }
  return out;
}

/** Map a chess_games row (Supabase / Realtime payload) to an OnlineGame. */
export function rowToGame(row: Record<string, unknown>): OnlineGame {
  const lm = row.last_move as { from?: string; to?: string } | null | undefined;
  return {
    id: String(row.id),
    whiteName: String(row.white_name ?? "White"),
    blackName: String(row.black_name ?? "Black"),
    moves: Array.isArray(row.moves) ? (row.moves as string[]) : [],
    fen: String(row.fen ?? START_FEN),
    ply: Number(row.ply ?? 0),
    status: (row.status as GameStatus) ?? "active",
    result: (row.result as GameResult) ?? null,
    reason: (row.reason as string | null) ?? null,
    lastMove: lm && lm.from && lm.to ? { from: lm.from, to: lm.to } : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

/** Keep whichever copy of the game is further along (Realtime and polling can race). */
export function newerGame(a: OnlineGame | null, b: OnlineGame): OnlineGame {
  if (!a || a.id !== b.id) return b;
  if (b.ply > a.ply) return b;
  if (b.ply < a.ply) return a;
  if (a.status === "active" && b.status !== "active") return b;
  return a;
}

/** Headline for the end of the game, from one player's point of view. */
export function resultText(game: OnlineGame, me: Color): string {
  if (game.status === "active") return "";
  if (game.result === "1/2-1/2") return `${game.reason ?? "Draw"}.`;
  const iWon = (game.result === "1-0" && me === "w") || (game.result === "0-1" && me === "b");
  switch (game.status) {
    case "checkmate":
      return iWon ? "Checkmate — you win! 🎉" : "Checkmate — your opponent wins.";
    case "resigned":
      return iWon ? "Your opponent resigned — you win! 🎉" : "You resigned.";
    case "abandoned":
      return iWon ? "Your opponent left — you win! 🎉" : "You left the game — your opponent wins.";
    default:
      return game.reason ?? "Game over.";
  }
}
