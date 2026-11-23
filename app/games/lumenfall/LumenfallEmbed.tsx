"use client";

import { useCallback, useRef, useState } from "react";
import type { GameDef } from "../catalog";

const SRC = "/games/lumenfall/index.html";

export default function LumenfallEmbed({ game }: { game: GameDef }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);

  const start = useCallback(() => setPlaying(true), []);

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
        {playing ? (
          <button
            type="button"
            onClick={goFullscreen}
            className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
          >
            Full screen
          </button>
        ) : null}
      </div>
      {playing ? (
        <iframe
          ref={frameRef}
          title={game.title}
          src={SRC}
          className="block h-[min(90vh,900px)] w-full border-0 bg-[#03060f]"
          allow="microphone; midi; autoplay; fullscreen; gamepad"
          referrerPolicy="same-origin"
        />
      ) : (
        <div className="relative isolate flex min-h-[min(70vh,640px)] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(1200px 500px at 50% 0%, #14532d55, transparent 60%), radial-gradient(800px 400px at 80% 100%, #0ea5e933, transparent 55%), linear-gradient(180deg, #07110c 0%, #03060f 100%)",
            }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(#ffffff22 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
          <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-teal-200/80">Beginner adventure · Free online</p>
          <h2 className="relative mt-3 max-w-xl text-3xl font-bold text-white sm:text-4xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {game.title}
          </h2>
          <p className="relative mt-4 max-w-lg text-sm leading-relaxed text-white/75">
            Catch falling notes in a spirit forest — on piano, guitar, a MIDI keyboard, or with your voice. The game loads when you press play, so this page stays fast until you are ready.
          </p>
          <button
            type="button"
            onClick={start}
            className="relative mt-8 rounded-full bg-gradient-to-r from-teal-400 to-sky-400 px-8 py-3 text-base font-semibold text-[#03120c] shadow-lg shadow-teal-900/40 hover:from-teal-300 hover:to-sky-300"
          >
            Play Lumenfall
          </button>
        </div>
      )}
    </div>
  );
}
