import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import Breadcrumbs from "../../../components/Breadcrumbs";
import JsonLd from "../../../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../../../lib/site";
import {
  LEVEL_LABEL,
  TOPIC_CATEGORIES,
  categoryPath,
  gamesByCategory,
  type CategoryId,
} from "../../catalog";
import { CATEGORY_SEO, categoryLabel } from "../../seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOPIC_CATEGORIES.map((category) => ({ id: category.id }));
}

function isCategoryId(id: string): id is CategoryId {
  return TOPIC_CATEGORIES.some((category) => category.id === id);
}

function categoryMeta(id: CategoryId) {
  const cat = TOPIC_CATEGORIES.find((item) => item.id === id)!;
  const seo = CATEGORY_SEO[id];
  const count = gamesByCategory(id).length;
  const title = `Free Online ${cat.label} Games – Play in Your Browser | UniEDD`;
  const description = `${seo.intro} ${count === 1 ? "There is 1 free game" : `There are ${count} free games`} in this collection. ${seo.goodFor}`;
  return { cat, seo, count, title, description };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isCategoryId(id)) return { title: "Games | UniEDD" };
  const { title, description } = categoryMeta(id);
  const url = `${SITE_URL}${categoryPath(id)}`;
  const ogImage = `${url}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: categoryPath(id) },
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
}

export default async function GameCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isCategoryId(id)) notFound();
  const { cat, seo, count, title, description } = categoryMeta(id);
  const games = gamesByCategory(id);
  const url = `${SITE_URL}${categoryPath(id)}`;
  const others = TOPIC_CATEGORIES.filter((item) => item.id !== id);

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
          image: `${url}/opengraph-image`,
          mainEntity: {
            "@type": "ItemList",
            name: `Free online ${cat.label.toLowerCase()} games`,
            numberOfItems: count,
            itemListElement: games.map((game, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: game.title,
              url: `${SITE_URL}/games/${game.slug}`,
            })),
          },
        }}
      />
      <section className="px-6 pt-32 pb-10 sm:pt-40 bg-gradient-to-b from-[#fff6ea] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs
            items={[
              { name: "Games", href: "/games" },
              { name: cat.label, href: categoryPath(id) },
            ]}
          />
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-xs text-[var(--muted)] shadow-sm">
            <span aria-hidden>{cat.emoji}</span>
            {count} {count === 1 ? "game" : "games"} · Free · Play in your browser
          </p>
          <h1
            className="max-w-3xl text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Free online {cat.label.toLowerCase()} games
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">{seo.intro}</p>
          <p className="mt-3 max-w-2xl text-[var(--muted)] leading-relaxed">{seo.goodFor}</p>
        </div>
      </section>
      <section className="px-4 sm:px-6 pb-16 bg-white">
        <div className="mx-auto max-w-7xl">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <li key={game.slug}>
                <Link
                  href={`/games/${game.slug}`}
                  className="group flex h-full flex-col rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                      style={{ background: game.accent }}
                    >
                      {game.minutes}
                    </span>
                    {game.level ? (
                      <span className="inline-flex w-fit items-center rounded-full border border-[var(--border)] bg-[#fff6ea] px-2.5 py-1 text-[11px] font-semibold">
                        {LEVEL_LABEL[game.level]}
                      </span>
                    ) : null}
                  </span>
                  <h2 className="mt-3 text-lg font-semibold group-hover:text-[var(--brand-blue)]">{game.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">{game.blurb}</p>
                  <span className="mt-4 text-sm font-medium text-[var(--brand-orange)]">Play {game.title} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="px-6 pb-24 bg-white">
        <div className="mx-auto max-w-7xl border-t border-[var(--border)] pt-10">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            More game categories
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((item) => (
              <li key={item.id}>
                <Link
                  href={categoryPath(item.id)}
                  className="inline-block rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:border-[var(--brand-blue)]"
                >
                  {item.emoji} {categoryLabel(item.id)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-[var(--muted)]">
            Back to all{" "}
            <Link href="/games" className="font-semibold text-[var(--brand-blue)] hover:underline">
              free online games
            </Link>
            .
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
