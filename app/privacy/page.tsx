import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
  title: "Privacy Policy | UniEDD",
  description: "How UniEDD collects, uses, and protects your information.",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">Last updated: 12 August 2026</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--foreground)]">
            <p>
              UniEDD (&ldquo;UniEDD&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a New Delhi-based
              academy offering live online coaching in music, dance, and public speaking. This Privacy Policy explains
              what information we collect through uniedd.com, how we use it, and the choices you have.
            </p>

            <div>
              <h2 className="text-lg font-semibold mb-2">1. Information we collect</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <span className="font-medium">Contact and enquiry details</span> you submit through our forms:
                  first name, last name, email address, mobile number, and the program you&rsquo;re interested in.
                </li>
                <li>
                  <span className="font-medium">Communication data</span> when you reach us via WhatsApp, phone, or
                  email, including the content of those messages.
                </li>
                <li>
                  <span className="font-medium">Technical data</span> such as browser type, device information, and
                  general usage of our website, collected automatically to keep the site secure and working correctly.
                  This includes an approximate location (derived from IP address) used only to determine whether a
                  demo booking fee applies.
                </li>
                <li>
                  <span className="font-medium">Payment data</span>, for bookings made from India where a demo fee
                  applies. Payments are processed by Razorpay; we do not receive or store your card, UPI, or bank
                  details — only confirmation that a payment was completed.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">2. Children&rsquo;s information</h2>
              <p>
                Many of our programs are designed for learners aged 4 to 17. Where a form is being submitted on
                behalf of a child, we collect that information from a parent or guardian and treat it as personal
                data belonging to the account-holder (the parent/guardian), not the child. We do not knowingly
                collect personal information directly from a child without a parent or guardian&rsquo;s involvement.
                If you believe a child has provided us with information without appropriate consent, contact us
                using the details below and we will delete it.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">3. How we use your information</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>To respond to enquiries and follow up on demo bookings.</li>
                <li>To schedule and deliver classes, and to communicate about your (or your child&rsquo;s) learning.</li>
                <li>To send confirmation emails and, where relevant, service updates.</li>
                <li>To improve our website, programs, and customer support.</li>
                <li>To meet legal, regulatory, and safety obligations.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">4. Sharing of information</h2>
              <p>
                We do not sell your personal information. We may share it with trusted service providers who help us
                operate (for example, email delivery and hosting providers) under obligations to keep it confidential,
                or where required by law.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">5. Data retention</h2>
              <p>
                We retain enquiry and student information for as long as reasonably necessary to provide our
                services and to meet legal, accounting, or reporting requirements, after which it is deleted or
                anonymised.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">6. Your rights and choices</h2>
              <p>
                You may ask us to access, correct, or delete the personal information we hold about you or your
                child, or to stop contacting you, at any time by reaching out via the contact details below.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">7. Security</h2>
              <p>
                We use reasonable technical and organisational measures to protect the information you share with
                us. No method of transmission or storage is completely secure, and we cannot guarantee absolute
                security.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">8. Changes to this policy</h2>
              <p>
                We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date at the top of this
                page reflects the most recent revision.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">9. Contact us</h2>
              <p>
                For any privacy-related questions or requests, contact us on WhatsApp/phone at{" "}
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
              This page is a general-purpose draft and has not been reviewed by a lawyer. Given that UniEDD collects
              information related to minors, we recommend having this policy reviewed against applicable law
              (including India&rsquo;s Digital Personal Data Protection Act) before relying on it as your operative
              privacy policy.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
