"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameDef } from "../catalog";

export const TEACHER_APP_URL = "https://uniedd-chess-teacher.uniedd-games.workers.dev";

function embedSrc(code: string) {
  const url = new URL(TEACHER_APP_URL);
  url.searchParams.set("embed", "1");
  if (code) url.searchParams.set("code", code);
  return url.toString();
}

export default function TeacherEmbed({ game }: { game: GameDef }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [code, setCode] = useState("");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("code")?.trim() || "";
    if (initial) {
      setCode(initial);
      setPlaying(true);
    }
  }, []);

  const src = useMemo(() => embedSrc(code), [code]);

  const goFullscreen = useCallback(async () => {
    const node = frameRef.current;
    if (!node) return;
    try {
      if (node.requestFullscreen) await node.requestFullscreen();
      else if ("webkitRequestFullscreen" in node) {
        (node as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
      }
    } catch {
      /* the iframe is already a large playfield */
    }
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm" data-testid="chess-teacher-embed">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3" style={{ background: `${game.accent}14` }}>
        <p className="font-semibold">🎓 Play with Teacher</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {playing ? (
            <button
              type="button"
              onClick={() => void goFullscreen()}
              className="rounded-full border border-[var(--border)] bg-white px-4 py-1.5 font-semibold hover:border-[var(--brand-blue)]"
            >
              Fullscreen
            </button>
          ) : null}
          <Link href="/games/chess" className="text-[var(--brand-blue)] hover:underline">
            Play vs computer
          </Link>
          <Link href="/games/chess-online" className="text-[var(--brand-blue)] hover:underline">
            Play online
          </Link>
          <Link href="/games/chess-puzzles" className="text-[var(--brand-blue)] hover:underline">
            Chess puzzles
          </Link>
          <a href={src} target="_blank" rel="noreferrer" className="text-[var(--brand-blue)] hover:underline">
            Open in a new tab
          </a>
        </div>
      </div>
      {playing ? (
        <iframe
          ref={frameRef}
          title={game.title}
          src={src}
          data-testid="chess-teacher-frame"
          className="block h-[min(92vh,1100px)] w-full border-0 bg-[#fafafa]"
          allow="clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="flex min-h-[min(60vh,520px)] flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-blue)]">Live classroom board · Free</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold sm:text-4xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {game.title}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
            Teachers sign in with their lms.uniedd.com teacher or admin account, start a game and share a join code.
            Students join with the code and a name — no login. The teacher can move any piece and doodle on the board to show ideas.
          </p>
          <button
            type="button"
            onClick={() => setPlaying(true)}
            data-testid="chess-teacher-play"
            className="mt-8 rounded-full bg-[var(--brand-blue)] px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-[var(--brand-blue-dark,#1480b0)]"
          >
            Play with Teacher
          </button>
        </div>
      )}
    </div>
  );
}
