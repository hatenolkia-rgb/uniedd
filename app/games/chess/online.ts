// Shared (browser + server) rules for online multiplayer chess.
// The server replays the whole move list with chess.js before storing a move,
// so both players always see a legal game.
import { Chess, type Square } from "chess.js";

export type Color = "w" | "b";
export type GameStatus = "waiting" | "active" | "checkmate" | "stalemate" | "draw" | "resigned" | "abandoned";
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
  /** Bumped on every change (moves, take-backs, settings). */
  version: number;
  // Private teacher rooms only:
  isPrivate: boolean;
  teacherName: string | null;
  studentName: string | null;
  teacherColor: Color | null;
  allowTakebacks: boolean;
  demoMode: boolean;
  /** A student's pending take-back request, made when the game had `n` moves. */
  takebackRequest: { n: number } | null;
};

export type Role = "teacher" | "student";

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
    version: Number(row.version ?? 0),
    isPrivate: row.is_private === true,
    teacherName: (row.teacher_name as string | null) ?? null,
    studentName: (row.student_name as string | null) ?? null,
    teacherColor: row.teacher_color === "w" || row.teacher_color === "b" ? row.teacher_color : null,
    allowTakebacks: row.allow_takebacks === true,
    demoMode: row.demo_mode === true,
    takebackRequest:
      row.takeback_request && typeof (row.takeback_request as { n?: unknown }).n === "number"
        ? { n: (row.takeback_request as { n: number }).n }
        : null,
  };
}

