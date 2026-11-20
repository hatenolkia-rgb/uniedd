// Shared by app/layout.tsx (server) and components/GoogleTagManager.tsx.
export const GTM_ID = "GTM-N9VM35P9";
// Same choice as the cookie banner in MetaPixel.tsx.
export const CONSENT_KEY = "uniedd-tracking-consent";

// Google's tag for this container (dataLayer + gtag), with Consent Mode set
// first: ad and analytics storage stay denied until the visitor selects
// "Accept" on the cookie banner. app/layout.tsx puts this in <head> on every
// page, followed by gtm.js.
export const GOOGLE_TAG_INLINE = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
var ueGranted = false;
try { ueGranted = localStorage.getItem('${CONSENT_KEY}') === 'granted'; } catch (e) {}
var ueState = ueGranted ? 'granted' : 'denied';
gtag('consent', 'default', { ad_storage: ueState, ad_user_data: ueState, ad_personalization: ueState, analytics_storage: ueState });
gtag('js', new Date());`;

