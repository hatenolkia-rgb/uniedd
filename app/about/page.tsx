import type { Metadata } from "next";
import Link from "next/link";
import { FaArrowRight, FaUserFriends, FaGlobeAsia, FaChalkboardTeacher, FaRoute, FaLaptop, FaChartLine, FaHome, FaShieldAlt } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import JsonLd from "../components/JsonLd";
import { PROGRAMS, programPath } from "../lib/programs";
import { PROGRAM_ICONS } from "../lib/programIcons";
import { SITE_NAME, SITE_URL, STATS, PHONE_DISPLAY, PHONE_TEL, WHATSAPP_URL, REGISTRATIONS } from "../lib/site";

const title = "About UniEDD | Digital Online Music Academy for Kids & Adults";
const description =
  "UniEDD is a digital online music academy from New Delhi. Live one-to-one Guitar, Keyboard, Vocals and Tabla classes, plus Dance, Chess and Public Speaking.";

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

const DIGITAL = [
  {
    Icon: FaLaptop,
    title: "Live digital classrooms",
    detail: "Every lesson happens live over video, so your mentor sees, hears and corrects you in real time.",
  },
  {
    Icon: FaChartLine,
    title: "Digital progress tracking",
    detail: "Classes, practice and progress live in your UniEDD learning portal, so you always know what's next.",
  },
  {
    Icon: FaHome,
    title: "Learn from home",
    detail: "No travel, no fixed studio hours. All you need is your instrument, a device and an internet connection.",
  },
  {
    Icon: FaGlobeAsia,
    title: "Borderless learning",
    detail: "A digital academy has no city limits. Learners join from around the world, in their own time zone.",
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
          about: { "@type": "EducationalOrganization", name: SITE_NAME, url: SITE_URL, description: "Digital online music academy" },
        }}
      />

      <section className="px-6 pt-32 pb-16 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[{ name: "About us", href: "/about" }]} />
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-xs text-[var(--muted)] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Digital-first online music academy
          </p>
          <h1 className="max-w-3xl text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            A digital music academy,{" "}
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">taught one-to-one</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            UniEDD (Universal Education) is a New Delhi-based online music academy built for the digital age. We teach Guitar,
            Keyboard, Vocals and Tabla through live one-to-one digital classes, alongside Dance, Public Speaking and Chess, so kids
            and adults can learn what they love from anywhere.
          </p>
          <p className="mt-4 max-w-2xl text-[var(--muted)] leading-relaxed">
            Instead of a studio you have to travel to, our classroom is digital: live video lessons with a dedicated mentor, a
            learning portal for your classes and progress, and a practice plan to follow between sessions.
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

      {/* Government registrations */}
      <section className="px-6 pb-4 bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2">
            {REGISTRATIONS.map((reg) => (
              <div key={reg.title} className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[#f4f9fd] to-white p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF9933]/20 via-white to-[#138808]/20 text-[#0b3d91]">
                  <FaShieldAlt size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{reg.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{reg.detail}</p>
                  {reg.number && (
                    <p className="mt-1.5 text-xs font-medium text-[var(--foreground)]">
                      {reg.numberLabel} <span className="font-mono">{reg.number}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 bg-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">Digital learning</p>
          <h2 className="mb-4 text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Why learn music at a digital academy?
          </h2>
          <p className="mb-10 max-w-2xl text-[var(--muted)] leading-relaxed">
            A digital music academy brings an expert mentor to you, wherever you are. You get the personal attention of a
            one-to-one lesson with the flexibility of learning online.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DIGITAL.map(({ Icon, title, detail }) => (
              <div key={title} className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[#f4f9fd] to-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-blue)] text-white">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
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
