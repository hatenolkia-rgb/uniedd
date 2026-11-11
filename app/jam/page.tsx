import type { Metadata } from "next";
import { FaGuitar, FaHeadphones, FaMusic } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../lib/site";
import Link from "next/link";
import JamStudio from "./JamStudio";

const title = "Jam | Free metronome, guitar tuner & backing tracks | UniEDD";
const description =
  "Jam online with UniEDD: metronome with voice counting, live guitar tuner, synthesized backing tracks, and a friendly voice-type finder — free, kid-friendly, no downloads.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/jam" },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/jam`,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: { card: "summary_large_image", title, description },
};

const HIGHLIGHTS = [
  {
    name: "Metronome",
    detail: "BPM dial, tap tempo, accents, subdivisions and voice counting — steady practice for any style.",
    Icon: FaMusic,
  },
  {
    name: "Guitar tuner",
    detail: "Listen through your mic, see cents on a needle, pick standard or alternate tunings, hear a reference tone.",
    Icon: FaGuitar,
  },
  {
    name: "Backing tracks",
    detail: "Pick a key, scale and groove. Drums, bass and chords loop so you can jam along — all synthesized, no copyrighted audio.",
    Icon: FaHeadphones,
  },
];

export default function JamPage() {
  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description,
          url: `${SITE_URL}/jam`,
          about: {
            "@type": "SoftwareApplication",
            name: "UniEDD Jam",
            applicationCategory: "MusicApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        }}
      />

      <section className="px-6 pt-32 pb-10 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[{ name: "Jam", href: "/jam" }]} />
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-xs text-[var(--muted)] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-orange)]" />
            Free practice tools · Metronome · Tuner · Backing · Voice type
          </p>
          <h1
            className="max-w-3xl text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Jam online —{" "}
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">
              keep time, tune up, play along
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            A cheerful practice studio for guitarists and music learners. Use the metronome, check
            your tuning with the mic, or loop a backing track in your key — all in the browser, no
            install needed.
          </p>
        </div>
      </section>

      <section className="px-6 pb-8 bg-white">
        <div className="mx-auto max-w-7xl grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map(({ Icon, name, detail }) => (
            <div
              key={name}
              className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[#f4f9fd] to-white p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-blue)] text-white">
                <Icon size={16} aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-semibold">{name}</h2>
              <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-24 bg-white">
        <div className="mx-auto max-w-7xl">
          <JamStudio />
          <Link
            href="/games/clap-rhythm"
            className="group mt-8 flex flex-col gap-3 rounded-3xl bg-gradient-to-br from-[#0b0820] via-[#1b1446] to-[#2a1240] p-6 text-white shadow-md transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">New · Rhythm game</span>
              <span className="mt-1 block text-xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
                👏 Clap Rhythm — clap along to Jingle Bells, Happy Birthday and more
              </span>
              <span className="mt-1 block text-sm text-white/70">
                The mic hears your claps and scores each one Perfect, Good or Miss. Train your timing like a pro.
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-bold text-[#1b1446] group-hover:scale-105">
              Play →
            </span>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
