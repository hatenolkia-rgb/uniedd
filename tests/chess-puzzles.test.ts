import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { decode, expected, parseUci, updateRating, type Manifest, type RawPuzzle } from "../app/games/chess/puzzles";
import { GAMES } from "../app/games/catalog";

const dir = join(__dirname, "..", "public", "chess-puzzles");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
const chunk = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as RawPuzzle[];

/** Plays every solution move from the puzzle FEN; throws if any move is illegal. */
function playThrough(raw: RawPuzzle) {
  const p = decode(raw, manifest.themes, "easy");
  const g = new Chess(p.fen);
  for (const u of p.moves) g.move(parseUci(u));
  return { p, g };
}

// small seeded RNG so the sample is the same every run
function rng(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe("chess puzzles data", () => {
  it("has five star levels with chunks sorted by rating inside each level's range", () => {
    expect(manifest.levels.map((l) => l.stars)).toEqual([1, 2, 3, 4, 5]);
    const files = new Set(readdirSync(dir));
    let total = 0;
    for (const l of manifest.levels) {
      expect(l.count).toBeGreaterThan(10000);
      expect(l.chunks.reduce((s, c) => s + c.n, 0)).toBe(l.count);
      for (const c of l.chunks) {
        expect(files.has(c.f)).toBe(true);
        expect(c.min).toBeGreaterThanOrEqual(l.min);
        expect(c.max).toBeLessThan(l.max);
      }
      total += l.count;
    }
    expect(total).toBeGreaterThanOrEqual(100000);
  });

  it("every puzzle in one full chunk per level is legal, with the player's move last", () => {
    for (const l of manifest.levels) {
      const list = chunk(l.chunks[Math.floor(l.chunks.length / 2)].f);
      for (const raw of list) {
        expect(raw[3]).toBeGreaterThanOrEqual(l.min);
        expect(raw[3]).toBeLessThan(l.max);
        const { p } = playThrough(raw);
        expect(p.moves.length % 2).toBe(0); // opponent move + player/opponent pairs, ending on the player's move
      }
    }
  }, 120000);

  it("a 20,000-puzzle random sample across all chunks plays through legally", () => {
    const r = rng(42);
    const all = manifest.levels.flatMap((l) => l.chunks.map((c) => c.f));
    const per = Math.ceil(20000 / all.length);
    let checked = 0;
    for (const f of all) {
      const list = chunk(f);
      for (let i = 0; i < per; i++) {
        playThrough(list[Math.floor(r() * list.length)]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(20000);
  }, 60000);

  it("mate puzzles end in checkmate", () => {
    const mate = manifest.themes.indexOf("mate");
    const list = chunk(manifest.levels[0].chunks[0].f).filter((p) => p[4].includes(mate));
    expect(list.length).toBeGreaterThan(50);
    for (const raw of list) expect(playThrough(raw).g.isCheckmate()).toBe(true);
  });
});

describe("chess puzzle rating", () => {
  it("rises after a solve and falls after a miss, more against weaker puzzles", () => {
    expect(expected(1500, 1500)).toBeCloseTo(0.5);
    expect(updateRating(1500, 1500, true, 100)).toBeGreaterThan(1500);
    expect(updateRating(1500, 1500, false, 100)).toBeLessThan(1500);
    expect(1500 - updateRating(1500, 1000, false, 100)).toBeGreaterThan(1500 - updateRating(1500, 2000, false, 100));
  });

  it("lists the chess games in the catalog", () => {
    expect(GAMES.find((g) => g.slug === "chess-puzzles")?.category).toBe("chess");
    expect(GAMES.find((g) => g.slug === "chess")?.kind).toBe("chess-play");
  });
});

describe("chess puzzle theme filter", () => {
  // serve /chess-puzzles/* from the repo's public folder
  const realFetch = globalThis.fetch;
  const fsFetch = (async (url: string) => {
    const body = readFileSync(join(dir, String(url).replace("/chess-puzzles/", "")), "utf8");
    return new Response(body, { status: 200 });
  }) as typeof fetch;

  it("manifest chunk theme counts add up to the level theme counts", () => {
    for (const l of manifest.levels)
      for (const [i, n] of Object.entries(l.themes)) expect(l.chunks.reduce((s, c) => s + (c.t?.[i] ?? 0), 0)).toBe(n);
  });

  it("returns a puzzle with the chosen theme for every listed theme, level and rating", async () => {
    globalThis.fetch = fsFetch;
    try {
      const { pickPuzzleWithNote, THEME_LABELS, themeCount } = await import("../app/games/chess/puzzles");
      const r = rng(7);
      const themes = Object.keys(THEME_LABELS).filter((t) => manifest.themes.includes(t));
      for (const theme of themes) {
        const idx = manifest.themes.indexOf(theme);
        for (const l of manifest.levels) {
          const { puzzle, note } = await pickPuzzleWithNote(manifest, { level: l.id, theme, rnd: r });
          expect(puzzle.themes, `${theme} @ ${l.id}`).toContain(theme);
          expect(note).toBe(themeCount(l, idx) > 0 ? "exact" : "other-level");
          if (note === "exact") expect(puzzle.level).toBe(l.id);
        }
        for (const rating of [700, 1500, 2600]) {
          const { puzzle } = await pickPuzzleWithNote(manifest, { rating, window: 120, theme, rnd: r });
          expect(puzzle.themes, `${theme} near ${rating}`).toContain(theme);
        }
      }
    } finally {
      globalThis.fetch = realFetch;
    }
  }, 120000);
});
