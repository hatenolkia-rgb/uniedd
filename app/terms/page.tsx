import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
  title: "Terms & Conditions | UniEDD",
  description: "The terms that govern your use of UniEDD's website and classes.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main>
      <Navbar />

      <section className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[var(--muted)]">Legal</p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Terms &amp; Conditions
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">Last updated: 12 August 2026</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--foreground)]">
            <p>
              These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of the UniEDD website (uniedd.com) and
              enrolment in UniEDD&rsquo;s live online classes. By using our website or booking a demo or class, you
              agree to these Terms.
            </p>

            <div>
              <h2 className="text-lg font-semibold mb-2">1. Our services</h2>
              <p>
                UniEDD provides live, online, one-to-one and group coaching in Guitar, Keyboard/Piano, Vocals,
                Tabla, Dance, Public Speaking, and Chess, for kids and adults. Demo sessions can be booked online 24/7,
                subject to availability of trainers.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">2. Enrolment and eligibility</h2>
              <p>
                Enrolment for a learner under the age of 18 must be made by a parent or legal guardian, who is
                responsible for the accuracy of information provided and for the learner&rsquo;s conduct during
                classes.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">3. Scheduling and attendance</h2>
              <p>
                Class schedules are agreed with your assigned trainer subject to availability. Rescheduling and
                make-up class policies for missed sessions are communicated separately by our team at the time of
                enrolment and may vary by plan.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">4. Fees and payment</h2>
              <p>
                Plan pricing is displayed on our{" "}
                <Link href="/pricing" className="text-[var(--brand-blue)] hover:underline">
                  Pricing page
                </Link>{" "}
                and is subject to change without prior notice; changes will not affect an already-confirmed billing
                cycle. Payment terms, refund eligibility, and cancellation windows are confirmed at the time of
                enrolment.
              </p>
              <p className="mt-3">
                A one-time demo booking fee of ₹199 applies to visitors booking from India, determined by your
                location at the time of booking; this fee is processed securely via Razorpay. Visitors booking from
                outside India are not charged for the demo session.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">5. Code of conduct</h2>
              <p>
                We expect respectful behaviour from all learners, parents/guardians, and trainers. UniEDD reserves
                the right to suspend or terminate access to classes in cases of abusive behaviour, harassment, or
                misuse of the platform.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">6. Intellectual property</h2>
              <p>
                All course materials, curriculum, branding, and content provided by UniEDD remain the property of
                UniEDD and may not be reproduced or redistributed without permission.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">7. Limitation of liability</h2>
              <p>
                UniEDD strives to deliver a high-quality learning experience but does not guarantee specific
                outcomes or results from participation in its programs. To the extent permitted by law, UniEDD is
                not liable for indirect or incidental damages arising from use of our services.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">8. Privacy</h2>
              <p>
                Our collection and use of personal information is described in our{" "}
                <Link href="/privacy" className="text-[var(--brand-blue)] hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">9. Changes to these Terms</h2>
              <p>
                We may update these Terms from time to time. Continued use of our website or services after changes
                are posted constitutes acceptance of the revised Terms.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">10. Contact us</h2>
              <p>
                Questions about these Terms can be sent to us on WhatsApp/phone at{" "}
                <a href="tel:+918383857710" className="text-[var(--brand-blue)] hover:underline">
                  +91 83838 57710
                </a>{" "}
                or through the enquiry form on our{" "}
                <Link href="/#contact" className="text-[var(--brand-blue)] hover:underline">
                  Contact section
                </Link>
                .
              </p>
            </div>

            <p className="rounded-2xl border border-[var(--border)] bg-[#f7f7f7] p-5 text-xs text-[var(--muted)]">
              This page is a general-purpose draft and has not been reviewed by a lawyer. We recommend having it
              reviewed against applicable consumer-protection and contract law before relying on it as your
              operative terms.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
