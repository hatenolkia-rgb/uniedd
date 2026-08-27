import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BookTrialForm from "../components/BookTrialForm";

const title = "Book a Free Trial | UniEDD";
const description =
  "Book your live 1-on-1 trial class with UniEDD in three quick steps — Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking, or Chess.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/book-trial",
  },
  openGraph: {
    title,
    description,
    url: "https://uniedd.com/book-trial",
  },
  twitter: {
    title,
    description,
  },
};

export default function BookTrialPage() {
  return (
    <main>
      <Navbar />

      <section className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[var(--muted)]">Book a Free Trial</p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Your first class,{" "}
            <span className="italic text-[var(--brand-orange)]">three steps away</span>
          </h1>
        </div>

        <BookTrialForm />
      </section>

      <Footer />
    </main>
  );
}
