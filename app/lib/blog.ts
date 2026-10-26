import { BLOG_POSTS, type BlogPost } from "./blogPosts";
import { SOCIAL_LINKS } from "./site";

// The blog has two sources:
//  - our own posts (lib/blogPosts.ts), shown in full on uniedd.com/blog and
//    live from their date (India time);
//  - the Medium feed, for posts written only on Medium. Medium copies of our
//    own posts are left out so each post appears once, pointing here.

export const BLOG_REVALIDATE_SECONDS = 3600;

const MEDIUM_URL = SOCIAL_LINKS.find((s) => s.name === "Medium")?.url ?? "";
const MEDIUM_FEED = MEDIUM_URL ? MEDIUM_URL.replace("medium.com/", "medium.com/feed/") : "";

export function todayIST(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function publishedPosts(now = new Date()): BlogPost[] {
  const today = todayIST(now);
  return BLOG_POSTS.filter((p) => p.date <= today).sort((a, b) => b.date.localeCompare(a.date));
}

export function getPublishedPost(slug: string, now = new Date()): BlogPost | undefined {
  return publishedPosts(now).find((p) => p.slug === slug);
}

export const postPath = (post: Pick<BlogPost, "slug">) => `/blog/${post.slug}`;

export function postExcerpt(post: BlogPost, length = 170): string {
  const text = post.sections.flatMap((s) => s.paragraphs ?? []).join(" ");
  return text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, "")}…` : text;
}

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

export type MediumPost = { title: string; url: string; date: string; image: string | null; excerpt: string };

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ");
const cdata = (s: string) => s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
const tag = (item: string, name: string) => {
  const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? cdata(m[1]) : "";
};
const sameTitle = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/…$/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const [x, y] = [n(a), n(b)];
  return x === y || x.startsWith(y) || y.startsWith(x);
};

// Posts on Medium that aren't copies of ours, newest first. Refreshed hourly;
// if Medium can't be reached the blog still shows our own posts.
export async function mediumOnlyPosts(ownTitles: string[]): Promise<MediumPost[]> {
  if (!MEDIUM_FEED) return [];
  try {
    const res = await fetch(MEDIUM_FEED, { next: { revalidate: BLOG_REVALIDATE_SECONDS }, headers: { "User-Agent": "Mozilla/5.0 (uniedd.com blog)" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1).map((chunk) => chunk.split("</item>")[0]);
    return items
      .map((item): MediumPost => {
        const content = tag(item, "content:encoded");
        // Medium redirects /max/<width>/ picture links to /v2/resize:fit:<width>/;
        // use that form directly (the page loads it unoptimised).
        const image = content.match(/<img[^>]+src="(https:\/\/cdn-images-1\.medium\.com\/[^"]+)"/)?.[1]?.replace(/\/max\/\d+\//, "/v2/resize:fit:800/") ?? null;
        const text = decode(content.replace(/<figcaption[\s\S]*?<\/figcaption>/g, " ").replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        const pub = new Date(tag(item, "pubDate"));
        return {
          title: decode(tag(item, "title")),
          url: tag(item, "link").split("?")[0],
          date: isNaN(pub.getTime()) ? "" : todayIST(pub),
          image,
          excerpt: text.length > 170 ? `${text.slice(0, 170).replace(/\s+\S*$/, "")}…` : text,
        };
      })
      .filter((p) => p.title && p.url.startsWith("https://medium.com/") && !ownTitles.some((t) => sameTitle(t, p.title)));
  } catch {
    return [];
  }
}
