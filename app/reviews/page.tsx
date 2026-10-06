import type { Metadata } from "next";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import ReviewCard from "../components/ReviewCard";
import { displayedReviews } from "../lib/sampleReviews";
import { PROGRAMS, programPath } from "../lib/programs";
import { SITE_NAME, SITE_URL, WHATSAPP_URL } from "../lib/site";

const title = "Student & Parent Reviews | UniEDD Online Classes";
const description =
  "Read what UniEDD learners and parents say about our live online Guitar, Vocals, Public Speaking, Chess and other classes for kids and adults.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/reviews" },
  openGraph: { title, description, url: `${SITE_URL}/reviews`, siteName: SITE_NAME, locale: "en_IN", type: "website", images: ["/logo.png"] },
  twitter: { card: "summary_large_image", title, description },
};

// No AggregateRating / Review structured data on purpose: Google treats
// reviews a business publishes about itself as self-serving and ignores or
// penalises that markup. Plain, genuine reviews on the page are what count.
export default function ReviewsPage() {
  return (
    <main>
      <Navbar />

      <section className="px-6 pt-32 pb-12 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[{ name: "Reviews", href: "/reviews" }]} />
          <h1 className="max-w-3xl text-4xl sm:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Hear from our <span className="italic text-[var(--brand-blue)]">students</span> and parents
          </h1>
          <p className="mt-5 max-w-2xl text-[var(--muted)] leading-relaxed">
            Feedback from UniEDD learners and their families about our live online classes.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedReviews().map((review, i) => {
            const program = PROGRAMS.find((p) => p.name === review.program);
            return (
              <div key={i} className="flex flex-col">
                <ReviewCard testimonial={review} className="w-full flex-1" />
                {program && (
                  <Link href={programPath(program)} className="mt-3 ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-blue)] hover:underline">
                    About the {program.name.toLowerCase()} program <FaArrowRight size={9} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-6 pb-24 bg-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-[#f8f8f8] p-10 text-center">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Learning with UniEDD?
          </h2>
          <p className="mt-3 text-sm text-[var(--muted)]">
            We&rsquo;d love to hear how it&rsquo;s going. Send us your feedback on WhatsApp and, with your permission, we may share it here.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--border)] bg-white px-6 py-3 text-sm font-semibold hover:border-[#25D366] transition-colors">
              Share your feedback
            </a>
            <Link href="/#contact" className="rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-6 py-3 text-sm font-semibold text-white">
              Book a free demo
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
