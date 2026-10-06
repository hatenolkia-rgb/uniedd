import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FaArrowRight } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { PROGRAMS, programPath } from "../lib/programs";
import { PROGRAM_ICONS } from "../lib/programIcons";
import { SITE_NAME, SITE_URL } from "../lib/site";

const title = "Online Music, Dance, Chess & Public Speaking Classes | UniEDD";
const description =
  "Explore UniEDD's live online programs for kids and adults: Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking and Chess. Book a free demo class.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/programs" },
  openGraph: { title, description, url: `${SITE_URL}/programs`, siteName: SITE_NAME, locale: "en_IN", type: "website", images: ["/logo.png"] },
  twitter: { card: "summary_large_image", title, description },
};

export default function ProgramsPage() {
  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "UniEDD programs",
          itemListElement: PROGRAMS.map((program, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}${programPath(program)}`,
            name: program.title,
          })),
        }}
      />

      <section className="px-6 pt-32 pb-12 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[{ name: "Programs", href: "/programs" }]} />
          <h1 className="max-w-3xl text-4xl sm:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Learn what you love, <span className="italic text-[var(--brand-orange)]">one-to-one</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[var(--muted)] leading-relaxed">
            Seven live online programs for kids and adults, each taught by a dedicated mentor at your pace and in your time zone.
            Choose a program to see what you&rsquo;ll learn, how classes work and answers to common questions.
          </p>
        </div>
      </section>

      <section className="px-6 pb-24 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((program) => {
            const Icon = PROGRAM_ICONS[program.name];
            return (
              <Link
                key={program.slug}
                href={programPath(program)}
                className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white hover:border-[var(--brand-blue)]/30 hover:shadow-xl transition-all duration-300"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={program.image}
                    alt={program.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {program.tag && (
                    <span className="absolute top-4 right-4 rounded-full bg-white px-3 py-1 text-xs font-medium shadow-sm">{program.tag}</span>
                  )}
                  <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium">
                    <Icon size={12} className="text-[var(--brand-blue)]" aria-hidden="true" />
                    {program.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="text-lg font-semibold leading-snug text-[var(--brand-blue)]">{program.title}</h2>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">{program.tagline}</p>
                  <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">{program.description}</p>
                  <span className="mt-auto pt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--brand-blue)] transition-colors">
                    View course details <FaArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <Footer />
    </main>
  );
}
