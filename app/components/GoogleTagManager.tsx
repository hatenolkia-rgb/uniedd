"use client";

import { useEffect } from "react";
import { useStoredValue } from "../lib/useStoredValue";
import { CONSENT_KEY, GTM_ID } from "../lib/googleTag";

type Gtag = (...args: unknown[]) => void;

// Tells Google Consent Mode when the visitor accepts or declines on the
// cookie banner, without a page reload. Also the no-JavaScript fallback.
export default function GoogleTagManager() {
  const [consent] = useStoredValue("localStorage", CONSENT_KEY);

  useEffect(() => {
    if (consent === undefined) return;
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (!gtag) return;
    const state = consent === "granted" ? "granted" : "denied";
    gtag("consent", "update", {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  }, [consent]);

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
