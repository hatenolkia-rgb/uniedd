"use client";

import dynamic from "next/dynamic";

const Loading = () => <div className="flex aspect-square max-h-[640px] w-full items-center justify-center rounded-3xl border border-[var(--border)] bg-slate-50 text-[var(--muted)]">Loading the board…</div>;
const PuzzleTrainer = dynamic(() => import("./PuzzleTrainer"), { ssr: false, loading: Loading });
const PlayComputer = dynamic(() => import("./PlayComputer"), { ssr: false, loading: Loading });

export default function ChessGame({ kind }: { kind: string }) {
  return kind === "chess-play" ? <PlayComputer /> : <PuzzleTrainer />;
}
