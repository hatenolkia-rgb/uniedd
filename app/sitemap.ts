import type { MetadataRoute } from "next";
import { PROGRAMS, programPath } from "./lib/programs";
import { SITE_URL } from "./lib/site";
import { publishedPosts, postPath } from "./lib/blog";

// Rebuilt daily so blog posts are listed once they go live.
export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/programs`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    ...PROGRAMS.map((program) => ({
      url: `${SITE_URL}${programPath(program)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/reviews`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/blog`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    ...publishedPosts().map((post) => ({
      url: `${SITE_URL}${postPath(post)}`,
      lastModified: new Date(`${post.date}T10:00:00+05:30`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/policies`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
