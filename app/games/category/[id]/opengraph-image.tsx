import { ogCard, OG_SIZE } from "../../../lib/ogImage";
import { TOPIC_CATEGORIES, gamesByCategory, type CategoryId } from "../../catalog";
import { CATEGORY_SEO } from "../../seo";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "UniEDD game category";

export function generateStaticParams() {
  return TOPIC_CATEGORIES.map((category) => ({ id: category.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = TOPIC_CATEGORIES.find((item) => item.id === id);
  if (!cat) return ogCard({ kicker: "UniEDD Games", title: "Music games", subtitle: "Free online games" });
  const count = gamesByCategory(cat.id as CategoryId).length;
  return ogCard({
    kicker: "Free online games",
    title: `${cat.label} games`,
    subtitle: `${CATEGORY_SEO[cat.id as CategoryId].goodFor} ${count} ${count === 1 ? "game" : "games"} to play in your browser.`,
  });
}
