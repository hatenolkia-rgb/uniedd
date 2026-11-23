import { ogCard, OG_SIZE } from "../lib/ogImage";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "UniEDD free online music games";

export default function Image() {
  return ogCard({
    kicker: "UniEDD Games",
    title: "Free online music games",
    subtitle: "Beginner adventure, piano, guitar, rhythm, music theory and chess — play free in your browser",
    accent: "#e8962e",
  });
}
