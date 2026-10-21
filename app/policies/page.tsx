import Link from "next/link";
import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { POLICY_SECTIONS } from "../lib/policies";
import { WHATSAPP_URL } from "../lib/site";

export const metadata = {
  title: "Cancellation, Rescheduling & Refund Policy | UniEDD",
  description: "UniEDD's class cancellation, rescheduling, refund and data policies for live online classes.",
  alternates: {
    canonical: "/policies",
  },
};

export default function PoliciesPage() {
  return (
    <main>
      <Navbar />

      <section className="px-6 pb-24 pt-32 sm:pt-40">
        <div className="mx-auto max-w-3xl">
          <Image src="/logo.png" className="mb-8 h-12 w-32 object-contain" alt="UniEDD logo" width={2332} height={908} />
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[var(--muted)]">Legal</p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Cancellation, Rescheduling &amp; Refund Policy
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">Last updated: 22 October 2026</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--foreground)]">
            <p>
              Our teachers keep each class slot for your child, so these rules help us be fair to every family and
              every teacher. Parents agree to them before paying for a package.
            </p>

            {POLICY_SECTIONS.map((section, i) => (
              <div key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="mb-2 text-lg font-semibold">
                  {i + 1}. {section.title}
                </h2>
                <p>{section.text}</p>
              </div>
            ))}

            <div>
              <h2 className="mb-2 text-lg font-semibold">{POLICY_SECTIONS.length + 1}. How to cancel, reschedule or ask for a refund</h2>
              <p>
                Use the Reschedule section of your{" "}
                <a href="https://lms.uniedd.com" target="_blank" rel="noreferrer" className="text-[var(--brand-blue)] hover:underline">
                  UniEDD dashboard
                </a>
                , or message us on{" "}
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-[var(--brand-blue)] hover:underline">
                  WhatsApp
                </a>
                . The time we receive your message is the time that counts. See also our{" "}
                <Link href="/terms" className="text-[var(--brand-blue)] hover:underline">
                  Terms &amp; Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-[var(--brand-blue)] hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
