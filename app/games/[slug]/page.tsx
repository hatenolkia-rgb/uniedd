import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Breadcrumbs from "../../components/Breadcrumbs";
import JsonLd from "../../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../../lib/site";
import { GAMES, getGame } from "../catalog";
import { GameScreen } from "../components/GameScreen";

export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return { title: "Game not found | UniEDD" };
  const title = `${game.title} | UniEDD Games`;
  return {
    title,
    description: game.blurb,
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: {
      title,
      description: game.blurb,
      url: `${SITE_URL}/games/${game.slug}`,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website",
      images: ["/logo.png"],
    },
  };
}

export default async function GameSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: game.title,
          description: game.blurb,
          url: `${SITE_URL}/games/${game.slug}`,
          applicationCategory: "GameApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <section className="px-6 pt-32 pb-10 sm:pt-40 bg-gradient-to-b from-[#fff6ea] to-white">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={[{ name: "Games", href: "/games" }, { name: game.title, href: `/games/${game.slug}` }]} />
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {game.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">{game.blurb}</p>
        </div>
      </section>
      <section className="px-4 sm:px-6 pb-24 bg-white">
        <div className="mx-auto max-w-4xl">
          <GameScreen game={game} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
