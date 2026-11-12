import { ogCard, OG_SIZE } from "../lib/ogImage";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "UniEDD free online music games";

export default function Image() {
  return ogCard({
    kicker: "UniEDD Games",
    title: "Free online music games",
    subtitle: "Clap rhythm game, ear training, music theory, guitar and piano quizzes, singing games",
    accent: "#e8962e",
  });
}
