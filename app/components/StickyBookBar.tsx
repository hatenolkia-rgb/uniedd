"use client";

import Link from "next/link";
import Image from "next/image";
import { useStoredValue } from "../lib/useStoredValue";
import { FaTimes, FaArrowRight, FaWhatsapp } from "react-icons/fa";

const DISMISS_KEY = "uniedd-sticky-bar-dismissed";

// Same free booking form as the homepage's "Book a Demo" section (CTA.tsx),
// so every entry point offers the same thing.
const BOOK_URL = "/#contact";
const WHATSAPP_URL = "https://wa.me/918383857710";

export default function StickyBookBar() {
  const [dismissed, setDismissed] = useStoredValue("sessionStorage", DISMISS_KEY);

  const handleDismiss = () => setDismissed("1");

  return (
    <>
      {/* Phones: an app-style action bar that always stays. It also carries
          WhatsApp, because the floating WhatsApp bubble (layout.tsx) is hidden
          on small screens to keep content clear. */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat with us on WhatsApp"
            className="shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-md"
          >
            <FaWhatsapp size={24} />
          </Link>
          <Link
            href={BOOK_URL}
            className="flex-1 h-12 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full text-[15px] font-semibold shadow-md"
          >
            Book a Free Demo <FaArrowRight size={12} />
          </Link>
        </div>
      </div>

      {dismissed !== "1" && (
        <div className="hidden sm:block fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
            <Image
              src="/logo.png"
              alt=""
              width={2332}
              height={908}
              className="w-20 h-8 object-contain shrink-0"
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)] truncate">Book a Demo</p>
              <p className="text-xs text-[var(--muted)] truncate">Live 1:1 trial class — Guitar, Chess, Dance & more</p>
            </div>

            <Link
              href={BOOK_URL}
              className="shrink-0 inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full text-sm font-semibold shadow-md hover:opacity-90 hover:-translate-y-px transition-all duration-300 whitespace-nowrap"
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
      )}
    </>
  );
}