/** Keep whichever copy of the game is further along (Realtime and polling can race). */
export function newerGame(a: OnlineGame | null, b: OnlineGame): OnlineGame {
  if (!a || a.id !== b.id) return b;
  if (a.version || b.version) return b.version >= a.version ? (b.version === a.version ? a : b) : a;
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

// ------------------------------------------------------------------ private teacher rooms

export const ROOM_CODE = /^[A-HJKMNP-Z2-9]{6}$/;

export type RoomKind =
  | "move"
  | "undo"
  | "takeback"
  | "request"
  | "approve"
  | "decline"
  | "set_takebacks"
  | "set_demo"
  | "reset"
  | "set_teacher_color"
  | "resign";

export const TEACHER_ONLY: RoomKind[] = ["undo", "approve", "decline", "set_takebacks", "set_demo", "reset", "set_teacher_color"];

/** What a room action stores (mirrors chess_room_update's parameters). */
export type RoomUpdate = {
  kind: RoomKind;
  moves?: string[];
  fen?: string;
  lastMove?: { from: string; to: string } | null;
  status?: GameStatus;
  result?: GameResult;
  reason?: string | null;
  flag?: boolean;
  teacherColor?: Color;
};

export function studentColor(g: Pick<OnlineGame, "teacherColor">): Color {
  return g.teacherColor === "b" ? "w" : "b";
}

export function colorOf(g: Pick<OnlineGame, "teacherColor">, role: Role): Color {
  return role === "teacher" ? (g.teacherColor ?? "w") : studentColor(g);
}

/** Plies to go back so the position is just before the student's last move (0 = nothing to take back). */
export function takebackPlies(g: Pick<OnlineGame, "moves" | "teacherColor">): number {
  const n = g.moves.length;
  if (!n) return 0;
  const last: Color = n % 2 === 1 ? "w" : "b";
  const k = last === studentColor(g) ? 1 : 2;
  return n >= k ? k : 0;
}

/** Position after a list of moves, with the result recomputed. */
export function positionAfter(moves: string[]) {
  const g = replay(moves);
  const last = moves.length ? parseUci(moves[moves.length - 1]) : null;
  return { moves, fen: g.fen(), lastMove: last ? { from: last.from, to: last.to } : null, ...outcomeOf(g) };
}

/**
 * Apply a room update the way chess_room_update() does: returns the new game,
 * or null if `role` may not do it right now. Used by the in-memory store and
 * to pre-check actions on the server.
 */
export function applyRoomUpdate(g: OnlineGame, role: Role, u: RoomUpdate, studentJoined: boolean): OnlineGame | null {
  if (TEACHER_ONLY.includes(u.kind) && role !== "teacher") return null;
  const n = g.moves.length;
  const sc = studentColor(g);
  const toMove: Color = n % 2 === 0 ? "w" : "b";
  const next: OnlineGame = { ...g, version: g.version + 1, updatedAt: new Date().toISOString() };
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const board = () => {
    const moves = u.moves ?? [];
    return Object.assign(next, {
      moves,
      ply: moves.length,
      fen: u.fen ?? START_FEN,
      lastMove: u.lastMove ?? null,
      status: u.kind === "reset" && !studentJoined ? "waiting" : (u.status ?? "active"),
      result: u.result ?? null,
      reason: u.reason ?? null,
      takebackRequest: null,
    });
  };
  switch (u.kind) {
    case "move": {
      const moves = u.moves ?? [];
      if (g.status !== "active" || moves.length !== n + 1 || !same(moves.slice(0, n), g.moves)) return null;
      if (!((role === "teacher" && (g.demoMode || toMove === g.teacherColor)) || (role === "student" && toMove === sc))) return null;
      return board();
    }
    case "undo":
    case "takeback":
    case "approve": {
      if (g.status === "waiting" || n === 0) return null;
      let k = 1;
      if (u.kind !== "undo") {
        if (u.kind === "takeback" && !g.allowTakebacks) return null;
        if (u.kind === "approve" && (!g.takebackRequest || g.takebackRequest.n !== n)) return null;
        k = takebackPlies(g);
        if (!k) return null;
      }
      if (!same(u.moves ?? [], g.moves.slice(0, n - k))) return null;
      return board();
    }
    case "reset":
      if ((u.moves ?? []).length) return null;
      return board();
    case "request":
      if (role !== "student" || g.status === "waiting" || g.takebackRequest || n < (sc === "w" ? 1 : 2)) return null;
      return { ...next, takebackRequest: { n } };
    case "decline":
      if (!g.takebackRequest) return null;
      return { ...next, takebackRequest: null };
    case "set_takebacks":
      if (typeof u.flag !== "boolean") return null;
      return { ...next, allowTakebacks: u.flag };
    case "set_demo":
      if (typeof u.flag !== "boolean") return null;
      return { ...next, demoMode: u.flag };
    case "set_teacher_color": {
      if (u.teacherColor !== "w" && u.teacherColor !== "b") return null;
      const teacher = g.teacherName ?? "Teacher";
      const student = g.studentName ?? "Student";
      return {
        ...next,
        teacherColor: u.teacherColor,
        whiteName: u.teacherColor === "w" ? teacher : student,
        blackName: u.teacherColor === "w" ? student : teacher,
        takebackRequest: null,
      };
    }
    case "resign":
      if (g.status !== "active" || u.status !== "resigned") return null;
      return { ...next, status: "resigned", result: u.result ?? null, reason: u.reason ?? null, takebackRequest: null };
    default:
      return null;
  }
}

export type RoomInput = { from?: string; to?: string; promotion?: string; flag?: boolean; teacherColor?: Color };

/** Work out the update for a room action (new position via chess.js), with a friendly error if it isn't allowed. */
export function planRoomAction(
  g: OnlineGame,
  role: Role,
  kind: RoomKind,
  input: RoomInput = {},
  studentJoined = true,
): { ok: true; update: RoomUpdate; game: OnlineGame; san?: string; captured?: boolean } | { ok: false; error: string } {
  if (TEACHER_ONLY.includes(kind) && role !== "teacher") return { ok: false, error: "Only the teacher can do that." };
  let update: RoomUpdate;
  let san: string | undefined;
  let captured: boolean | undefined;
  const n = g.moves.length;
  switch (kind) {
    case "move": {
      if (g.status === "waiting") return { ok: false, error: "Wait for your student to join." };
      const toMove: Color = n % 2 === 0 ? "w" : "b";
      const mayMove = role === "teacher" ? g.demoMode || toMove === g.teacherColor : toMove === studentColor(g);
      if (!mayMove) return { ok: false, error: "It isn't your turn." };
      const check = checkMove(g.moves, toMove, { from: input.from ?? "", to: input.to ?? "", promotion: input.promotion }, g.status);
      if (!check.ok) return check;
      san = check.san;
      captured = check.captured;
      update = {
        kind,
        moves: [...g.moves, check.uci],
        fen: check.fen,
        lastMove: { from: check.from, to: check.to },
        status: check.status,
        result: check.result,
        reason: check.reason,
      };
      break;
    }
    case "undo":
    case "takeback":
    case "approve": {
      if (!n) return { ok: false, error: "There is no move to take back." };
      if (kind === "takeback" && !g.allowTakebacks) return { ok: false, error: "Ask your teacher to take the move back." };
      if (kind === "approve" && (!g.takebackRequest || g.takebackRequest.n !== n)) return { ok: false, error: "That take-back request is out of date." };
      const k = kind === "undo" ? 1 : takebackPlies(g);
      if (!k) return { ok: false, error: "There is no move to take back." };
      update = { kind, ...positionAfter(g.moves.slice(0, n - k)) };
      break;
    }
    case "reset":
      update = { kind, ...positionAfter([]) };
      break;
    case "request":
      if (g.takebackRequest) return { ok: false, error: "You already asked — waiting for your teacher." };
      update = { kind };
      break;
    case "set_takebacks":
    case "set_demo":
      update = { kind, flag: !!input.flag };
      break;
    case "set_teacher_color":
      if (input.teacherColor !== "w" && input.teacherColor !== "b") return { ok: false, error: "Pick White or Black." };
      update = { kind, teacherColor: input.teacherColor };
      break;
    case "resign": {
      const c = colorOf(g, role);
      update = { kind, status: "resigned", result: c === "w" ? "0-1" : "1-0", reason: c === "w" ? "White resigned" : "Black resigned" };
      break;
    }
    default:
      update = { kind };
  }
  const next = applyRoomUpdate(g, role, update, studentJoined);
  if (!next) return { ok: false, error: "That isn't possible right now." };
  return { ok: true, update, game: next, san, captured };
}
