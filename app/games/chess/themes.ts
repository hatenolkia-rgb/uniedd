// Board themes and piece sets for every chess page (puzzles, vs computer, online).
// Pure data + helpers so they can be unit-tested; the CSS for animated frames
// lives in chessThemes.css (classes `ct-frame-<id>`).
import type { CSSProperties } from "react";

export type BoardTheme = {
  id: string;
  name: string;
  emoji: string;
  light: CSSProperties;
  dark: CSSProperties;
  /** Colours for highlights drawn on top of the squares. */
  lastFrom: string;
  lastTo: string;
  selected: string;
  /** Legal-move dot / capture ring colour. */
  dot: string;
  /** Outline/glow around the classic pieces so they stay readable on bold squares. */
  pieceGlow?: string;
  lightNotation: string;
  darkNotation: string;
  /** Behind the squares (shows through semi-transparent squares). */
  boardBackground?: string;
};

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "classic",
    name: "Classic",
    emoji: "♟️",
    light: { backgroundColor: "#eef1f7" },
    dark: { backgroundColor: "#7a8fb8" },
    lastFrom: "rgba(255, 214, 10, 0.38)",
    lastTo: "rgba(255, 214, 10, 0.5)",
    selected: "rgba(59, 130, 246, 0.5)",
    dot: "rgba(20,20,40,0.3)",
    lightNotation: "#7a8fb8",
    darkNotation: "#eef1f7",
  },
  {
    id: "neon",
    name: "Neon Cyberpunk",
    emoji: "🌆",
    light: { background: "linear-gradient(135deg, #3b0a6b 0%, #24104f 100%)", boxShadow: "inset 0 0 0 1px rgba(0,255,240,0.35)" },
    dark: { background: "linear-gradient(135deg, #0d0221 0%, #190a3a 100%)", boxShadow: "inset 0 0 0 1px rgba(255,0,200,0.35)" },
    lastFrom: "rgba(0, 255, 240, 0.35)",
    lastTo: "rgba(255, 0, 200, 0.45)",
    selected: "rgba(0, 255, 240, 0.55)",
    dot: "rgba(0,255,240,0.6)",
    pieceGlow: "drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 4px #00fff0)",
    lightNotation: "#00fff0",
    darkNotation: "#ff4fd8",
  },
  {
    id: "lava",
    name: "Lava Volcano",
    emoji: "🌋",
    light: { background: "radial-gradient(circle at 30% 30%, #ffb347 0%, #ff6a00 60%, #d93a00 100%)" },
    dark: { background: "radial-gradient(circle at 70% 70%, #5a1200 0%, #2b0700 70%, #1a0400 100%)" },
    lastFrom: "rgba(255, 240, 120, 0.4)",
    lastTo: "rgba(255, 255, 160, 0.55)",
    selected: "rgba(255, 255, 255, 0.45)",
    dot: "rgba(255,230,120,0.7)",
    pieceGlow: "drop-shadow(0 0 1.5px #fff3) drop-shadow(0 0 3px #ff8c00)",
    lightNotation: "#5a1200",
    darkNotation: "#ffb347",
  },
  {
    id: "ice",
    name: "Frozen Ice",
    emoji: "🧊",
    light: { background: "linear-gradient(135deg, #ffffff 0%, #e0f7ff 55%, #c9efff 100%)" },
    dark: { background: "linear-gradient(135deg, #8fd3f4 0%, #5bb4e5 60%, #3d8fd1 100%)" },
    lastFrom: "rgba(255, 255, 255, 0.55)",
    lastTo: "rgba(186, 230, 253, 0.85)",
    selected: "rgba(14, 165, 233, 0.5)",
    dot: "rgba(3,60,110,0.35)",
    lightNotation: "#3d8fd1",
    darkNotation: "#ffffff",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    emoji: "🌌",
    light: { backgroundColor: "rgba(180, 160, 255, 0.28)" },
    dark: { backgroundColor: "rgba(10, 5, 40, 0.55)" },
    lastFrom: "rgba(255, 220, 120, 0.35)",
    lastTo: "rgba(255, 220, 120, 0.5)",
    selected: "rgba(160, 120, 255, 0.6)",
    dot: "rgba(255,255,255,0.55)",
    pieceGlow: "drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 4px #a78bfa)",
    lightNotation: "#e9d5ff",
    darkNotation: "#c4b5fd",
    boardBackground:
      "radial-gradient(1px 1px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 72% 32%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 38% 78%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 88% 82%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 55% 50%, #fff 50%, transparent 51%), radial-gradient(ellipse at 20% 30%, #7c3aed 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, #db2777 0%, transparent 50%), linear-gradient(160deg, #0b0630 0%, #1e1b4b 50%, #0f172a 100%)",
  },
  {
    id: "candy",
    name: "Candy Land",
    emoji: "🍭",
    light: { background: "repeating-linear-gradient(45deg, #fff0f6 0 8px, #ffe3ef 8px 16px)" },
    dark: { background: "repeating-linear-gradient(45deg, #ff8fc7 0 8px, #ff6fb5 8px 16px)" },
    lastFrom: "rgba(134, 239, 172, 0.55)",
    lastTo: "rgba(110, 231, 183, 0.75)",
    selected: "rgba(196, 181, 253, 0.8)",
    dot: "rgba(120,20,80,0.35)",
    lightNotation: "#ff6fb5",
    darkNotation: "#fff0f6",
  },
  {
    id: "matrix",
    name: "Matrix Hacker",
    emoji: "💻",
    light: { background: "linear-gradient(180deg, #0f3d1a 0%, #0a2e12 100%)", boxShadow: "inset 0 0 6px rgba(0,255,65,0.35)" },
    dark: { backgroundColor: "#020a04" },
    lastFrom: "rgba(0, 255, 65, 0.25)",
    lastTo: "rgba(0, 255, 65, 0.4)",
    selected: "rgba(0, 255, 65, 0.5)",
    dot: "rgba(0,255,65,0.7)",
    pieceGlow: "drop-shadow(0 0 1.5px #b6ffb6) drop-shadow(0 0 4px #00ff41)",
    lightNotation: "#00ff41",
    darkNotation: "#00ff41",
  },
  {
    id: "gold",
    name: "Gold Luxury",
    emoji: "👑",
    light: { background: "linear-gradient(135deg, #fff5cc 0%, #f7d774 45%, #e6b422 100%)" },
    dark: { background: "linear-gradient(135deg, #2b2b2b 0%, #111 60%, #3a3a3a 100%)" },
    lastFrom: "rgba(255, 255, 255, 0.35)",
    lastTo: "rgba(255, 236, 140, 0.55)",
    selected: "rgba(255, 215, 0, 0.6)",
    dot: "rgba(212,160,23,0.75)",
    pieceGlow: "drop-shadow(0 0 1.5px #fff6) drop-shadow(0 0 3px #d4a017)",
    lightNotation: "#3a3a3a",
    darkNotation: "#f7d774",
  },
  {
    id: "retro",
    name: "Retro 8-bit",
    emoji: "👾",
    light: { backgroundColor: "#9bbc0f", boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.15)" },
    dark: { backgroundColor: "#306230", boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.25)" },
    lastFrom: "rgba(255, 255, 255, 0.3)",
    lastTo: "rgba(255, 255, 255, 0.45)",
    selected: "rgba(15, 56, 15, 0.6)",
    dot: "rgba(15,56,15,0.7)",
    lightNotation: "#0f380f",
    darkNotation: "#9bbc0f",
  },
  {
    id: "synthwave",
    name: "Synthwave Sunset",
    emoji: "🌅",
    light: { background: "linear-gradient(180deg, #ffd319 0%, #ff901f 45%, #ff2975 100%)" },
    dark: { background: "linear-gradient(180deg, #8c1eff 0%, #4a0e8f 60%, #2b0b54 100%)" },
    lastFrom: "rgba(0, 240, 255, 0.35)",
    lastTo: "rgba(0, 240, 255, 0.5)",
    selected: "rgba(255, 255, 255, 0.5)",
    dot: "rgba(255,255,255,0.65)",
    pieceGlow: "drop-shadow(0 0 1.5px #fff8) drop-shadow(0 0 3px #ff2975)",
    lightNotation: "#4a0e8f",
    darkNotation: "#ffd319",
  },
  {
    id: "jungle",
    name: "Jungle",
    emoji: "🌴",
    light: { background: "linear-gradient(135deg, #d9f99d 0%, #a3e635 100%)" },
    dark: { background: "linear-gradient(135deg, #166534 0%, #14532d 100%)" },
    lastFrom: "rgba(253, 224, 71, 0.45)",
    lastTo: "rgba(253, 224, 71, 0.6)",
    selected: "rgba(250, 204, 21, 0.6)",
    dot: "rgba(20,40,10,0.4)",
    pieceGlow: "drop-shadow(0 0 1px #fff8)",
    lightNotation: "#14532d",
    darkNotation: "#d9f99d",
  },
];

