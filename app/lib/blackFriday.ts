"use client";

import { useEffect, useState } from "react";

// Black Friday 2026. Edit the offer here; everything hides itself after END.
// Before START, add ?bf=preview to any page address to see it.
export const BLACK_FRIDAY = {
  start: Date.parse("2026-11-17T00:00:00+05:30"),
  end: Date.parse("2026-11-30T23:59:59+05:30"),
  offer: "40% off your child's first two music classes",
  demoLink: "/#contact",
  // The $9-a-session offer in rupees for visitors in India. While this is
  // null, India visitors don't see that offer (no dollar prices for India).
  inrPerSession: null as number | null,
};

export type Countdown = { d: number; h: number; m: number; s: number };

function countdown(now: number): Countdown {
  const ms = Math.max(0, BLACK_FRIDAY.end - now);
  return {
    d: Math.floor(ms / 864e5),
    h: Math.floor((ms % 864e5) / 36e5),
    m: Math.floor((ms % 36e5) / 6e4),
    s: Math.floor((ms % 6e4) / 1e3),
  };
}

// null until mounted (pages are pre-rendered, so the date is checked in the
// browser), then the time left while the sale is on, or null when it isn't.
export function useBlackFriday(): Countdown | null {
  const [left, setLeft] = useState<Countdown | null>(null);
  useEffect(() => {
    const preview = /[?&]bf=preview\b/.test(window.location.search);
    const update = () => {
      const now = Date.now();
      const live = now <= BLACK_FRIDAY.end && (now >= BLACK_FRIDAY.start || preview);
      setLeft(live ? countdown(now) : null);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);
  return left;
}

export const pad = (n: number) => String(n).padStart(2, "0");

// The visitor's country (e.g. "IN"), from /api/geo; "" until known or if
// it can't be told. Cached for the visit.
export function useCountry(): string {
  const [country, setCountry] = useState("");
  useEffect(() => {
    let cached = "";
    try { cached = sessionStorage.getItem("uniedd-country") || ""; } catch { /* private mode */ }
    let alive = true;
    const lookup: Promise<{ country?: string }> = cached
      ? Promise.resolve({ country: cached })
      : fetch("/api/geo").then((r) => (r.ok ? r.json() : { country: "" }));
    lookup
      .then((d) => {
        const c = (d.country || "").toUpperCase();
        if (!alive) return;
        setCountry(c);
        try { if (c) sessionStorage.setItem("uniedd-country", c); } catch { /* private mode */ }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return country;
}
