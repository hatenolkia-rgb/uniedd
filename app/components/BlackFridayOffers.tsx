"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BLACK_FRIDAY } from "../lib/blackFriday";

const COURSES = ["🎸 Guitar", "🎹 Keyboard", "🎤 Vocals", "🥁 Tabla", "💃 Dance", "🎙️ Public Speaking", "♟️ Chess"];
const YEAR_COURSE_TERMS = "*Valid only on the 96-session, 1-year course with one-time payment. Not valid on 3- or 6-month courses. T&C apply.";
const AUTO_MS = 6000;

type Offer = {
  tag: string;
  title: ReactNode;
  body: string;
  badge: string;
  stamp: string;
  terms?: string;
  chips?: string[];
  // card colours: background, text, badge/button background, badge text
  bg: string;
  ink: string;
  dark: string;
  accent: string;
};

const OFFERS: Offer[] = [
  {
    tag: "Live 1:1 classes",
    title: BLACK_FRIDAY.offer,
    body: "With a real teacher, live online, at a time that suits you. Kids and adults welcome.",
    badge: `🎁 Early bird: ${BLACK_FRIDAY.earlyBird.replace(/^Enrol/, "enrol")}`,
    stamp: "SALE",
    chips: COURSES,
    bg: "bg-gradient-to-br from-[#ffb347] via-[#e8962e] to-[#c4560f]",
    ink: "text-[#1d0f02]",
    dark: "bg-[#1d0f02]",
    accent: "text-[#ffcf6b]",
  },
  {
    tag: "Guitar & piano · 1-year course",
    title: (
      <>
        Guitar or piano lessons at just <span className="text-[#ffcf6b]">$9</span> a session*
      </>
    ),
    body: "Live 1:1 online classes with expert teachers, for kids 3–19 across the US.",
    badge: "📅 96-session, 1-year course",
    stamp: "$9",
    terms: YEAR_COURSE_TERMS,
    bg: "bg-gradient-to-br from-[#2f6fd6] via-[#1f5bb9] to-[#0f2f6b]",
    ink: "text-white",
    dark: "bg-[#0b1f47]",
    accent: "text-[#ffcf6b]",
  },
  {
    tag: "Black Friday gift",
    title: (
      <>
        Get a <span className="italic text-[#ffcf6b]" style={{ fontFamily: "var(--font-playfair), serif" }}>FREE guitar</span> with online music classes*
      </>
    ),
    body: "Your child learns live, 1:1 with an expert teacher, on their very own guitar.",
    badge: "🎸 With the 96-session, 1-year course",
    stamp: "FREE",
    terms: YEAR_COURSE_TERMS,
    bg: "bg-gradient-to-br from-[#1f9d7a] via-[#13785e] to-[#0a3f33]",
    ink: "text-white",
    dark: "bg-[#06281f]",
    accent: "text-[#ffcf6b]",
  },
];

// The Black Friday offers as a slider: changes by itself every few seconds,
// and visitors can swipe or use the arrows and dots. Auto-play pauses
// while the pointer or keyboard focus is on it, and is off for people who
// ask their device for reduced motion.
export default function BlackFridayOffers() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipeFrom = useRef<number | null>(null);

  function go(i: number) {
    setIndex((i + OFFERS.length) % OFFERS.length);
  }

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(index + 1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [index, paused]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl shadow-[0_20px_60px_-15px_rgba(232,150,46,0.5)] lg:col-span-2 lg:row-span-2"
      aria-roledescription="carousel"
      aria-label="Black Friday offers"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div
        onPointerDown={(e) => { swipeFrom.current = e.clientX; }}
        onPointerUp={(e) => {
          const from = swipeFrom.current;
          swipeFrom.current = null;
          if (from === null || Math.abs(e.clientX - from) < 40) return;
          go(index + (e.clientX < from ? 1 : -1));
        }}
        className="flex h-full touch-pan-y transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {OFFERS.map((o, i) => (
          <div
            key={o.tag}
            role="group"
            aria-hidden={i !== index}
            aria-roledescription="slide"
            aria-label={`Offer ${i + 1} of ${OFFERS.length}`}
            className={`relative flex w-full shrink-0 flex-col p-6 pb-16 sm:p-8 sm:pb-16 ${o.bg} ${o.ink}`}
          >
            <span className="absolute right-4 top-6 rotate-12 rounded-xl border-4 border-current px-3 py-1 text-lg font-black tracking-wider sm:right-6 sm:px-4 sm:text-2xl">
              {o.stamp}
            </span>
            <p className="pr-24 text-xs font-bold uppercase tracking-[0.2em] opacity-75">
              {i + 1} · {o.tag}
            </p>
            <p className="mt-3 max-w-lg pr-10 text-3xl font-black leading-tight sm:text-5xl">{o.title}</p>
            <p className="mt-3 max-w-md text-base font-medium opacity-85">{o.body}</p>
            <p className={`mt-4 self-start rounded-full px-4 py-2 text-sm font-semibold ${o.dark} ${o.accent}`}>{o.badge}</p>
            {o.chips ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {o.chips.map((c) => (
                  <span key={c} className="rounded-full bg-white/35 px-3 py-1 text-sm font-semibold backdrop-blur">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-auto pt-7">
              <Link
                href={BLACK_FRIDAY.demoLink}
                tabIndex={i === index ? 0 : -1}
                className={`inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-white transition hover:scale-[1.03] ${o.dark}`}
              >
                Book a free 30-min demo <span aria-hidden="true">→</span>
              </Link>
              {o.terms ? <p className="mt-3 max-w-xl text-[11px] leading-snug opacity-70">{o.terms}</p> : null}
            </div>
          </div>
        ))}
      </div>

      {/* arrows + dots */}
      <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(index - 1)} aria-label="Previous offer" className="h-8 w-8 rounded-full bg-black/25 text-white backdrop-blur hover:bg-black/40">
          ‹
        </button>
        {OFFERS.map((o, i) => (
          <button
            key={o.tag}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show offer ${i + 1}`}
            aria-current={i === index}
            className={`h-2.5 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`}
          />
        ))}
        <button type="button" onClick={() => go(index + 1)} aria-label="Next offer" className="h-8 w-8 rounded-full bg-black/25 text-white backdrop-blur hover:bg-black/40">
          ›
        </button>
      </div>
    </div>
  );
}
