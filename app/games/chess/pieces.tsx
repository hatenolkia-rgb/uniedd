"use client";

import { defaultPieces, type PieceRenderObject } from "react-chessboard";
import { TEAM_STYLE, pieceEmoji, type BoardTheme, type PieceSet } from "./themes";

const CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;

/** An emoji on a team-coloured disc (white disc + blue ring vs dark disc + orange ring). */
export function EmojiPiece({ emoji, color, title }: { emoji: string; color: "w" | "b"; title?: string }) {
  const t = TEAM_STYLE[color];
  return (
    <svg viewBox="0 0 45 45" width="100%" height="100%" role="img" aria-label={title} style={{ overflow: "visible" }}>
      <circle cx="22.5" cy="22.5" r="19" fill={t.fill} stroke={t.ring} strokeWidth="3.5" />
      {color === "b" ? <circle cx="22.5" cy="22.5" r="14.5" fill="none" stroke={t.ring} strokeOpacity="0.35" strokeWidth="1" /> : null}
      <text x="22.5" y="24" textAnchor="middle" dominantBaseline="central" fontSize="23" style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>
        {emoji}
      </text>
    </svg>
  );
}

/** react-chessboard `pieces` option for a theme + piece set (undefined = library defaults). */
export function buildPieces(set: PieceSet, theme: BoardTheme): PieceRenderObject | undefined {
  if (!set.emoji && !theme.pieceGlow) return undefined;
  const out: PieceRenderObject = {};
  for (const code of CODES) {
    const emoji = pieceEmoji(set, code);
    const color = code[0] as "w" | "b";
    if (emoji) out[code] = () => <EmojiPiece emoji={emoji} color={color} />;
    else {
      const base = defaultPieces[code];
      out[code] = (props) => base({ ...props, svgStyle: { ...(props?.svgStyle ?? {}), filter: theme.pieceGlow } });
    }
  }
  return out;
}
