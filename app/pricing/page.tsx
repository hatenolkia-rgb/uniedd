import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const pricingTitle = "Pricing | UniEDD";
const pricingDescription =
  "Flexible monthly plans for UniEDD's live 1-on-1 online classes in Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking, and Chess.";

export const metadata: Metadata = {
  title: pricingTitle,
  description: pricingDescription,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: pricingTitle,
    description: pricingDescription,
    url: "https://uniedd.com/pricing",
  },
  twitter: {
    title: pricingTitle,
    description: pricingDescription,
  },
};

export default function PricingPage() {
  return (
    <main>
      <Navbar />

      <section className="px-6 pb-20 pt-32">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[var(--muted)]">UniEDD Pricing</p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Flexible plans for every kind of learner
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[var(--muted)]">
            From first steps in music to advanced performance coaching, your learning journey is built around personalised support and consistent growth.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
          {[
            {
              name: "Foundation",
              price: "₹1,499",
              note: "/month",
              details: [
                "2 live sessions every week",
                "Beginner-friendly structure",
                "Practice roadmap and feedback",
                "Parent progress updates",
              ],
            },
            {
              name: "Performance",
              price: "₹2,499",
              note: "/month",
              details: [
                "3 live sessions every week",
                "Goal-based custom coaching",
                "Performance and recital prep",
                "Priority mentor support",
              ],
            },
            {
              name: "Elite",
              price: "₹3,999",
              note: "/month",
              details: [
                "4 live sessions every week",
                "Advanced mentorship",
                "Stage confidence and audition prep",
                "Full personalised growth plan",
              ],
            },
          ].map((plan) => (
            <div key={plan.name} className="rounded-3xl border border-[var(--border)] bg-white p-8 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">{plan.name}</p>
              <div className="mt-5">
                <span className="text-2xl font-bold">Contact us for pricing</span>
              </div>

              <ul className="mt-7 space-y-3 text-sm text-[var(--foreground)]">
                {plan.details.map((detail) => (
                  <li key={detail} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-xs font-bold">
                      ✓
                    </span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>

              <a
                href="https://wa.me/918383857710"
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-5 py-3 text-sm font-semibold text-white"
              >
                Get Pricing on WhatsApp
              </a>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
