import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa";
import StickyBookBar from "./components/StickyBookBar";
import { PROGRAMS, programPath } from "./lib/programs";
import { SITE_NAME, SITE_URL, SOCIAL_LINKS, PHONE_NUMBERS } from "./lib/site";
import MetaPixel from "./components/MetaPixel";
import GoogleTagManager from "./components/GoogleTagManager";
import { GOOGLE_TAG_INLINE, GTM_ID } from "./lib/googleTag";
import BlackFridayToast from "./components/BlackFridayToast";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const siteTitle = "UniEDD | Live 1:1 Music, Dance, Chess & Public Speaking Classes";
const siteDescription =
  "UniEDD is a New Delhi-based academy offering live 1-on-1 online classes in Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking, and Chess for kids and adults.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: siteTitle,
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: "/logo.png", width: 2332, height: 908, alt: "UniEDD" }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page use the full screen on phones with a notch; the bottom
  // bar pads itself with the safe-area inset.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: SITE_NAME,
  alternateName: "Universal Education",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: siteDescription,
  areaServed: "New Delhi, India",
  telephone: "+91-8383857710",
  contactPoint: PHONE_NUMBERS.map((phone) => ({
    "@type": "ContactPoint",
    telephone: phone.tel,
    contactType: "customer service",
    areaServed: phone.iso.toUpperCase(),
  })),
  sameAs: ["https://lms.uniedd.com", ...SOCIAL_LINKS.map((social) => social.url)],
  hasCourse: PROGRAMS.map((program) => ({
    "@type": "Course",
    name: program.title,
    url: `${SITE_URL}${programPath(program)}`,
    provider: { "@type": "EducationalOrganization", name: SITE_NAME, sameAs: SITE_URL },
  })),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} antialiased`}
    >
      <head>
        {/* Google tag for container GTM-N9VM35P9 (Google's snippet), at the top of <head> on every page.
            Consent Mode is set first: no Google cookies until "Accept" on the cookie banner. */}
        <script dangerouslySetInnerHTML={{ __html: GOOGLE_TAG_INLINE }} />
        <script async src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
      </head>
      <body className="min-h-screen">
        {/* Passes the cookie-banner choice on to Google Consent Mode. */}
        <GoogleTagManager />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
        <div className="fixed z-40 bottom-20 right-2 md:right-6 hidden sm:flex flex-col gap-4">
          <div className="relative w-14 h-14">
            {/* Ripple Background */}
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ripple"></span>

            {/* WhatsApp Button */}
            <Link
              href="https://wa.me/918383857710"
              target="_blank"
              rel="noreferrer"
              aria-label="Chat with us on WhatsApp"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-[#25D366] hover:scale-110 duration-300"
            >
              <FaWhatsapp className="text-2xl text-white" />
            </Link>
          </div>
        </div>
        <StickyBookBar />
        <MetaPixel />
        {/* Black Friday 2026 (20–30 Nov): "sale is live" notification. Offer text in app/lib/blackFriday.ts. */}
        <BlackFridayToast />
      </body>
    </html>
  );
}
