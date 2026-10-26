import Link from "next/link";
import Image from "next/image";
import { FaArrowRight, FaMedium } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { publishedPosts, mediumOnlyPosts, postPath, postExcerpt, formatDate } from "../lib/blog";
import { BLOG_POSTS } from "../lib/blogPosts";

// Refreshes hourly: a post goes live on its date, and new Medium posts appear.
export const revalidate = 3600;

export const metadata = {
  title: "Blog: Music, Chess & Public Speaking for Kids | UniEDD",
  description: "Practical guides for parents on music lessons, chess and public speaking for children, from UniEDD's teachers.",
  alternates: { canonical: "/blog" },
};

type Entry = { key: string; title: string; date: string; href: string; external: boolean; image: string | null; excerpt: string };

export default async function BlogPage() {
  const own = publishedPosts();
  const medium = await mediumOnlyPosts(BLOG_POSTS.map((p) => p.title));
  const entries: Entry[] = [
    ...own.map((p) => ({ key: p.slug, title: p.title, date: p.date, href: postPath(p), external: false, image: p.photos[0] ?? null, excerpt: postExcerpt(p) })),
    ...medium.map((m) => ({ key: m.url, title: m.title, date: m.date, href: m.url, external: true, image: m.image, excerpt: m.excerpt })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main>
      <Navbar />

      <section className="px-6 pb-24 pt-32 sm:pt-40">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-[var(--muted)]">Blog</p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Guides for parents from UniEDD&rsquo;s teachers
          </h1>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">
            Music, chess and public speaking for children: when to start, how to practise, and how to choose the right teacher.
          </p>

          {entries.length === 0 ? (
            <p className="mt-16 text-[var(--muted)]">The first posts are on their way.</p>
          ) : (
            <ul className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((e) => {
                const card = (
                  <>
                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[var(--border)]">
                      {e.image && (
                        <Image src={e.image} alt="" fill unoptimized={e.external} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      )}
                    </div>
                    <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]">
                      {e.date && <time dateTime={e.date}>{formatDate(e.date)}</time>}
                      {e.external && (
                        <span className="inline-flex items-center gap-1">
                          · <FaMedium aria-hidden="true" /> On Medium
                        </span>
                      )}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold leading-snug group-hover:text-[var(--brand-blue)] transition-colors" style={{ fontFamily: "var(--font-playfair), serif" }}>
                      {e.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{e.excerpt}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-blue)]">
                      Read {e.external ? "on Medium" : "more"} <FaArrowRight size={11} aria-hidden="true" />
                    </span>
                  </>
                );
                return (
                  <li key={e.key}>
                    {e.external ? (
                      <a href={e.href} target="_blank" rel="noopener" className="group block">{card}</a>
                    ) : (
                      <Link href={e.href} className="group block">{card}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
