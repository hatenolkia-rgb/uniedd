import { ogCard, OG_SIZE } from "../lib/ogImage";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "UniEDD Jam: free metronome, guitar tuner and backing tracks";

export default function Image() {
  return ogCard({
    kicker: "UniEDD Jam",
    title: "Free metronome, tuner & backing tracks",
    subtitle: "Practise and jam online in your browser — plus a clap rhythm game",
    accent: "#1a9fd4",
  });
}
