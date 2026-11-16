"use client";

import { useEffect, useRef, useState } from "react";
import { CAPTURE_FX_MS, majorCapture, squarePercent, type Capture } from "./captures";

type Fx = Capture & { key: number; at: { left: number; top: number }; reduced: boolean };

const BURST = ["💥", "✨", "⭐", "💫"];
const CONFETTI = ["🎉", "🎊", "✨", "⭐", "💥", "🌟", "🎆", "🎇"];

/**
 * Watches the board position and plays a short, non-blocking celebration when
 * a knight/bishop (small), rook (big) or queen (huge) is captured.
 * Returns the overlay plus whether the board should shake right now.
 */
export function useCaptureFx(fen: string, orientation: "white" | "black", enabled: boolean, reduced: boolean) {
  const prev = useRef<string | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const before = prev.current;
    prev.current = fen;
    if (!enabled) return;
    const cap = majorCapture(before, fen);
    if (!cap) return;
    const key = ++seq.current;
    setFx({ ...cap, key, at: squarePercent(cap.square, orientation), reduced });
    const t = window.setTimeout(() => setFx((f) => (f?.key === key ? null : f)), CAPTURE_FX_MS + 100);
    return () => window.clearTimeout(t);
  }, [fen, orientation, enabled, reduced]);

  const shake = !!fx && !fx.reduced && fx.tier !== "small" ? (fx.tier === "huge" ? "ct-shake-huge" : "ct-shake") : "";
  const overlay = fx ? <CaptureOverlay key={fx.key} fx={fx} /> : null;
  return { overlay, shake };
}

function CaptureOverlay({ fx }: { fx: Fx }) {
  const { tier, at, reduced } = fx;
  const parts = tier === "small" ? 8 : tier === "big" ? 14 : 0;
  return (
    <div className={`ct-fx ct-fx-${tier} pointer-events-none absolute inset-0 z-[15] overflow-hidden rounded-xl`} aria-hidden data-testid="chess-capture-fx" data-tier={tier} data-piece={fx.piece}>
      {!reduced && tier === "huge" ? <div className="ct-fx-flash absolute inset-0" /> : null}
      {!reduced && parts ? (
        <div className="absolute" style={{ left: `${at.left}%`, top: `${at.top}%` }}>
          {tier === "big" ? <span className="ct-fx-boom">💥</span> : null}
          <span className="ct-fx-victim">{fx.emoji}</span>
          {Array.from({ length: parts }, (_, i) => {
            const angle = (i / parts) * Math.PI * 2;
            const dist = tier === "small" ? 55 : 95;
            return (
              <span
                key={i}
                className="ct-fx-spark"
                style={{ "--dx": `${Math.cos(angle) * dist}px`, "--dy": `${Math.sin(angle) * dist}px`, animationDelay: `${(i % 3) * 40}ms` } as React.CSSProperties}
              >
                {BURST[i % BURST.length]}
              </span>
            );
          })}
        </div>
      ) : null}
      {!reduced && tier === "huge"
        ? Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className="ct-fx-confetti"
              style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 70}ms`, "--rot": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg` } as React.CSSProperties}
            >
              {CONFETTI[i % CONFETTI.length]}
            </span>
          ))
        : null}
      <div className={`ct-fx-text ${tier === "huge" ? "ct-fx-text-huge" : ""}`}>
        {tier === "huge" ? "👑💥 " : `${fx.emoji} `}
        {fx.text}
      </div>
    </div>
  );
}
