import { describe, expect, it } from "vitest";
import { GAMES, getGame, gamesByCategory } from "../app/games/catalog";
import { gameSeo } from "../app/games/seo";
import { TEACHER_APP_URL } from "../app/games/chess/TeacherEmbed";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Play with Teacher catalog and page", () => {
  const game = getGame("chess-teacher")!;

  it("lists Play with Teacher in the chess games section", () => {
    expect(game).toBeDefined();
    expect(game.title).toBe("Play with Teacher");
    expect(game.category).toBe("chess");
    expect(game.kind).toBe("chess-teacher");
    expect(gamesByCategory("chess").some((item) => item.slug === "chess-teacher")).toBe(true);
    expect(GAMES.filter((item) => item.slug === "chess-teacher")).toHaveLength(1);
  });

  it("has search copy that mentions teacher login and student join codes", () => {
    const seo = gameSeo(game);
    expect(seo.title).toMatch(/Play Chess with Your Teacher/i);
    expect(seo.description).toMatch(/join code/i);
    expect(seo.description).toMatch(/teacher/i);
    expect(seo.howTo.join(" ")).toMatch(/lms\.uniedd\.com/i);
    expect(seo.faq.some((item) => /account/i.test(item.question))).toBe(true);
  });

  it("embeds the live Worker app", () => {
    expect(TEACHER_APP_URL).toBe("https://uniedd-chess-teacher.uniedd-games.workers.dev");
    const src = readFileSync(join(__dirname, "../app/games/chess/TeacherEmbed.tsx"), "utf8");
    expect(src).toContain('searchParams.set("embed", "1")');
    expect(src).toContain("data-testid=\"chess-teacher-frame\"");
    expect(src).toContain("data-testid=\"chess-teacher-play\"");
  });
});
