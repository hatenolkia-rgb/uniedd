"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BLACK_FRIDAY, pad, useBlackFriday } from "../lib/blackFriday";

const CLOSED_KEY = "uniedd-bf-toast-closed";

// "Black Friday sale is live" notification on every page: under the navbar on
// phones, bottom-right above the WhatsApp button on larger screens (the
// cookie notice is bottom-left).
// Closing it hides it for the rest of the visit.
export default function BlackFridayToast() {
  const left = useBlackFriday();
  const live = !!left;
  const [show, setShow] = useState(false);

  // Depends on `live`, not the countdown, so the 1-second ticks don't keep
  // restarting the delay.
  useEffect(() => {
    if (!live) return;
    let closed = false;
    try { closed = sessionStorage.getItem(CLOSED_KEY) === "1"; } catch { /* private mode */ }
    if (closed) return;
    const id = window.setTimeout(() => setShow(true), 1200);
    return () => window.clearTimeout(id);
  }, [live]);

  if (!left || !show) return null;

  function close() {
    setShow(false);
    try { sessionStorage.setItem(CLOSED_KEY, "1"); } catch { /* private mode */ }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[60] left-3 right-3 top-24 sm:left-auto sm:right-6 sm:top-auto sm:bottom-40 sm:w-[360px] overflow-hidden rounded-2xl bg-[#0d0b1e] text-white shadow-2xl ring-1 ring-white/10"
    >
      <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-blue)] via-[var(--brand-orange)] to-[#ffcf6b]" />
      <div className="relative p-4 pr-10">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 h-8 w-8 rounded-full text-lg leading-none text-white/60 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffcf6b]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffcf6b] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ffcf6b]" />
          </span>
          Black Friday sale is live
        </p>
        <p className="mt-1.5 text-lg font-bold leading-snug">
          {BLACK_FRIDAY.offer} on live 1:1 classes 🎸🎹🎤
        </p>
        <p className="mt-1 text-xs text-white/60 tabular-nums">
          Ends in {left.d}d {pad(left.h)}h {pad(left.m)}m {pad(left.s)}s
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href={BLACK_FRIDAY.demoLink}
            onClick={close}
            className="flex-1 rounded-full bg-[var(--brand-orange)] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[var(--brand-orange-dark)]"
          >
            Book free demo
          </Link>
          <Link
            href="/#black-friday"
            onClick={close}
            className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
          >
            See offer
          </Link>
        </div>
      </div>
    </div>
  );
}
