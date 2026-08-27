"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { FaTimes, FaArrowRight } from "react-icons/fa";

const DISMISS_KEY = "uniedd-sticky-bar-dismissed";

export default function StickyBookBar() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // Private browsing / storage blocked — just keep the bar visible.
    }
  }, []);

  // Don't show it on the booking page itself, or once dismissed for this session.
  if (dismissed || pathname === "/book-trial") return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore — worst case it reappears on next page load.
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <Image
          src="/logo.png"
          alt=""
          width={2332}
          height={908}
          className="hidden sm:block w-20 h-8 object-contain shrink-0"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)] truncate">Book a Demo</p>
          <p className="text-xs text-[var(--muted)] truncate">Live 1:1 trial class — Guitar, Chess, Dance & more</p>
        </div>

        <a
          href="/book-trial"
          className="shrink-0 inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full text-xs sm:text-sm font-semibold shadow-md hover:opacity-90 hover:-translate-y-px transition-all duration-300 whitespace-nowrap"
        >
          Book Now <FaArrowRight size={11} />
        </a>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
        >
          <FaTimes size={13} />
        </button>
      </div>
    </div>
  );
}
