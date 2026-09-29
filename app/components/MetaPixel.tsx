"use client";

import Script from "next/script";
import Link from "next/link";
import { useStoredValue } from "../lib/useStoredValue";

const PIXEL_ID = "1411313724305376";
const CONSENT_KEY = "uniedd-tracking-consent";

// Meta Pixel, loaded only after the visitor opts in via the banner below.
// The choice is remembered in localStorage; if storage is blocked the banner
// shows again on the next page load and nothing loads until they accept.
export default function MetaPixel() {
  // undefined = not read yet (server render / hydration), null = no choice made.
  const [consent, setConsent] = useStoredValue("localStorage", CONSENT_KEY);

  if (consent === "granted") {
    return (
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${PIXEL_ID}');
        fbq('track', 'PageView');`}
      </Script>
    );
  }

  // Hide while storage is unread, and for "denied" (or any unexpected value).
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed z-50 bottom-24 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-sm rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xl"
    >
      <p className="text-xs leading-relaxed text-[var(--foreground)]">
        We&rsquo;d like to use Meta Pixel cookies to measure our ads. Nothing is loaded unless you accept.{" "}
        <Link href="/privacy#tracking" className="text-[var(--brand-blue)] hover:underline">
          Learn more
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setConsent("granted")}
          className="flex-1 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-4 py-2 text-xs font-semibold text-white"
        >
          Accept
        </button>
        <button
          onClick={() => setConsent("denied")}
          className="flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
