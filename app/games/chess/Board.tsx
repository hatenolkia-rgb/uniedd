"use client";

import { Chess, type Square } from "chess.js";
import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";

export type MoveInput = { from: string; to: string; promotion?: string };
export type Arrow = { startSquare: string; endSquare: string; color: string };

type Props = {
  fen: string;
  orientation: "white" | "black";
  /** Whose pieces the player may move right now (null = board locked). */
  playerColor: "w" | "b" | null;
  /** Return true if the move was accepted. */
  onMove: (m: MoveInput) => boolean;
  lastMove?: { from: string; to: string } | null;
  highlights?: Record<string, React.CSSProperties>;
  arrows?: Arrow[];
  flash?: "good" | "bad" | null;
};

const PROMO = ["q", "r", "b", "n"] as const;
const PROMO_ICON: Record<string, [string, string]> = { q: ["♕", "♛"], r: ["♖", "♜"], b: ["♗", "♝"], n: ["♘", "♞"] };

/** Chessboard with drag, click-to-move, legal-move dots and a promotion picker. */
export function Board({ fen, orientation, playerColor, onMove, lastMove, highlights, arrows, flash }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const game = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);
  const canMove = !!game && playerColor !== null && game.turn() === playerColor;

  const targets = useMemo(() => {
    if (!game || !selected || !canMove) return [] as { to: string; capture: boolean }[];
    return game
      .moves({ square: selected as Square, verbose: true })
      .map((m) => ({ to: m.to, capture: !!m.captured }));
  }, [game, selected, canMove]);

  function needsPromotion(from: string, to: string) {
    if (!game) return false;
    const p = game.get(from as Square);
    return !!p && p.type === "p" && ((p.color === "w" && to[1] === "8") || (p.color === "b" && to[1] === "1"));
  }

  function isLegal(from: string, to: string) {
    if (!game) return false;
    return game.moves({ square: from as Square, verbose: true }).some((m) => m.to === to);
  }

  function attempt(from: string, to: string) {
    if (!canMove || !isLegal(from, to)) return false;
    if (needsPromotion(from, to)) {
      setPromo({ from, to });
      setSelected(null);
      return true;
    }
    setSelected(null);
    return onMove({ from, to });
  }

  function clickSquare(square: string) {
    if (!game || !canMove || promo) return;
    const piece = game.get(square as Square);
    if (selected) {
      if (selected === square) return setSelected(null);
      if (piece && piece.color === playerColor) return setSelected(square);
      if (!attempt(selected, square)) setSelected(null);
      return;
    }
    if (piece && piece.color === playerColor) setSelected(square);
  }

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { background: "rgba(255, 214, 10, 0.38)" };
    squareStyles[lastMove.to] = { background: "rgba(255, 214, 10, 0.5)" };
  }
  if (game?.inCheck()) {
    const board = game.board();
    for (const row of board)
      for (const sq of row)
        if (sq && sq.type === "k" && sq.color === game.turn())
          squareStyles[sq.square] = { background: "radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(239,68,68,0.35) 55%, transparent 75%)" };
  }
  Object.assign(squareStyles, highlights ?? {});
  if (selected) squareStyles[selected] = { ...(squareStyles[selected] ?? {}), background: "rgba(59, 130, 246, 0.5)" };
  for (const t of targets)
    squareStyles[t.to] = {
      ...(squareStyles[t.to] ?? {}),
      backgroundImage: t.capture
        ? "radial-gradient(circle, transparent 58%, rgba(20,20,40,0.32) 60%)"
        : "radial-gradient(circle, rgba(20,20,40,0.28) 22%, transparent 24%)",
    };

  const promoColor = playerColor ?? "w";

  return (
    <div className="relative w-full select-none" style={{ touchAction: "none" }}>
      <div
        className={`overflow-hidden rounded-xl shadow-lg ring-4 transition-colors ${
          flash === "good" ? "ring-emerald-400" : flash === "bad" ? "ring-rose-400" : "ring-transparent"
        }`}
      >
        <Chessboard
          options={{
            id: "uniedd-board",
            position: fen,
            boardOrientation: orientation,
            allowDragging: canMove && !promo,
            canDragPiece: ({ piece }) => canMove && piece.pieceType[0] === playerColor,
            onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? attempt(sourceSquare, targetSquare) : false),
            onSquareClick: ({ square }) => clickSquare(square),
            onPieceClick: ({ square }) => square && clickSquare(square),
            squareStyles,
            arrows: arrows ?? [],
            allowDrawingArrows: false,
            animationDurationInMs: 180,
            darkSquareStyle: { backgroundColor: "#7a8fb8" },
            lightSquareStyle: { backgroundColor: "#eef1f7" },
          }}
        />
      </div>
      {promo ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/40" onClick={() => setPromo(null)}>
          <div className="rounded-2xl bg-white p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-center text-sm font-semibold text-slate-700">Promote to</p>
            <div className="flex gap-2">
              {PROMO.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={`Promote to ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[p]}`}
                  onClick={() => {
                    const m = { ...promo, promotion: p };
                    setPromo(null);
                    onMove(m);
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 text-4xl hover:bg-amber-100"
                >
                  {PROMO_ICON[p][promoColor === "w" ? 0 : 1]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
