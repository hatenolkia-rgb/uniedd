import { ogCard, OG_SIZE } from "../../lib/ogImage";
import { GAMES, getGame } from "../catalog";
import { CATEGORY_SEO } from "../seo";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "UniEDD game";

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return ogCard({ kicker: "UniEDD Games", title: "Music games", subtitle: "Free online music games" });
  return ogCard({
    kicker: `Free online ${CATEGORY_SEO[game.category].noun.toLowerCase()}`,
    title: game.title,
    subtitle: game.blurb,
    accent: game.accent,
  });
}
