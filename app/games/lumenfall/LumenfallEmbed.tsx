"use client";

import { useCallback, useRef } from "react";
import type { GameDef } from "../catalog";

const SRC = "/games/lumenfall/index.html";

export default function LumenfallEmbed({ game }: { game: GameDef }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const goFullscreen = useCallback(async () => {
    const node = frameRef.current;
    if (!node) return;
    try {
      if (node.requestFullscreen) await node.requestFullscreen();
      else if ("webkitRequestFullscreen" in node) {
        (node as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
      }
    } catch {
      /* ignore: the iframe itself is already a large playfield */
    }
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[#03060f] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3" style={{ background: `${game.accent}22` }}>
        <p className="text-sm text-white/80">Plays in this page — allow the microphone if you want to sing or play a real instrument.</p>
        <button
          type="button"
          onClick={goFullscreen}
          className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
        >
          Full screen
        </button>
      </div>
      <iframe
        ref={frameRef}
        title={game.title}
        src={SRC}
        className="block h-[min(90vh,900px)] w-full border-0 bg-[#03060f]"
        allow="microphone; midi; autoplay; fullscreen; gamepad"
        referrerPolicy="same-origin"
      />
    </div>
  );
}
