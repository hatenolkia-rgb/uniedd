"use client";

import Link from "next/link";
import Image from "next/image";
import { useStoredValue } from "../lib/useStoredValue";
import { FaTimes, FaArrowRight } from "react-icons/fa";

const DISMISS_KEY = "uniedd-sticky-bar-dismissed";

// Same free booking form as the homepage's "Book a Demo" section (CTA.tsx),
// so every entry point offers the same thing.
const BOOK_URL = "/#contact";

export default function StickyBookBar() {
  const [dismissed, setDismissed] = useStoredValue("sessionStorage", DISMISS_KEY);

  if (dismissed === "1") return null;

  const handleDismiss = () => setDismissed("1");

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

        <Link
          href={BOOK_URL}
          className="shrink-0 inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full text-xs sm:text-sm font-semibold shadow-md hover:opacity-90 hover:-translate-y-px transition-all duration-300 whitespace-nowrap"
        >
          Book Now <FaArrowRight size={11} />
        </Link>

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
