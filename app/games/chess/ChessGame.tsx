"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const Loading = () => <div className="flex aspect-square max-h-[640px] w-full items-center justify-center rounded-3xl border border-[var(--border)] bg-slate-50 text-[var(--muted)]">Loading the board…</div>;
const PuzzleTrainer = dynamic(() => import("./PuzzleTrainer"), { ssr: false, loading: Loading });
const PlayComputer = dynamic(() => import("./PlayComputer"), { ssr: false, loading: Loading });
const PlayOnline = dynamic(() => import("./PlayOnline"), { ssr: false, loading: Loading });
const StylePicker = dynamic(() => import("./StylePicker").then((m) => m.StylePicker), { ssr: false });

function Game({ kind }: { kind: string }) {
  if (kind === "chess-play") return <PlayComputer />;
  if (kind === "chess-online") return <PlayOnline />;
  return <PuzzleTrainer />;
}

/**
 * Fullscreen for the whole chess area (board, panel and controls). Uses the
 * browser Fullscreen API, and falls back to a fixed full-window layer where it
 * isn't available (e.g. iPhone Safari).
 */
function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement === ref.current && !!ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!fallback) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFallback(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fallback]);

  const toggle = useCallback(async () => {
    if (native) return void document.exitFullscreen().catch(() => {});
    if (fallback) return setFallback(false);
    const el = ref.current;
    if (el && document.fullscreenEnabled && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // fall through to the in-page version
      }
    }
    setFallback(true);
  }, [native, fallback]);

  return { ref, active: native || fallback, fallback, toggle };
}

export default function ChessGame({ kind }: { kind: string }) {
  const { ref, active, fallback, toggle } = useFullscreen();
  return (
    <div
      ref={ref}
      data-testid="chess-area"
      data-fullscreen={active ? "on" : "off"}
      className={`ct-area space-y-3 ${active ? "ct-fs overflow-y-auto bg-white p-3 sm:p-5" : ""} ${fallback ? "fixed inset-0 z-[1000]" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <StylePicker />
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          data-testid="chess-fullscreen"
          aria-pressed={active}
          title={active ? "Exit fullscreen (Esc)" : "Fullscreen"}
          className="shrink-0 rounded-3xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:border-[var(--brand-blue)]"
        >
          {active ? "✕ Exit" : "⛶ Fullscreen"}
        </button>
      </div>
      <Game kind={kind} />
    </div>
  );
}
