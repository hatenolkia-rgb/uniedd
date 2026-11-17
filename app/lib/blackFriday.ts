"use client";

import { useEffect, useState } from "react";

// Black Friday 2026. Edit the offer here; everything hides itself after END.
// Before START, add ?bf=preview to any page address to see it.
export const BLACK_FRIDAY = {
  start: Date.parse("2026-11-20T00:00:00+05:30"),
  end: Date.parse("2026-11-30T23:59:59+05:30"),
  offer: "20% off your first month",
  earlyBird: "Enrol by 27 Nov and get 2 extra classes free",
  demoLink: "/#contact",
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
