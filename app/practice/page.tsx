import type { Metadata } from "next";
import {
  FaComments,
  FaGift,
  FaGuitar,
  FaKeyboard,
  FaMagic,
  FaMicrophoneAlt,
  FaMusic,
} from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { SITE_NAME, SITE_URL } from "../lib/site";
import PracticeCta from "./PracticeCta";

const title = "Practice Live | Free AI practice feedback | UniEDD";
const description =
  "Practice Live (Practice Coach) gives friendly AI feedback on Guitar, Piano, Singing, Public Speaking, Ukulele and fun combos. Your first 3 tries are free.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/practice" },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/practice`,
    siteName: SITE_NAME,
    locale: "en_IN",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: { card: "summary_large_image", title, description },
};

const SKILLS = [
  { name: "Guitar", detail: "Strum, pick and play along — then hear what to try next.", Icon: FaGuitar },
  { name: "Piano", detail: "Practice keys and melodies with gentle, clear tips.", Icon: FaKeyboard },
  { name: "Singing", detail: "Warm up your voice and get friendly notes on your song.", Icon: FaMicrophoneAlt },
  { name: "Public Speaking", detail: "Speak out loud and practice sounding confident.", Icon: FaComments },
  { name: "Ukulele", detail: "Small instrument, big smiles — keep the rhythm going.", Icon: FaMusic },
  { name: "Fun combos", detail: "Mix skills, like singing with guitar, in one practice.", Icon: FaMagic },
];

export default function PracticePage() {
  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description,
          url: `${SITE_URL}/practice`,
          about: {
            "@type": "SoftwareApplication",
            name: "Practice Live",
            alternateName: "Practice Coach",
            applicationCategory: "EducationalApplication",
            offers: { "@type": "Offer", description: "First 3 tries free" },
          },
        }}
      />

      <section className="px-6 pt-32 pb-16 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[{ name: "Practice", href: "/practice" }]} />
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-xs text-[var(--muted)] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Practice Live · Practice Coach
          </p>
          <h1
            className="max-w-3xl text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            A cheerful practice buddy{" "}
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">
              that helps you get better
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            Meet Practice Live, also called Practice Coach — a friendly AI helper from UniEDD. Play,
            sing or speak, then get kind feedback that shows what went well and what to try next.
          </p>
          <p className="mt-4 max-w-2xl text-[var(--muted)] leading-relaxed">
            It works for Guitar, Piano, Singing, Public Speaking, Ukulele, and fun combos. Your first
            3 tries are free, so you can jump in and have a go.
          </p>
          <PracticeCta />
        </div>
      </section>

      <section className="px-6 py-20 bg-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">
            What you can practice
          </p>
          <h2
            className="mb-10 text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Pick a skill — or mix a few together
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SKILLS.map(({ Icon, name, detail }) => (
              <div key={name} className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[#f4f9fd] to-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-blue)] text-white">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{name}</h3>
                <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 bg-white">
        <div className="mx-auto max-w-7xl rounded-3xl bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] p-10 text-white sm:p-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
            <FaGift aria-hidden="true" /> First 3 tries free
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Ready to practice?
          </h2>
          <p className="mt-3 max-w-xl text-white/90">
            Open Practice Live, pick what you want to try, and get instant AI feedback. Your first 3
            tries are on us.
          </p>
          <PracticeCta tone="onColor" />
        </div>
      </section>

      <Footer />
    </main>
  );
}
