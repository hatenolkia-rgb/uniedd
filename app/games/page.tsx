import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../lib/site";
import GamesHub from "./GamesHub";
import Link from "next/link";
import { GAMES, LEVEL_LABEL, TOPIC_CATEGORIES, categoryPath, gamesByCategory, gamesByLevel } from "./catalog";
import { GAMES_HUB_FAQ, GAMES_HUB_SEO, faqJsonLd } from "./seo";

const title = GAMES_HUB_SEO.title;
const description = GAMES_HUB_SEO.description;
const url = `${SITE_URL}/games`;
const ogImage = `${url}/opengraph-image`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/games" },
  openGraph: {
    title,
    description,
    url,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
  },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
};

const beginners = gamesByLevel("beginner");

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
          url,
          image: ogImage,
          mainEntity: {
            "@type": "ItemList",
            name: "Free online UniEDD games",
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
      <JsonLd data={faqJsonLd(GAMES_HUB_FAQ)} />

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
            Free online music, piano, chess &amp;{" "}
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">
              kids learning games
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            Play right away in your browser — no download and no account needed. Start with{" "}
            <Link href="/games/lumenfall" className="font-semibold text-[var(--brand-blue)] hover:underline">
              Lumenfall
            </Link>
            , a beginner adventure music game, or browse piano, rhythm, guitar, theory and chess games for kids and
            adults.
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
            Every game is free and plays in your web browser on a phone, tablet or computer. Begin with the{" "}
            <Link href={categoryPath("adventure")} className="font-semibold text-[var(--brand-blue)] hover:underline">
              adventure games
            </Link>
            , including{" "}
            <Link href="/games/lumenfall" className="font-semibold text-[var(--brand-blue)] hover:underline">
              Lumenfall
            </Link>
            , a beginner story you play with piano, guitar or your voice. Turn any song into a sing-along backing track
            in your own key with the{" "}
            <Link href="/games/karaoke-maker" className="font-semibold text-[var(--brand-blue)] hover:underline">
              Karaoke Maker
            </Link>{" "}
            (it removes the vocals and changes the key, and your song never leaves your device). Practise singing and
            riyaz with the{" "}
            <Link href="/games/tanpura-tabla" className="font-semibold text-[var(--brand-blue)] hover:underline">
              Tanpura &amp; Tabla
            </Link>{" "}
            studio — a tanpura drone in any key with tabla in Teentaal, Keherwa, Dadra, Rupak, Jhaptaal, Ektaal and
            more. Try the{" "}
            <Link href="/games/clap-rhythm" className="font-semibold text-[var(--brand-blue)] hover:underline">
              Clap Rhythm game
            </Link>{" "}
            to clap along to songs and nursery rhymes, play songs on a real or on-screen keyboard in the{" "}
            <Link href="/games/piano-falling-notes" className="font-semibold text-[var(--brand-blue)] hover:underline">
              falling-notes piano game
            </Link>
            , learn chords and alternate picking at your own pace with the{" "}
            <Link href="/games/alternate-picking" className="font-semibold text-[var(--brand-blue)] hover:underline">
              alternate picking and strumming coach
            </Link>
            , sharpen your ear with music theory and ear training games, or practise the guitar fretboard, piano keys
            and singing. Chess fans can solve{" "}
            <Link href="/games/chess-puzzles" className="font-semibold text-[var(--brand-blue)] hover:underline">
              free chess puzzles by difficulty
            </Link>
            ,{" "}
            <Link href="/games/chess" className="font-semibold text-[var(--brand-blue)] hover:underline">
              play chess against the computer
            </Link>{" "}
            or{" "}
            <Link href="/games/chess-online" className="font-semibold text-[var(--brand-blue)] hover:underline">
              online against other players
            </Link>
            .
          </p>
          {beginners.length ? (
            <div className="mt-8">
              <h3 className="font-semibold">Beginner games</h3>
              <p className="text-sm text-[var(--muted)]">Start here if you are new to music games or want a gentler first round.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {beginners.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/games/${g.slug}`} className="text-[var(--brand-blue)] hover:underline">
                      {g.title}
                    </Link>
                    <span className="text-[var(--muted)]">
                      {" "}
                      — {LEVEL_LABEL[g.level!]} {TOPIC_CATEGORIES.find((c) => c.id === g.category)?.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TOPIC_CATEGORIES.map((c) => {
              const list = gamesByCategory(c.id);
              if (!list.length) return null;
              return (
                <div key={c.id}>
                  <h3 className="font-semibold">
                    <Link href={categoryPath(c.id)} className="hover:text-[var(--brand-blue)]">
                      {c.label} games
                    </Link>
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

          <h2 id="games-faq" className="mt-14 text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Frequently asked questions
          </h2>
          <dl className="mt-4 max-w-3xl divide-y divide-[var(--border)]">
            {GAMES_HUB_FAQ.map((item) => (
              <div key={item.question} className="py-4">
                <dt className="font-semibold">{item.question}</dt>
                <dd className="mt-2 text-[var(--muted)] leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Footer />
    </main>
  );
}
