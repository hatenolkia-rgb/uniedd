// Detect "a major piece was just captured" from two board positions, so every
// chess page (puzzles, vs computer, online — both players) can celebrate it.
import { Chess } from "chess.js";

export type MajorPiece = "n" | "b" | "r" | "q";
export type CaptureTier = "small" | "big" | "huge";
export type Capture = { piece: MajorPiece; color: "w" | "b"; square: string; tier: CaptureTier; text: string; emoji: string };

const TIER: Record<MajorPiece, CaptureTier> = { n: "small", b: "small", r: "big", q: "huge" };
const TEXT: Record<MajorPiece, string> = {
  n: "Neigh-ver mind! Knight down!",
  b: "Bishop bonked!",
  r: "Castle crumbled! Rook down!",
  q: "QUEEN DOWN!",
};
const EMOJI: Record<MajorPiece, string> = { n: "🐴", b: "⛪", r: "🏰", q: "👑" };

export const CAPTURE_FX_MS = 1500;

function boardPart(fen: string) {
  return fen.split(" ")[0] ?? "";
}

/**
 * If `next` is exactly one legal move after `prev` and that move captured a
 * knight, bishop, rook or queen, describe the capture. Anything else (new
 * puzzle, take-back, new game, pawn captures) returns null.
 */
export function majorCapture(prev: string | null | undefined, next: string): Capture | null {
  if (!prev || prev === next) return null;
  let g: Chess;
  try {
    g = new Chess(prev);
  } catch {
    return null;
  }
  const target = boardPart(next);
  for (const m of g.moves({ verbose: true })) {
    if (!m.captured || m.captured === "p" || m.captured === "k") continue;
    g.move(m);
    const same = boardPart(g.fen()) === target;
    g.undo();
    if (!same) continue;
    const piece = m.captured as MajorPiece;
    const color = m.color === "w" ? "b" : "w";
    return { piece, color, square: m.to, tier: TIER[piece], text: TEXT[piece], emoji: EMOJI[piece] };
  }
  return null;
}

/** Position of a square as % from the top-left of the board, for the given orientation. */
export function squarePercent(square: string, orientation: "white" | "black") {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { left: (col + 0.5) * 12.5, top: (row + 0.5) * 12.5 };
}

