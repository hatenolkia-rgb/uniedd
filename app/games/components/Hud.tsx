"use client";

export function Hud({ score, streak, label, extra }: { score: number; streak: number; label: string; extra?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f4f9fd] px-4 py-3 text-sm">
      <span>
        Score <strong>{score}</strong>
      </span>
      <span>
        Streak <strong>{streak}</strong>
      </span>
      <span>{label}</span>
      {extra ? <span className="rounded-full bg-white px-2 py-0.5 font-semibold">{extra}</span> : null}
    </div>
  );
}