export const DEFAULT_THEME_ID = "classic";

export function getTheme(id: string | null | undefined): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

// ------------------------------------------------------------------ pieces

export type PieceLetter = "K" | "Q" | "R" | "B" | "N" | "P";
export const PIECE_LETTERS: PieceLetter[] = ["K", "Q", "R", "B", "N", "P"];
export const PIECE_NAMES: Record<PieceLetter, string> = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight", P: "Pawn" };

export type PieceSet = {
  id: string;
  name: string;
  /** null = the normal chess pieces. */
  emoji: Record<PieceLetter, string> | null;
};

export const PIECE_SETS: PieceSet[] = [
  { id: "classic", name: "Classic pieces", emoji: null },
  { id: "animals", name: "Animals", emoji: { K: "🦁", Q: "🦄", R: "🐘", B: "🦉", N: "🐴", P: "🐥" } },
  { id: "food", name: "Food", emoji: { K: "🎂", Q: "🍩", R: "🍔", B: "🍦", N: "🌮", P: "🍓" } },
  { id: "faces", name: "Faces", emoji: { K: "😎", Q: "🤩", R: "😤", B: "🤓", N: "😜", P: "🙂" } },
  { id: "space", name: "Space", emoji: { K: "🌞", Q: "🪐", R: "🚀", B: "🛸", N: "☄️", P: "⭐" } },
  { id: "sports", name: "Sports", emoji: { K: "🏆", Q: "🥇", R: "🏀", B: "⚽", N: "🏈", P: "🎾" } },
];

export const DEFAULT_PIECE_SET_ID = "classic";

export function getPieceSet(id: string | null | undefined): PieceSet {
  return PIECE_SETS.find((p) => p.id === id) ?? PIECE_SETS[0];
}

/** Emoji for a react-chessboard piece code like "wK" / "bp", or null for the normal set. */
export function pieceEmoji(set: PieceSet, pieceType: string): string | null {
  if (!set.emoji) return null;
  const letter = pieceType[1]?.toUpperCase() as PieceLetter;
  return set.emoji[letter] ?? null;
}

/** Disc colours that tell White and Black emoji pieces apart. */
export const TEAM_STYLE = {
  w: { fill: "#ffffff", ring: "#2563eb", label: "White team: white disc, blue ring" },
  b: { fill: "#1f2937", ring: "#f97316", label: "Black team: dark disc, orange ring" },
} as const;

// ------------------------------------------------------------------ storage

export const THEME_KEY = "uniedd-chess-theme";
export const PIECES_KEY = "uniedd-chess-pieces";
export const FX_KEY = "uniedd-chess-capture-fx";
