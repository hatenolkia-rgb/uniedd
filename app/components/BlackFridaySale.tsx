"use client";

import Link from "next/link";
import { GAMES } from "../games/catalog";
import { BLACK_FRIDAY, pad, useBlackFriday } from "../lib/blackFriday";
import BlackFridayOffers from "./BlackFridayOffers";

const COURSES = ["🎸 Guitar", "🎹 Piano", "🎤 Singing"];
const NOTES = [
  { n: "♪", c: "left-[6%] top-[18%] text-3xl", d: "0s" },
  { n: "♫", c: "left-[22%] bottom-[10%] text-2xl", d: "1.2s" },
  { n: "♬", c: "right-[8%] top-[12%] text-4xl", d: "0.6s" },
  { n: "♩", c: "right-[30%] bottom-[6%] text-2xl", d: "1.8s" },
  { n: "♪", c: "left-[48%] top-[6%] text-xl", d: "2.4s" },
];

// Black Friday sale section: the 40% offer and free music games and tools,
// then a slider with the other offers. Shows only during the sale (or with ?bf=preview).
// `first` adds room for the fixed navbar when it's the top of the page.
export default function BlackFridaySale({ first = false }: { first?: boolean }) {
  const left = useBlackFriday();
  if (!left) return null;

  return (
    <section
      id="black-friday"
      className={`relative overflow-hidden bg-[#08061a] px-4 text-white sm:px-6 ${first ? "pt-28 pb-14 sm:pt-32" : "py-14"}`}
    >
      {/* night sky, glow and floating notes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 12% 22%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 68% 14%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 84% 64%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 32% 78%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 52% 42%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 92% 30%, #fff 50%, transparent 51%)",
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--brand-orange)] opacity-25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[var(--brand-blue)] opacity-25 blur-3xl" />
      {NOTES.map((x, i) => (
        <span key={i} aria-hidden="true" className={`animate-float pointer-events-none absolute text-white/15 ${x.c}`} style={{ animationDelay: x.d }}>
          {x.n}
        </span>
      ))}

      <div className="relative mx-auto max-w-6xl">
        {/* headline + countdown */}
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#ffcf6b] ring-1 ring-white/15">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffcf6b] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ffcf6b]" />
              </span>
              Sale is live · ends 30 Nov
            </p>
            <h2 className="mt-4 text-5xl font-bold leading-[0.95] sm:text-7xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
              Black{" "}
              <span className="animate-gradient-x bg-gradient-to-r from-[#ffcf6b] via-[var(--brand-orange)] to-[var(--brand-blue)] bg-[length:200%_auto] bg-clip-text text-transparent">
                Friday
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-base text-white/70 sm:text-lg">
              Our best price of the year on live 1:1 classes, plus free games and tools for every young musician.
            </p>
          </div>
          <div className="flex gap-2 tabular-nums" aria-label="Time left in the sale">
            {[
              [left.d, "days"],
              [pad(left.h), "hrs"],
              [pad(left.m), "min"],
              [pad(left.s), "sec"],
            ].map(([v, l]) => (
              <div key={l} className="w-[4.25rem] rounded-2xl bg-white/[0.07] py-3 text-center ring-1 ring-white/15 backdrop-blur sm:w-20">
                <div className="text-2xl font-bold sm:text-3xl">{v}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/50">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {/* 1. The main offer: 40% off the first two classes */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffb347] via-[var(--brand-orange)] to-[#c4560f] p-6 text-[#1d0f02] shadow-[0_20px_60px_-15px_rgba(232,150,46,0.6)] sm:p-8 lg:col-span-2 lg:row-span-2">
            <span className="absolute -right-6 top-6 rotate-12 rounded-xl border-4 border-[#1d0f02] px-4 py-1 text-xl font-black tracking-wider sm:right-6 sm:text-2xl">
              40%
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1d0f02]/70">1 · Parents, don&apos;t miss this</p>
            <p className="mt-3 max-w-md text-4xl font-black leading-tight sm:text-5xl">
              40% off your child&apos;s{" "}
              <span className="italic" style={{ fontFamily: "var(--font-playfair), serif" }}>first two</span> music classes
            </p>
            <p className="mt-3 max-w-md text-base font-medium text-[#1d0f02]/80">
              Live 1:1 online guitar, piano &amp; singing classes for kids 3–19, at a time that suits you.
            </p>
            <p className="mt-4 inline-block rounded-full bg-[#1d0f02] px-4 py-2 text-sm font-semibold text-[#ffcf6b]">
              🎁 Black Friday offer · ends 30 November
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {COURSES.map((c) => (
                <span key={c} className="rounded-full bg-white/35 px-3 py-1 text-sm font-semibold backdrop-blur">
                  {c}
                </span>
              ))}
            </div>
            <Link
              href={BLACK_FRIDAY.demoLink}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d0f02] px-7 py-3.5 text-base font-bold text-white transition hover:scale-[1.03]"
            >
              Book a free 30-min demo <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* 2. Free music games */}
          <Link
            href="/games"
            className="group rounded-3xl bg-gradient-to-br from-[#1a9fd4] to-[#0b5f86] p-6 shadow-lg ring-1 ring-white/10 transition hover:-translate-y-1"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">2 · Free music games</p>
            <p className="mt-2 text-2xl font-bold leading-snug">
              {GAMES.length}+ games 🎮 + a certificate on WhatsApp
            </p>
            <p className="mt-1 text-sm text-white/75">Guitar, piano, singing, rhythm, theory and chess. No sign-up.</p>
            <span className="mt-4 inline-block text-sm font-semibold underline-offset-4 group-hover:underline">Play now →</span>
          </Link>

          {/* 3. Other free tools */}
          <div className="grid grid-cols-2 gap-4">
            <Link href="/practice" className="group rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/15 transition hover:-translate-y-1 hover:bg-white/10">
              <p className="text-2xl" aria-hidden="true">🤖</p>
              <p className="mt-2 font-bold leading-snug">AI Practice Coach</p>
              <p className="mt-1 text-xs text-white/60">3 free tries · unlimited for students</p>
            </Link>
            <Link href="/jam" className="group rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/15 transition hover:-translate-y-1 hover:bg-white/10">
              <p className="text-2xl" aria-hidden="true">🎛️</p>
              <p className="mt-2 font-bold leading-snug">Jam Studio</p>
              <p className="mt-1 text-xs text-white/60">Free tuner, metronome & backing tracks</p>
            </Link>
          </div>
        </div>

        {/* More offers: $9 lessons and a free guitar, as a slider */}
        <div className="mt-4">
          <BlackFridayOffers />
        </div>
      </div>
    </section>
  );
}
