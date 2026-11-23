import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  GAMES,
  TOPIC_CATEGORIES,
  categoryPath,
  gamesByCategory,
  gamesByLevel,
  getGame,
  relatedGames,
} from "../app/games/catalog";
import { CATEGORY_SEO, GAMES_HUB_FAQ, GAMES_HUB_SEO, faqJsonLd, gameSeo, videoGameJsonLd } from "../app/games/seo";
import { SITE_URL } from "../app/lib/site";
import sitemap from "../app/sitemap";
import robots from "../app/robots";

describe("games catalog placement", () => {
  const lumenfall = getGame("lumenfall")!;

  it("lists Lumenfall first, in Adventure, as a beginner game", () => {
    expect(GAMES[0]?.slug).toBe("lumenfall");
    expect(lumenfall).toBeDefined();
    expect(lumenfall.category).toBe("adventure");
    expect(lumenfall.level).toBe("beginner");
    expect(gamesByCategory("adventure")[0]?.slug).toBe("lumenfall");
    expect(gamesByLevel("beginner")[0]?.slug).toBe("lumenfall");
  });

  it("puts Adventure first among topic categories", () => {
    expect(CATEGORIES[0]?.id).toBe("all");
    expect(CATEGORIES[1]?.id).toBe("adventure");
    expect(TOPIC_CATEGORIES[0]?.id).toBe("adventure");
    expect(categoryPath("adventure")).toBe("/games/category/adventure");
  });

  it("still has a unique slug for every game", () => {
    expect(GAMES).toHaveLength(37);
    expect(new Set(GAMES.map((game) => game.slug)).size).toBe(37);
  });

  it("returns related games even when a category has only one title", () => {
    const related = relatedGames(lumenfall, 6);
    expect(related.length).toBe(6);
    expect(related.some((game) => game.slug === "piano-falling-notes")).toBe(true);
    expect(related.every((game) => game.slug !== "lumenfall")).toBe(true);
  });
});

describe("games SEO copy and JSON-LD", () => {
  it("gives Lumenfall a unique beginner-adventure title and genre", () => {
    const seo = gameSeo(getGame("lumenfall")!);
    expect(seo.title).toMatch(/Play Lumenfall Free Online/i);
    expect(seo.title).toMatch(/Beginner Adventure/i);
    expect(seo.description).toMatch(/free online/i);
    expect(seo.description).toMatch(/beginner/i);
    expect(seo.genre).toEqual(["Adventure", "Music", "Educational"]);
    expect(seo.faq.length).toBeGreaterThanOrEqual(3);
    expect(seo.howTo.length).toBeGreaterThanOrEqual(3);
  });

  it("describes the games hub for music, piano, chess and kids learning queries", () => {
    expect(GAMES_HUB_SEO.title).toMatch(/Free Online Music, Piano, Chess/i);
    expect(GAMES_HUB_SEO.description).toMatch(/browser/i);
    expect(GAMES_HUB_FAQ.length).toBeGreaterThanOrEqual(3);
  });

  it("covers every category with search copy", () => {
    for (const category of TOPIC_CATEGORIES) {
      expect(CATEGORY_SEO[category.id], category.id).toBeDefined();
      expect(CATEGORY_SEO[category.id].genre.length).toBeGreaterThan(0);
    }
  });

  it("emits VideoGame/SoftwareApplication JSON-LD without invented ratings", () => {
    const data = videoGameJsonLd(getGame("lumenfall")!);
    expect(data["@type"]).toEqual(["VideoGame", "SoftwareApplication"]);
    expect(data.genre).toContain("Adventure");
    expect(data.educationalLevel).toBe("Beginner");
    expect(data.isAccessibleForFree).toBe(true);
    expect(data.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "INR" });
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("review");
    expect(JSON.stringify(data)).not.toMatch(/ratingValue/);
    expect(String(data.url)).toMatch(/^https:\/\/www\.uniedd\.com\/games\/lumenfall$/);
  });

  it("emits FAQ structured data that matches the on-page questions", () => {
    const faqs = gameSeo(getGame("lumenfall")!).faq;
    const data = faqJsonLd(faqs);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(faqs.length);
    expect(data.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: faqs[0].question,
      acceptedAnswer: { "@type": "Answer", text: faqs[0].answer },
    });
  });
});

describe("sitemap, robots and canonical host", () => {
  it("uses the live www host", () => {
    expect(SITE_URL).toBe("https://www.uniedd.com");
    expect(robots().sitemap).toBe("https://www.uniedd.com/sitemap.xml");
  });

  it("lists the games hub, every game, every category and practice", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${SITE_URL}/games`);
    expect(urls).toContain(`${SITE_URL}/practice`);
    expect(urls).toContain(`${SITE_URL}/games/category/adventure`);
    expect(urls).toContain(`${SITE_URL}/games/category/piano`);
    expect(urls).toContain(`${SITE_URL}/games/category/chess`);
    expect(urls).toContain(`${SITE_URL}/games/category/rhythm`);
    for (const game of GAMES) {
      expect(urls).toContain(`${SITE_URL}/games/${game.slug}`);
    }
    const lumenfall = entries.find((entry) => entry.url === `${SITE_URL}/games/lumenfall`);
    expect(lumenfall?.priority).toBe(0.7);
  });
});
