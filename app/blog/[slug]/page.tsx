import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FaArrowRight, FaWhatsapp } from "react-icons/fa";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import JsonLd from "../../components/JsonLd";
import { getPublishedPost, publishedPosts, postPath, formatDate } from "../../lib/blog";
import { SITE_NAME, SITE_URL, SOCIAL_LINKS, WHATSAPP_URL } from "../../lib/site";

// Posts go live on their date (India time): pages are built for the posts
// already out and rendered on request for later ones, refreshed hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  return publishedPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | UniEDD Blog`,
    description: post.description,
    keywords: post.tags,
    alternates: { canonical: postPath(post) },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}${postPath(post)}`,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "article",
      publishedTime: post.date,
      images: post.photos[0] ? [{ url: post.photos[0] }] : [],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: post.photos.slice(0, 1) },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  if (!post) notFound();

  const more = publishedPosts().filter((p) => p.slug !== post.slug).slice(0, 3);
  // First photo after the opening, second about halfway, as in the Word files.
  const half = Math.max(2, Math.floor(post.sections.length / 2));

  return (
    <main>
      <Navbar />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          image: post.photos.map((p) => `${SITE_URL}${p}`),
          keywords: post.tags.join(", "),
          mainEntityOfPage: `${SITE_URL}${postPath(post)}`,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } },
        }}
      />

      <article className="px-6 pb-20 pt-32 sm:pt-40">
        <div className="mx-auto max-w-3xl">
          <nav className="text-sm text-[var(--muted)]">
            <Link href="/blog" className="hover:text-[var(--brand-blue)]">Blog</Link>
          </nav>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {post.title}
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            <time dateTime={post.date}>{formatDate(post.date)}</time> · UniEDD
          </p>

          <div className="mt-10 space-y-6 text-[17px] leading-relaxed">
            {post.sections.map((section, i) => (
              <div key={i} className="space-y-4">
                {section.heading && (
                  <h2 className="pt-4 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif" }}>
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}
                {section.list && (
                  <ul className="list-disc space-y-2 pl-6 marker:text-[var(--brand-orange)]">
                    {section.list.map((item, j) => <li key={j}>{item}</li>)}
                  </ul>
                )}
                {(i === 0 || i === half) && post.photos[i === 0 ? 0 : 1] && (
                  <div className="relative my-8 aspect-[3/2] overflow-hidden rounded-2xl bg-[var(--border)]">
                    <Image src={post.photos[i === 0 ? 0 : 1]} alt={`A UniEDD student learning online`} fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" priority={i === 0} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-[var(--border)] p-6 sm:p-8">
            <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-playfair), serif" }}>Try a free 1:1 demo class</p>
            <p className="mt-2 text-[var(--muted)]">
              A live 30-minute online class with a UniEDD teacher, at a time that suits your time zone. No payment needed.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/#contact" className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-blue)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--brand-blue-dark)] transition-colors">
                Book a free demo <FaArrowRight size={11} aria-hidden="true" />
              </Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:border-[var(--brand-blue)] transition-colors">
                <FaWhatsapp aria-hidden="true" /> Ask on WhatsApp
              </a>
            </div>
            <p className="mt-6 text-sm text-[var(--muted)]">
              Follow UniEDD:{" "}
              {SOCIAL_LINKS.map((s, i) => (
                <span key={s.name}>
                  {i > 0 && " · "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand-blue)]">{s.name}</a>
                </span>
              ))}
            </p>
          </div>

          {more.length > 0 && (
            <div className="mt-16">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--muted)]">More from the blog</p>
              <ul className="mt-4 space-y-3">
                {more.map((p) => (
                  <li key={p.slug}>
                    <Link href={postPath(p)} className="text-lg hover:text-[var(--brand-blue)]" style={{ fontFamily: "var(--font-playfair), serif" }}>
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </article>

      <Footer />
    </main>
  );
}
