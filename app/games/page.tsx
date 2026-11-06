import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../lib/site";
import GamesHub from "./GamesHub";
import { GAMES } from "./catalog";

const title = "Games | Fun music quizzes & ear training | UniEDD";
const description =
  "Kid-friendly music games for guitar, piano, vocals, theory and more — timed quizzes, ear training, fretboard practice and weekly leaderboards. Free on UniEDD.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/games" },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/games`,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function GamesPage() {
  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: `${SITE_URL}/games`,
          numberOfItems: GAMES.length,
        }}
      />

      <section className="px-6 pt-32 pb-10 sm:pt-40 bg-gradient-to-b from-[#fff6ea] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[{ name: "Games", href: "/games" }]} />
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-xs text-[var(--muted)] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-orange)]" />
            Fun stuff · {GAMES.length} games · Leaderboards
          </p>
          <h1
            className="max-w-3xl text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Games &{" "}
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">
              fun stuff
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            Quick, colorful practice games for guitar, piano, vocals, music theory and more.
            Race the clock, keep a streak, and climb this week’s leaderboard — no downloads,
            original sounds only.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-24 bg-white">
        <div className="mx-auto max-w-7xl">
          <GamesHub />
        </div>
      </section>

      <Footer />
    </main>
  );
}
