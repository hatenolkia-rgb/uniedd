import Link from "next/link";
import PhoneList from "../components/PhoneList";
import { WHATSAPP_URL } from "../lib/site";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
  title: "Privacy Policy | UniEDD",
  description: "How UniEDD collects, uses, and protects your information.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main>
      <Navbar />

      <section className="px-6 pb-24 pt-32 sm:pt-40">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[var(--muted)]">Legal</p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">Last updated: 10 October 2026</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--foreground)]">
            <p>
              UniEDD (&ldquo;UniEDD&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a New Delhi-based
              academy offering live online coaching in music, dance, public speaking, and chess. This Privacy Policy explains
              what information we collect through uniedd.com, how we use it, and the choices you have.
            </p>

            <div>
              <h2 className="text-lg font-semibold mb-2">1. Information we collect</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <span className="font-medium">Contact and enquiry details</span> you submit through our forms:
                  first name, last name, email address, mobile number, the program you&rsquo;re interested in, and your
                  preferred demo date, time, and time zone.
                </li>
                <li>
                  <span className="font-medium">Communication data</span> when you reach us via WhatsApp, phone, or
                  email, including the content of those messages.
                </li>
                <li>
                  <span className="font-medium">Technical data</span> such as browser type, device information, and
                  general usage of our website, collected automatically to keep the site secure and working correctly.
                </li>
                <li>
                  <span className="font-medium">Advertising and analytics data</span>, only if you accept our cookie
                  banner: the Meta Pixel records the pages you visit on our site so we can measure our ads on
                  Facebook and Instagram. See &ldquo;Cookies and tracking&rdquo; below.
                </li>
                <li>
                  <span className="font-medium">Payment data</span> is not collected through the demo booking form,
                  which is currently free for all visitors. Any payment terms for paid programs will be shared before
                  enrolment.
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
              <p className="mt-3">
                By enrolling a child, the parent or guardian consents on the child&rsquo;s behalf to the recording,
                transcription and AI note-taking of their live classes described in section 3. This consent can be
                withdrawn at any time using the contact details below.
              </p>
            </div>

            <div id="class-recordings">
              <h2 className="text-lg font-semibold mb-2">3. Live classes: recordings, transcripts and AI notes</h2>
              <p>
                Our live classes are held on Google Meet, provided through UniEDD&rsquo;s Google Workspace account. To help
                learners revise and to help us maintain teaching quality and safety, each class session is
                automatically:
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1.5">
                <li>
                  <span className="font-medium">recorded</span> (video and audio of everyone who joins, including
                  anything shared on screen and in the meeting chat);
                </li>
                <li>
                  <span className="font-medium">transcribed</span> into a written record of what was said; and
                </li>
                <li>
                  <span className="font-medium">summarised by AI</span>: Google&rsquo;s Gemini &ldquo;Take notes for
                  me&rdquo; feature produces class notes such as a summary, key points and follow-up actions.
                </li>
              </ul>
              <p className="mt-3">
                Google Meet shows everyone in the class when recording, transcription and note-taking are on.
                Recordings, transcripts and notes are stored in UniEDD&rsquo;s Google Workspace (Google Drive).
                Within the UniEDD learning platform (lms.uniedd.com) they are shown only to the learner (and their
                parent or guardian) and teacher of that class, and to authorised UniEDD staff. Each file opens
                through a private link; please do not share these links. Google processes this data on our behalf as
                a service provider under its Google Workspace terms. AI-generated notes can contain mistakes and
                should be read alongside the recording.
              </p>
              <p className="mt-3">
                We use this material only to support the learner&rsquo;s learning, to resolve questions about a class,
                and for quality, safety and training purposes within UniEDD. We do not use class recordings in
                advertising or publicity without separate written consent. Recordings of classes held before October
                2026 were made on Zoom and remain stored with Zoom on the same terms.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">4. How we use your information</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>To respond to enquiries and follow up on demo bookings.</li>
                <li>To schedule and deliver classes, and to communicate about your (or your child&rsquo;s) learning.</li>
                <li>To record, transcribe and take AI notes of live classes, as described in section 3.</li>
                <li>To send confirmation emails and, where relevant, service updates.</li>
                <li>To improve our website, programs, and customer support.</li>
                <li>To meet legal, regulatory, and safety obligations.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">5. Sharing of information</h2>
              <p>
                We do not sell your personal information. We share it only with the service providers who help us
                operate, or where required by law:
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1.5">
                <li>Vercel, which hosts this website.</li>
                <li>Supabase, where demo booking details are held briefly before being sent to our team.</li>
                <li>Resend, which delivers our confirmation emails.</li>
                <li>
                  Google (Google Workspace), which hosts our live classes on Google Meet and stores class recordings,
                  transcripts and AI-generated notes in Google Drive, including notes produced by Gemini.
                </li>
                <li>Zoom, which hosted classes before October 2026 and stores recordings of those classes.</li>
                <li>
                  Meta, which delivers our WhatsApp messages (including the welcome message sent after you book) and,
                  if you accept cookies, receives Meta Pixel data.
                </li>
              </ul>
            </div>

            <div id="tracking">
              <h2 className="text-lg font-semibold mb-2">6. Cookies and tracking</h2>
              <p>
                We use the Meta Pixel to understand how visitors who see our ads use this site. It only loads after you
                select &ldquo;Accept&rdquo; on the cookie banner; if you decline, it is never loaded. Your choice is saved
                in your browser, and you can reset it at any time by clearing this site&rsquo;s data in your browser
                settings. Meta&rsquo;s own use of this data is governed by Meta&rsquo;s Privacy Policy.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">7. Data retention</h2>
              <p>
                We retain enquiry and student information for as long as reasonably necessary to provide our
                services and to meet legal, accounting, or reporting requirements, after which it is deleted or
                anonymised.
              </p>
              <p className="mt-3">
                Class recordings, transcripts and AI notes are kept for up to 12 months after the class, so learners
                can revise, and are then deleted, unless you ask us to delete them sooner or we need to keep a
                specific recording longer to resolve a complaint or meet a legal obligation.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">8. Your rights and choices</h2>
              <p>
                You may ask us to access, correct, or delete the personal information we hold about you or your
                child, or to stop contacting you, at any time by reaching out via the contact details below.
              </p>
              <p className="mt-3">
                You can also ask us to delete a particular class recording, transcript or set of notes, or to stop
                recording, transcribing or taking AI notes in your (or your child&rsquo;s) future classes. We will
                arrange this wherever possible; without recordings, some features such as revisiting past lessons
                will not be available.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">9. Security</h2>
              <p>
                We use reasonable technical and organisational measures to protect the information you share with
                us. No method of transmission or storage is completely secure, and we cannot guarantee absolute
                security.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">10. Changes to this policy</h2>
              <p>
                We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date at the top of this
                page reflects the most recent revision.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">11. Contact us</h2>
              <p>
                For any privacy-related questions or requests, contact us on WhatsApp at{" "}
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-[var(--brand-blue)] hover:underline">
                  +91 83838 57710
                </a>
                , through the enquiry form on our{" "}
                <Link href="/#contact" className="text-[var(--brand-blue)] hover:underline">
                  Contact section
                </Link>
                , or by phone:
              </p>
              <PhoneList className="mt-3 space-y-2" linkClassName="text-[var(--brand-blue)] hover:underline" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
