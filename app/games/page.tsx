import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../lib/site";
import GamesHub from "./GamesHub";
import Link from "next/link";
import { CATEGORIES, GAMES } from "./catalog";
import { GAMES_HUB_SEO } from "./seo";

const title = GAMES_HUB_SEO.title;
const description = GAMES_HUB_SEO.description;

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
          image: `${SITE_URL}/games/opengraph-image`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: GAMES.length,
            itemListElement: GAMES.map((g, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: g.title,
              url: `${SITE_URL}/games/${g.slug}`,
            })),
          },
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
            Free online music games &{" "}
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

      <section className="px-6 pb-24 bg-white" aria-labelledby="all-games">
        <div className="mx-auto max-w-7xl border-t border-[var(--border)] pt-10">
          <h2 id="all-games" className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            All music games by topic
          </h2>
          <p className="mt-3 max-w-3xl text-[var(--muted)] leading-relaxed">
            Every game is free and plays in your web browser on a phone, tablet or computer. Try the{" "}
            <Link href="/games/clap-rhythm" className="font-semibold text-[var(--brand-blue)] hover:underline">
              Clap Rhythm game
            </Link>{" "}
            to clap along to songs and nursery rhymes, sharpen your ear with music theory and ear training games, or
            practise the guitar fretboard, piano keys and singing.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.filter((c) => c.id !== "all").map((c) => {
              const list = GAMES.filter((g) => g.category === c.id);
              if (!list.length) return null;
              return (
                <div key={c.id}>
                  <h3 className="font-semibold">
                    {c.label} games
                  </h3>
                  <p className="text-sm text-[var(--muted)]">{c.hint}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {list.map((g) => (
                      <li key={g.slug}>
                        <Link href={`/games/${g.slug}`} className="text-[var(--brand-blue)] hover:underline">
                          {g.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
