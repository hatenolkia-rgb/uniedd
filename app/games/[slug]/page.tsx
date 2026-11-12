import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Breadcrumbs from "../../components/Breadcrumbs";
import JsonLd from "../../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../../lib/site";
import { GAMES, getGame } from "../catalog";
import { GameScreen } from "../components/GameScreen";
import { categoryLabel, gameSeo } from "../seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return { title: "Game not found | UniEDD" };
  const seo = gameSeo(game);
  const url = `${SITE_URL}/games/${game.slug}`;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
  };
}

export default async function GameSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();
  const seo = gameSeo(game);
  const url = `${SITE_URL}/games/${game.slug}`;
  const related = GAMES.filter((g) => g.category === game.category && g.slug !== game.slug).slice(0, 6);
  const isClap = game.kind === "clap-trainer";

  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": ["VideoGame", "WebApplication"],
          name: game.title,
          description: seo.description,
          url,
          image: `${url}/opengraph-image`,
          genre: seo.genre,
          gamePlatform: "Web browser",
          applicationCategory: "GameApplication",
          operatingSystem: "Any (web browser)",
          inLanguage: "en",
          isAccessibleForFree: true,
          audience: { "@type": "EducationalAudience", educationalRole: "student" },
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        }}
      />
      <section className="px-6 pt-32 pb-10 sm:pt-40 bg-gradient-to-b from-[#fff6ea] to-white">
        <div className={`mx-auto ${isClap ? "max-w-6xl" : "max-w-4xl"}`}>
          <Breadcrumbs items={[{ name: "Games", href: "/games" }, { name: game.title, href: `/games/${game.slug}` }]} />
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {seo.h1}
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">{game.blurb}</p>
        </div>
      </section>
      <section className="px-4 sm:px-6 pb-16 bg-white">
        <div className={`mx-auto ${isClap ? "max-w-6xl" : "max-w-4xl"}`}>
          <GameScreen game={game} />
        </div>
      </section>
      <section className="px-6 pb-24 bg-white" aria-labelledby="about-game">
        <div className="mx-auto max-w-4xl border-t border-[var(--border)] pt-10 text-[var(--foreground)]">
          <h2 id="about-game" className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            About {game.title}
          </h2>
          <p className="mt-3 leading-relaxed text-[var(--muted)]">{seo.intro}</p>
          <h3 className="mt-6 text-lg font-semibold">How to play</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--muted)]">
            {seo.howTo.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <h3 className="mt-6 text-lg font-semibold">Who it&apos;s for</h3>
          <p className="mt-2 text-[var(--muted)]">{seo.goodFor}</p>
          {seo.extra?.map((block) => (
            <div key={block.heading}>
              <h3 className="mt-6 text-lg font-semibold">{block.heading}</h3>
              {block.body.map((para) => (
                <p key={para} className="mt-2 leading-relaxed text-[var(--muted)]">
                  {para}
                </p>
              ))}
            </div>
          ))}
          {related.length ? (
            <>
              <h3 className="mt-8 text-lg font-semibold">More {categoryLabel(game.category).toLowerCase()} games</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {related.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/games/${g.slug}`}
                      className="inline-block rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:border-[var(--brand-blue)]"
                    >
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-8 text-sm text-[var(--muted)]">
            Explore all <Link href="/games" className="font-semibold text-[var(--brand-blue)] hover:underline">free music games</Link>{" "}
            or practise with the free{" "}
            <Link href="/jam" className="font-semibold text-[var(--brand-blue)] hover:underline">metronome, tuner and backing tracks</Link>.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
