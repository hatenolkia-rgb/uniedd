import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaCheckCircle, FaArrowRight, FaWhatsapp, FaChevronDown } from "react-icons/fa";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import CTA from "../../components/CTA";
import Breadcrumbs from "../../components/Breadcrumbs";
import JsonLd from "../../components/JsonLd";
import ProgramMedia from "../../components/ProgramMedia";
import ReviewCard from "../../components/ReviewCard";
import { PROGRAMS, getProgram, programPath } from "../../lib/programs";
import { PROGRAM_ICONS } from "../../lib/programIcons";
import { displayedReviews } from "../../lib/sampleReviews";
import { SITE_NAME, SITE_URL, WHATSAPP_URL } from "../../lib/site";

// Only the programs in lib/programs.ts exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PROGRAMS.map((program) => ({ slug: program.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = getProgram(slug);
  if (!program) return {};

  const url = `${SITE_URL}${programPath(program)}`;
  return {
    title: program.seoTitle,
    description: program.seoDescription,
    alternates: { canonical: programPath(program) },
    openGraph: {
      title: program.seoTitle,
      description: program.seoDescription,
      url,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website",
      images: [{ url: program.image, alt: program.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: program.seoTitle,
      description: program.seoDescription,
      images: [program.image],
    },
  };
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-10">
      <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
        {title}
      </h2>
    </div>
  );
}

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = getProgram(slug);
  if (!program) notFound();

  const Icon = PROGRAM_ICONS[program.name];
  const reviews = displayedReviews().filter((t) => t.program === program.name);
  const others = PROGRAMS.filter((p) => p.slug !== program.slug);
  const url = `${SITE_URL}${programPath(program)}`;

  const facts = [
    { label: "Age group", value: program.ageGroup },
    { label: "Course duration", value: program.duration },
    { label: "Format", value: program.format },
    { label: "Mode", value: "Live online classes" },
  ];

  return (
    <main>
      <Navbar />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: program.title,
          description: program.seoDescription,
          url,
          image: program.image,
          inLanguage: "en",
          educationalLevel: "Beginner to Advanced",
          teaches: program.learn.map((item) => item.title),
          provider: { "@type": "EducationalOrganization", name: SITE_NAME, sameAs: SITE_URL },
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            courseSchedule: { "@type": "Schedule", repeatFrequency: "P1W", duration: "P6M" },
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: program.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: { "@type": "Answer", text: faq.a },
          })),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-32 pb-16 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2">
          <div>
            <Breadcrumbs items={[{ name: "Programs", href: "/programs" }, { name: program.name, href: programPath(program) }]} />
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-xs text-[var(--muted)] shadow-sm">
              <Icon size={12} className="text-[var(--brand-blue)]" aria-hidden="true" />
              {program.category} program
            </p>
            <h1
              className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
              style={{ fontFamily: "var(--font-playfair), serif" }}
            >
              {program.title}
            </h1>
            <p className="mt-4 text-lg text-[var(--brand-orange)] font-medium">{program.tagline}</p>
            <p className="mt-4 text-[var(--muted)] leading-relaxed">{program.description}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[var(--brand-blue)]/20 hover:-translate-y-px transition-all"
              >
                Book a free demo <FaArrowRight size={11} />
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--foreground)] hover:border-[#25D366] transition-colors"
              >
                <FaWhatsapp className="text-[#25D366]" size={16} /> Ask on WhatsApp
              </a>
            </div>
          </div>

          <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-[var(--border)] shadow-2xl shadow-black/10">
            <ProgramMedia
              photo={program.image}
              alt={program.imageAlt}
              video={program.video}
              priority
              sizes="(max-width: 768px) 90vw, 45vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-blue)]/15 via-transparent to-[var(--brand-orange)]/10 pointer-events-none" />
          </div>
        </div>

        {/* Quick facts */}
        <dl className="mx-auto mt-12 grid max-w-7xl grid-cols-2 gap-4 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">{fact.label}</dt>
              <dd className="mt-1.5 text-sm font-semibold text-[var(--foreground)]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Overview */}
      <section className="px-6 py-20 bg-white">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="About the course" title={`Learn ${program.name.toLowerCase()} online, live and one-to-one`} />
          <div className="space-y-5 text-[var(--muted)] leading-relaxed">
            {program.overview.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* What you'll learn */}
      <section className="px-6 py-20 bg-[#f8f8f8]">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Curriculum" title="What you'll learn" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {program.learn.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-white p-6">
                <FaCheckCircle className="text-[var(--brand-blue)]" size={18} aria-hidden="true" />
                <h3 className="mt-4 font-semibold text-[var(--foreground)]">{item.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning journey + who it's for */}
      <section className="px-6 py-20 bg-white">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Your path" title="From first class to confident performer" />
            <ol className="relative space-y-6 border-l-2 border-[var(--border)] pl-8">
              {program.journey.map((step, i) => (
                <li key={step.stage} className="relative">
                  <span className="absolute -left-[45px] flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-orange)] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-[var(--foreground)]">{step.stage}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <SectionHeading eyebrow="Who it's for" title="Is this program right for you?" />
            <ul className="space-y-4">
              {program.forWho.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--foreground)]">
                  <FaCheckCircle className="mt-0.5 shrink-0 text-[var(--brand-orange)]" size={15} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Reviews for this program */}
      {reviews.length > 0 && (
        <section className="px-6 py-20 bg-[#f8f8f8]">
          <div className="mx-auto max-w-7xl">
            <SectionHeading eyebrow="Reviews" title={`What ${program.name.toLowerCase()} learners say`} />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review, i) => (
                <ReviewCard key={i} testimonial={review} className="w-full" />
              ))}
            </div>
            <Link href="/reviews" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-blue)] hover:underline">
              Read all reviews <FaArrowRight size={11} />
            </Link>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="px-6 py-20 bg-white">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="FAQ" title={`${program.name} classes: common questions`} />
          <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
            {program.faqs.map((faq) => (
              <details key={faq.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <FaChevronDown size={12} className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Other programs */}
      <section className="px-6 py-16 bg-[#f8f8f8]">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-6 text-xl font-semibold">Explore other programs</h2>
          <div className="flex flex-wrap gap-3">
            {others.map((other) => {
              const OtherIcon = PROGRAM_ICONS[other.name];
              return (
                <Link
                  key={other.slug}
                  href={programPath(other)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm text-[var(--foreground)] hover:border-[var(--brand-blue)]/50 hover:text-[var(--brand-blue)] transition-colors"
                >
                  <OtherIcon size={13} className="text-[var(--brand-blue)]" aria-hidden="true" />
                  {other.name}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CTA defaultProgram={program.name} />
      <Footer />
    </main>
  );
}
