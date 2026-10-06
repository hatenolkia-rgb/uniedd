import type { Metadata } from "next";
import Link from "next/link";
import { FaArrowRight, FaUserFriends, FaGlobeAsia, FaChalkboardTeacher, FaRoute } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { PROGRAMS, programPath } from "../lib/programs";
import { PROGRAM_ICONS } from "../lib/programIcons";
import { SITE_NAME, SITE_URL, STATS, PHONE_DISPLAY, PHONE_TEL, WHATSAPP_URL } from "../lib/site";

const title = "About UniEDD | Live 1:1 Online Classes for Kids & Adults";
const description =
  "UniEDD is a New Delhi-based academy offering live one-to-one online classes in music, dance, chess and public speaking for learners of every age, worldwide.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { title, description, url: `${SITE_URL}/about`, siteName: SITE_NAME, locale: "en_IN", type: "website", images: ["/logo.png"] },
  twitter: { card: "summary_large_image", title, description },
};

const VALUES = [
  {
    Icon: FaUserFriends,
    title: "Truly personal",
    detail: "Every learner gets a dedicated mentor and a plan built around their goals, pace and schedule.",
  },
  {
    Icon: FaChalkboardTeacher,
    title: "Always live",
    detail: "Classes happen in real time, so mistakes are corrected as they happen, not weeks later.",
  },
  {
    Icon: FaGlobeAsia,
    title: "Any time zone",
    detail: "Learners join from around the world, with classes scheduled at times that suit them.",
  },
  {
    Icon: FaRoute,
    title: "Clear progress",
    detail: "Structured levels, regular feedback and a practice routine keep every learner moving forward.",
  },
];

const STEPS = [
  { title: "Book a free demo", detail: "Tell us your age, interest and goals, and pick a time that suits you." },
  { title: "Meet your mentor", detail: "Try a 30-minute live session and get matched with the right mentor for you." },
  { title: "Start learning", detail: "Join live weekly classes with a practice plan to follow between sessions." },
];

export default function AboutPage() {
  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: title,
          description,
          url: `${SITE_URL}/about`,
          about: { "@type": "EducationalOrganization", name: SITE_NAME, url: SITE_URL },
        }}
      />

      <section className="px-6 pt-32 pb-16 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[{ name: "About us", href: "/about" }]} />
          <h1 className="max-w-3xl text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Music, dance &amp; confidence,{" "}
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">taught one-to-one</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            UniEDD (Universal Education) is a New Delhi-based academy offering live online classes in Guitar, Keyboard, Vocals,
            Tabla, Dance, Public Speaking and Chess. We help kids and adults discover what they love and grow in skill and
            confidence, one live class at a time.
          </p>

          <dl className="mt-12 grid max-w-3xl grid-cols-3 gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
                <dd className="text-3xl font-bold text-[var(--foreground)]">{stat.value}</dd>
                <dt className="mt-1 text-xs uppercase tracking-wider text-[var(--muted)]">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="px-6 py-20 bg-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">Why UniEDD</p>
          <h2 className="mb-10 text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Personal mentorship for creative growth
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ Icon, title, detail }) => (
              <div key={title} className="rounded-2xl border border-[var(--border)] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-blue)]/15 to-[var(--brand-orange)]/15 text-[var(--brand-blue)]">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 bg-[#f8f8f8]">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">How it works</p>
          <h2 className="mb-10 text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Getting started takes three steps
          </h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-[var(--border)] bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-orange)] text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 py-20 bg-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">Our programs</p>
          <h2 className="mb-10 text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Seven ways to learn something you love
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRAMS.map((program) => {
              const Icon = PROGRAM_ICONS[program.name];
              return (
                <Link
                  key={program.slug}
                  href={programPath(program)}
                  className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] p-5 hover:border-[var(--brand-blue)]/40 hover:shadow-lg transition-all"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{program.name}</span>
                    <span className="block text-xs text-[var(--muted)]">{program.showcaseLine}</span>
                  </span>
                  <FaArrowRight size={11} className="text-[var(--muted)] transition-transform group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 bg-white">
        <div className="mx-auto max-w-7xl rounded-3xl bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] p-10 text-white sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Ready to start?
          </h2>
          <p className="mt-3 max-w-xl text-white/90">
            Book a free 30-minute demo, or talk to us on WhatsApp or by phone at{" "}
            <a href={`tel:${PHONE_TEL}`} className="font-semibold underline underline-offset-2">{PHONE_DISPLAY}</a>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#contact" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[var(--foreground)] hover:-translate-y-px transition-transform">
              Book a free demo <FaArrowRight size={11} />
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/60 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
