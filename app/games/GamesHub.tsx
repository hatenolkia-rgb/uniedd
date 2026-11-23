"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CATEGORIES,
  GAMES,
  LEVEL_LABEL,
  TOPIC_CATEGORIES,
  categoryPath,
  gamesByCategory,
  gamesByLevel,
  type CategoryId,
  type GameDef,
} from "./catalog";

export default function GamesHub() {
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const list = useMemo(() => gamesByCategory(filter), [filter]);
  const beginners = useMemo(() => gamesByLevel("beginner"), []);

  return (
    <div>
      <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-3">
        {CATEGORIES.map((cat) => {
          const active = filter === cat.id;
          const count = cat.id === "all" ? GAMES.length : GAMES.filter((g) => g.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilter(cat.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-transparent bg-[var(--brand-blue)] text-white shadow"
                  : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--brand-blue)]"
              }`}
            >
              <span className="mr-1" aria-hidden>
                {cat.emoji}
              </span>
              {cat.label}
              <span className={`ml-2 text-xs ${active ? "text-white/80" : "text-[var(--muted)]"}`}>{count}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-6 text-sm text-[var(--muted)]">
        {CATEGORIES.find((c) => c.id === filter)?.hint}
      </p>

      {filter === "all"
        ? (
          <>
            {beginners.length ? (
              <section className="mb-10">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
                    🌱 Beginner games
                  </h2>
                  <p className="text-sm text-[var(--muted)]">A gentle place to start — play these first in your browser.</p>
                </div>
                <GameGrid games={beginners} />
              </section>
            ) : null}
            {TOPIC_CATEGORIES.map((cat) => (
              <section key={cat.id} className="mb-10">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
                      {cat.emoji} {cat.label}
                    </h2>
                    <p className="text-sm text-[var(--muted)]">{cat.hint}</p>
                  </div>
                  <Link href={categoryPath(cat.id)} className="text-sm text-[var(--brand-blue)] hover:underline">
                    View {cat.label.toLowerCase()} games
                  </Link>
                </div>
                <GameGrid games={gamesByCategory(cat.id)} />
              </section>
            ))}
          </>
        )
        : <GameGrid games={list} />}
    </div>
  );
}

function GameGrid({ games }: { games: GameDef[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {games.map((game) => (
        <Link
          key={game.slug}
          href={`/games/${game.slug}`}
          className="group flex flex-col rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: game.accent }}>
              {game.minutes}
            </span>
            {game.level ? (
              <span className="inline-flex w-fit items-center rounded-full border border-[var(--border)] bg-[#fff6ea] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]">
                {LEVEL_LABEL[game.level]}
              </span>
            ) : null}
          </span>
          <h3 className="mt-3 text-lg font-semibold group-hover:text-[var(--brand-blue)]">{game.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">{game.blurb}</p>
          <span className="mt-4 text-sm font-medium text-[var(--brand-orange)]">Play {game.title} →</span>
        </Link>
      ))}
    </div>
  );
}
