import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Breadcrumbs from "../../components/Breadcrumbs";
import JsonLd from "../../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../../lib/site";
import { GAMES, LEVEL_LABEL, categoryPath, getGame, relatedGames } from "../catalog";
import { GameScreen } from "../components/GameScreen";
import { categoryLabel, faqJsonLd, gameSeo, videoGameJsonLd } from "../seo";
import ChessGame from "../chess/ChessGame";
import KaraokeMaker from "../karaoke/KaraokeMaker";
import TanpuraTabla from "../tanpura/TanpuraTabla";
import LumenfallEmbed from "../lumenfall/LumenfallEmbed";

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
  const ogImage = `${url}/opengraph-image`;
  const twitterImage = `${url}/twitter-image`;
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
      images: [{ url: ogImage, width: 1200, height: 630, alt: seo.h1 }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [twitterImage],
    },
  };
}

export default async function GameSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();
  const seo = gameSeo(game);
  const related = relatedGames(game, 6);
  const isChess = game.category === "chess";
  const isClap = game.kind === "clap-trainer" || game.kind === "piano-fall" || game.kind === "pick-coach" || game.kind === "karaoke-maker" || game.kind === "tanpura-tabla" || game.kind === "lumenfall" || isChess;

  return (
    <main>
      <Navbar />
      <JsonLd data={videoGameJsonLd(game)} />
      <JsonLd data={faqJsonLd(seo.faq)} />
      <section className="px-6 pt-32 pb-10 sm:pt-40 bg-gradient-to-b from-[#fff6ea] to-white">
        <div className={`mx-auto ${isClap ? "max-w-6xl" : "max-w-4xl"}`}>
          <Breadcrumbs
            items={[
              { name: "Games", href: "/games" },
              { name: categoryLabel(game.category), href: categoryPath(game.category) },
              { name: game.title, href: `/games/${game.slug}` },
            ]}
          />
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {seo.h1}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Link href={categoryPath(game.category)} className="rounded-full border border-[var(--border)] bg-white px-3 py-1 hover:border-[var(--brand-blue)]">
              {categoryLabel(game.category)}
            </Link>
            {game.level ? (
              <span className="rounded-full border border-[var(--border)] bg-[#fff6ea] px-3 py-1 font-semibold">
                {LEVEL_LABEL[game.level]}
              </span>
            ) : null}
          </p>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">{game.blurb}</p>
        </div>
      </section>
      <section className="px-4 sm:px-6 pb-16 bg-white">
        <div className={`mx-auto ${isClap ? "max-w-6xl" : "max-w-4xl"}`}>
          {isChess ? <ChessGame kind={game.kind} /> : game.kind === "karaoke-maker" ? <KaraokeMaker /> : game.kind === "tanpura-tabla" ? <TanpuraTabla /> : game.kind === "lumenfall" ? <LumenfallEmbed game={game} /> : <GameScreen game={game} />}
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
          {seo.faq.length ? (
            <>
              <h3 id="faq" className="mt-8 text-lg font-semibold">Frequently asked questions</h3>
              <dl className="mt-2 divide-y divide-[var(--border)]">
                {seo.faq.map((item) => (
                  <div key={item.question} className="py-3">
                    <dt className="font-medium">{item.question}</dt>
                    <dd className="mt-1 text-[var(--muted)] leading-relaxed">{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {related.length ? (
            <>
              <h3 className="mt-8 text-lg font-semibold">More games to play</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                See all{" "}
                <Link href={categoryPath(game.category)} className="font-semibold text-[var(--brand-blue)] hover:underline">
                  {categoryLabel(game.category).toLowerCase()} games
                </Link>
                , or try a related game:
              </p>
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
            {isChess ? (
              <>
                Want a coach? See UniEDD&apos;s{" "}
                <Link href="/programs/chess" className="font-semibold text-[var(--brand-blue)] hover:underline">online chess classes for kids and adults</Link>.{" "}
              </>
            ) : game.category === "piano" || game.category === "adventure" ? (
              <>
                Want piano lessons? See UniEDD&apos;s{" "}
                <Link href="/programs/keyboard" className="font-semibold text-[var(--brand-blue)] hover:underline">online keyboard classes</Link>.{" "}
              </>
            ) : game.category === "guitar" ? (
              <>
                Want a guitar coach? See UniEDD&apos;s{" "}
                <Link href="/programs/guitar" className="font-semibold text-[var(--brand-blue)] hover:underline">online guitar classes</Link>.{" "}
              </>
            ) : null}
            Explore all <Link href="/games" className="font-semibold text-[var(--brand-blue)] hover:underline">free online games</Link>{" "}
            or practise with the free{" "}
            <Link href="/jam" className="font-semibold text-[var(--brand-blue)] hover:underline">metronome, tuner and backing tracks</Link>.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
