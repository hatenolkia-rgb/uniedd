"use client";

import { useState } from "react";
import { useChessPrefs } from "./prefs";
import { EmojiPiece } from "./pieces";
import { BOARD_THEMES, PIECE_LETTERS, PIECE_NAMES, PIECE_SETS, TEAM_STYLE, type BoardTheme } from "./themes";

function Swatch({ theme }: { theme: BoardTheme }) {
  return (
    <span aria-hidden className={`ct-frame ct-frame-${theme.id} mx-auto block w-full max-w-[64px] overflow-hidden rounded-lg`} style={{ animation: "none" }}>
      <span className="relative grid aspect-square grid-cols-4 overflow-hidden rounded-lg" style={{ background: theme.boardBackground }}>
        {Array.from({ length: 16 }, (_, i) => {
          const light = (Math.floor(i / 4) + i) % 2 === 0;
          return <span key={i} style={light ? theme.light : theme.dark} />;
        })}
      </span>
    </span>
  );
}

/** "Board style" button + panel: board themes and emoji piece sets (saved in this browser). */
export function StylePicker() {
  const { theme, pieceSet, setTheme, setPieceSet, captureFx, setCaptureFx } = useChessPrefs();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white shadow-sm" data-testid="chess-style-picker">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="font-semibold">
          🎨 Board style <span className="font-normal text-[var(--muted)]">· {theme.emoji} {theme.name} · {pieceSet.emoji ? `${pieceSet.emoji.K} ${pieceSet.name}` : "♞ Classic pieces"}</span>
        </span>
        <span className="text-sm font-semibold text-[var(--brand-blue)]">{open ? "Close" : "Change"}</span>
      </button>
      {open ? (
        <div className="space-y-5 border-t border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Board theme</p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11" role="radiogroup" aria-label="Board theme">
              {BOARD_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme.id === t.id}
                  data-theme-option={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`rounded-2xl p-1.5 text-center text-[11px] font-semibold transition ${
                    theme.id === t.id ? "bg-[#1d4ed814] ring-2 ring-[var(--brand-blue)]" : "hover:bg-slate-50"
                  }`}
                >
                  <Swatch theme={t} />
                  <span className="mt-1.5 block leading-tight">
                    {t.emoji} {t.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Pieces</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Piece set">
              {PIECE_SETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={pieceSet.id === p.id}
                  data-pieces-option={p.id}
                  onClick={() => setPieceSet(p.id)}
                  className={`rounded-2xl px-3 py-2 text-left text-sm transition ${
                    pieceSet.id === p.id ? "bg-[#1d4ed814] ring-2 ring-[var(--brand-blue)]" : "ring-1 ring-[var(--border)] hover:bg-slate-50"
                  }`}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="mt-1 flex gap-1" aria-hidden>
                    {PIECE_LETTERS.map((l) =>
                      p.emoji ? (
                        <span key={l} className="h-7 w-7" title={PIECE_NAMES[l]}>
                          <EmojiPiece emoji={p.emoji[l]} color="w" />
                        </span>
                      ) : (
                        <span key={l} className="flex h-7 w-7 items-center justify-center text-xl" title={PIECE_NAMES[l]}>
                          {{ K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" }[l]}
                        </span>
                      ),
                    )}
                  </span>
                  {p.emoji ? (
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      {PIECE_LETTERS.map((l) => `${p.emoji![l]} ${PIECE_NAMES[l]}`).join(" · ")}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-5 w-5">
                  <EmojiPiece emoji="🙂" color="w" />
                </span>
                {TEAM_STYLE.w.label}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-5 w-5">
                  <EmojiPiece emoji="🙂" color="b" />
                </span>
                {TEAM_STYLE.b.label}
              </span>
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--brand-blue)]" checked={captureFx} onChange={(e) => setCaptureFx(e.target.checked)} data-testid="chess-capture-fx-toggle" />
            <span>
              <span className="font-semibold">💥 Capture animations</span>
              <span className="block text-xs text-[var(--muted)]">A quick celebration when a knight, bishop, rook or queen is captured (bigger for bigger pieces). Calmer if your device is set to reduce motion.</span>
            </span>
          </label>
          <p className="text-xs text-[var(--muted)]">Your choice is saved in this browser and used for puzzles, games vs the computer and online games.</p>
        </div>
      ) : null}
    </div>
  );
}
