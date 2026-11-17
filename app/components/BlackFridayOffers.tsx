"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BLACK_FRIDAY, useCountry } from "../lib/blackFriday";

const YEAR_COURSE_TERMS = "*Valid only on the 96-session, 1-year course with one-time payment. Not valid on 3- or 6-month courses. T&C apply.";
const AUTO_MS = 6000;

type Offer = {
  tag: string;
  title: ReactNode;
  body: string;
  stamp: string;
  terms: string;
  // card colours: background, button/badge background
  bg: string;
  dark: string;
};

// The $9-a-session offer: rupees in India, dollars elsewhere. null = don't
// show it (India visitors while no rupee price is set).
function sessionPrice(country: string): string | null {
  if (country !== "IN") return "$9";
  return BLACK_FRIDAY.inrPerSession ? `₹${BLACK_FRIDAY.inrPerSession.toLocaleString("en-IN")}` : null;
}

// The offers besides 40% off (that one has its own big card above).
function offersFor(country: string): Offer[] {
  const price = sessionPrice(country);
  return [
    ...(price
      ? [{
          tag: "Guitar & piano · 1-year course",
          title: (
            <>
              Guitar or piano lessons at just <span className="text-[#ffcf6b]">{price}</span> a session*
            </>
          ),
          body: "Live 1:1 online classes with expert teachers, for kids 3–19. 96-session, 1-year course.",
          stamp: price,
          terms: YEAR_COURSE_TERMS,
          bg: "bg-gradient-to-r from-[#2f6fd6] via-[#1f5bb9] to-[#0f2f6b]",
          dark: "bg-[#0b1f47]",
        }]
      : []),
    {
      tag: "Black Friday gift",
      title: (
        <>
          Get a <span className="italic text-[#ffcf6b]" style={{ fontFamily: "var(--font-playfair), serif" }}>FREE guitar</span> with online music classes*
        </>
      ),
      body: "Your child learns live, 1:1 with an expert teacher, on their very own guitar. With the 96-session, 1-year course.",
      stamp: "FREE",
      terms: YEAR_COURSE_TERMS,
      bg: "bg-gradient-to-r from-[#1f9d7a] via-[#13785e] to-[#0a3f33]",
      dark: "bg-[#06281f]",
    },
  ];
}

// A full-width row of the other Black Friday offers. With more than one, it
// slides by itself every few seconds; visitors can swipe or use the arrows
// and dots. Auto-play pauses on hover, focus or touch and is off for people
// who ask their device for reduced motion.
export default function BlackFridayOffers() {
  const country = useCountry();
  const OFFERS = useMemo(() => offersFor(country), [country]);
  const many = OFFERS.length > 1;
  const [rawIndex, setIndex] = useState(0);
  const index = rawIndex % OFFERS.length;
  const [paused, setPaused] = useState(false);
  const swipeFrom = useRef<number | null>(null);

  function go(i: number) {
    setIndex((i + OFFERS.length) % OFFERS.length);
  }

  useEffect(() => {
    if (!many || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Restarts after each move (index), so a manual move gets a full 6 s.
    const count = OFFERS.length;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTO_MS);
    return () => window.clearInterval(id);
  }, [index, paused, many, OFFERS.length]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl text-white shadow-lg ring-1 ring-white/10"
      aria-roledescription="carousel"
      aria-label="More Black Friday offers"
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
          if (!many || from === null || Math.abs(e.clientX - from) < 40) return;
          go(index + (e.clientX < from ? 1 : -1));
        }}
        className="flex touch-pan-y transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {OFFERS.map((o, i) => (
          <div
            key={o.tag}
            role="group"
            aria-hidden={i !== index}
            aria-roledescription="slide"
            aria-label={`Offer ${i + 1} of ${OFFERS.length}`}
            className={`flex w-full shrink-0 flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between ${many ? "pb-14 sm:pb-14" : ""} ${o.bg}`}
          >
            <div className="min-w-0 md:max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{o.tag}</p>
              <p className="mt-2 text-2xl font-black leading-tight sm:text-4xl">{o.title}</p>
              <p className="mt-2 text-sm font-medium text-white/85 sm:text-base">{o.body}</p>
              <p className="mt-3 text-[11px] leading-snug text-white/65">{o.terms}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4 md:flex-col md:items-end">
              <span className="rotate-6 rounded-xl border-4 border-white px-4 py-1 text-2xl font-black tracking-wider sm:text-3xl">
                {o.stamp}
              </span>
              <Link
                href={BLACK_FRIDAY.demoLink}
                tabIndex={i === index ? 0 : -1}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition hover:scale-[1.03] sm:text-base ${o.dark}`}
              >
                Book a free 30-min demo <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {many ? (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
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
      ) : null}
    </div>
  );
}
