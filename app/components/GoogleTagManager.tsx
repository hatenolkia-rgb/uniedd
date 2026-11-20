"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useStoredValue } from "../lib/useStoredValue";

const GTM_ID = "GTM-N9VM35P9";
// Same choice as the cookie banner in MetaPixel.tsx.
const CONSENT_KEY = "uniedd-tracking-consent";

type Gtag = (...args: unknown[]) => void;

// Google Tag Manager on every page, with Google Consent Mode: Google may not
// store cookies until the visitor selects "Accept" on the cookie banner.
// Tags still load (cookieless) so GTM can work, and switch to full
// measurement the moment consent is given.
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
    <>
      <Script id="gtm" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
var granted = false;
try { granted = localStorage.getItem('${CONSENT_KEY}') === 'granted'; } catch (e) {}
var state = granted ? 'granted' : 'denied';
gtag('consent', 'default', { ad_storage: state, ad_user_data: state, ad_personalization: state, analytics_storage: state });
gtag('js', new Date());
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
