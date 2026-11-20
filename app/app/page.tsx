import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Breadcrumbs from "../components/Breadcrumbs";
import { SITE_NAME, SITE_URL } from "../lib/site";

// Keep in sync with public/app/latest.json (the in-app updater reads that file).
const VERSION = "0.2.0";
const SIZE_MB = 133;
const SHA256 = "4a5b792d4e154777a3d193a19b9efa3c6f1b9a163451867e3a4836d215eb894e";
const APK = `/app/uniedd-${VERSION}.apk`;

const title = "UNIEDD Android App | Music Games, Chess & Classes";
const description =
  "Download the UNIEDD Android app: tanpura & tabla, piano falling notes, clap rhythm, tuner, 400,000 chess puzzles and Stockfish chess. Everything works offline; sign in to see your classes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/app" },
  openGraph: { title, description, url: `${SITE_URL}/app`, siteName: SITE_NAME, locale: "en_IN", type: "website", images: ["/logo.png"] },
  twitter: { card: "summary_large_image", title, description },
};

const FEATURES = [
  ["🪕", "Tanpura & Tabla", "Recorded tanpura in every key with tabla in 11 taals, 30–300 BPM."],
  ["🎹", "Piano Falling Notes", "Play on screen, with a MIDI keyboard, or on your real piano through the mic."],
  ["👏", "Clap Rhythm", "Clap with songs and taals; the mic scores every clap."],
  ["♟️", "Chess", "8 computer levels (top levels by Stockfish), 400,000 puzzles and online games."],
  ["🎯", "Tuner & Metronome", "Practice tools that work without internet."],
  ["📚", "Classes", "Sign in with your UNIEDD portal account to see your classes and join links."],
];

export default function AppDownloadPage() {
  return (
    <main>
      <Navbar />
      <section className="px-6 pt-32 pb-16 sm:pt-40 bg-gradient-to-b from-[#f4f9fd] to-white">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={[{ name: "Android app", href: "/app" }]} />
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
            The UNIEDD app for Android
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            Music games, riyaz tools and chess that run on your phone or tablet, even offline. Only classes, leaderboards and online
            chess use the internet.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={APK}
              download
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-blue)] px-7 py-3.5 font-semibold text-white shadow-lg transition hover:opacity-90"
            >
              Download APK · v{VERSION} · ~{SIZE_MB} MB
            </a>
            <span className="text-sm text-[var(--muted)]">Android 7.0 or newer · free</span>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(([icon, name, detail]) => (
              <li key={name} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
                <p className="text-2xl">{icon}</p>
                <p className="mt-2 font-semibold">{name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
              </li>
            ))}
          </ul>

          <div className="mt-12 rounded-2xl border border-[var(--border)] bg-white p-6 text-sm leading-relaxed text-[var(--muted)]">
            <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">How to install</h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Tap <strong>Download APK</strong> on your Android phone or tablet.</li>
              <li>Open the downloaded file. If asked, allow your browser to <em>install unknown apps</em>.</li>
              <li>Tap <strong>Install</strong>. The app checks this page for updates and offers them inside the app.</li>
            </ol>
            <p className="mt-4 break-all">
              SHA-256: <code>{SHA256}</code>
            </p>
            <p className="mt-2">
              Chess levels 6–8 use Stockfish 19 (GPLv3), shipped as a separate program inside the app. Source:{" "}
              <a className="underline" href="https://github.com/official-stockfish/Stockfish">github.com/official-stockfish/Stockfish</a>.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
