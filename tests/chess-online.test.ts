import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLAIM_WIN_MS, QUEUE_STALE_MS, checkMove, newerGame, outcomeOf, replay, resultText, rowToGame, sanList, type OnlineGame } from "../app/games/chess/online";
import { createMemoryStore, hashSecret } from "../app/lib/games/chessStore";
import { POST } from "../app/api/games/chess/route";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("online chess rules", () => {
  it("accepts legal moves and rejects illegal or out-of-turn ones", () => {
    expect(checkMove([], "w", { from: "e2", to: "e4" })).toMatchObject({ ok: true, uci: "e2e4", san: "e4", status: "active" });
    expect(checkMove([], "b", { from: "e7", to: "e5" })).toMatchObject({ ok: false, error: "It isn't your turn." });
    expect(checkMove([], "w", { from: "e2", to: "e5" })).toMatchObject({ ok: false, error: "Illegal move." });
    expect(checkMove(["e2e4"], "b", { from: "e2", to: "e3" })).toMatchObject({ ok: false });
    expect(checkMove([], "w", { from: "e2", to: "e4" }, "resigned")).toMatchObject({ ok: false, error: "The game is over." });
    expect(checkMove(["e2e4", "zz99"], "w", { from: "d2", to: "d4" })).toMatchObject({ ok: false });
  });

  it("detects checkmate (fool's mate) with the right winner", () => {
    const r = checkMove(["f2f3", "e7e5", "g2g4"], "b", { from: "d8", to: "h4" });
    expect(r).toMatchObject({ ok: true, san: "Qh4#", status: "checkmate", result: "0-1" });
  });

  it("detects stalemate, insufficient material and threefold repetition", () => {
    // Shortest known stalemate (Sam Loyd, 10 moves).
    const loyd = ["e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6", "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6"];
    expect(checkMove(loyd, "w", { from: "c8", to: "e6" })).toMatchObject({ ok: true, status: "stalemate", result: "1/2-1/2" });
    const knights = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    expect(outcomeOf(replay(knights))).toMatchObject({ status: "draw", reason: "Draw by threefold repetition" });
    expect(outcomeOf(replay([]))).toMatchObject({ status: "active" });
  });

  it("handles promotion and SAN lists", () => {
    const moves = ["h2h4", "g7g5", "h4g5", "h7h6", "g5h6", "g8f6", "h6h7", "f6g8"];
    expect(checkMove(moves, "w", { from: "h7", to: "g8", promotion: "q" })).toMatchObject({ ok: true, uci: "h7g8q" });
    expect(sanList(["e2e4", "e7e5", "g1f3"])).toEqual(["e4", "e5", "Nf3"]);
  });

  it("maps rows, keeps the newest copy and words results per player", () => {
    const g = rowToGame({ id: "g1", white_name: "A", black_name: "B", moves: ["e2e4"], fen: "x", ply: 1, status: "active", last_move: { from: "e2", to: "e4" } });
    expect(g).toMatchObject({ whiteName: "A", ply: 1, lastMove: { from: "e2", to: "e4" } });
    const older: OnlineGame = { ...g, ply: 0 };
    expect(newerGame(g, older)).toBe(g);
    expect(newerGame(older, g)).toBe(g);
    const done: OnlineGame = { ...g, status: "resigned", result: "1-0" };
    expect(newerGame(g, done)).toBe(done);
    expect(resultText(done, "w")).toMatch(/you win/);
    expect(resultText(done, "b")).toBe("You resigned.");
    expect(resultText({ ...g, status: "stalemate", result: "1/2-1/2", reason: "Stalemate" }, "w")).toBe("Stalemate.");
  });
});

describe("matchmaking (memory store, same rules as the SQL)", () => {
  let t = 1_000_000;
  const now = () => t;
  beforeEach(() => {
    t = 1_000_000;
  });

  it("waits when nobody is there and pairs first-in-first-out", async () => {
    const s = createMemoryStore(now, () => 0.2);
    expect(await s.matchmake("a", "Ann", "ha")).toEqual({ state: "waiting" });
    t += 10;
    expect(await s.matchmake("b", "Ben", "hb")).toMatchObject({ state: "matched" });
    t += 10;
    expect(await s.matchmake("c", "Cat", "hc")).toEqual({ state: "waiting" });
    t += 10;
    await s.matchmake("d", "Dev", "hd");
    t += 10;
    const e = await s.matchmake("e", "Eve", "he");
    expect(e.state).toBe("waiting");
    // a & b were paired together, c & d together; e waits.
    const a = await s.matchmake("a", "Ann", "ha");
    const b = await s.matchmake("b", "Ben", "hb");
    const c = await s.matchmake("c", "Cat", "hc");
    const d = await s.matchmake("d", "Dev", "hd");
    if (a.state !== "matched" || b.state !== "matched" || c.state !== "matched" || d.state !== "matched") throw new Error("not matched");
    expect(a.gameId).toBe(b.gameId);
    expect(c.gameId).toBe(d.gameId);
    expect(a.gameId).not.toBe(c.gameId);
    expect(a.color).not.toBe(b.color);
  });

  it("never matches stale tickets (closed tabs) and cleans them up", async () => {
    const s = createMemoryStore(now);
    await s.matchmake("old", "Old", "ho");
    t += QUEUE_STALE_MS + 1;
    expect(await s.matchmake("new", "New", "hn")).toEqual({ state: "waiting" });
    t += 61_000;
    await s.matchmake("another", "Another", "hx"); // any lobby call runs the cleanup
    expect(await s.cancel("old", "ho")).toEqual({ state: "gone" });
  });

  it("cancel leaves the queue, or returns the game if already matched", async () => {
    const s = createMemoryStore(now);
    await s.matchmake("a", "Ann", "ha");
    expect(await s.cancel("a", "ha")).toEqual({ state: "cancelled" });
    expect(await s.matchmake("b", "Ben", "hb")).toEqual({ state: "waiting" });
    await s.matchmake("c", "Cat", "hc");
    expect((await s.cancel("b", "hb")).state).toBe("matched");
    expect(await s.cancel("b", "wrong")).toEqual({ state: "gone" });
  });

  it("rejects a ticket replayed with the wrong secret", async () => {
    const s = createMemoryStore(now);
    await s.matchmake("a", "Ann", "ha");
    await expect(s.matchmake("a", "Ann", "evil")).rejects.toThrow();
  });

  it("assigns colours at random", async () => {
    let whites = 0;
    for (let i = 0; i < 200; i++) {
      const s = createMemoryStore(now);
      await s.matchmake("a", "A", "ha");
      const r = await s.matchmake("b", "B", "hb");
      if (r.state === "matched" && r.color === "w") whites++;
    }
    expect(whites).toBeGreaterThan(60);
    expect(whites).toBeLessThan(140);
  });

  it("applies moves only for the side to move at the expected ply; claim needs a long absence", async () => {
    const s = createMemoryStore(now, () => 0.1); // first matcher gets white
    await s.matchmake("a", "Ann", "ha");
    const m = await s.matchmake("b", "Ben", "hb");
    if (m.state !== "matched") throw new Error("not matched");
    expect(m.color).toBe("w");
    const mv = { uci: "e2e4", fen: "f", lastMove: { from: "e2", to: "e4" }, status: "active" as const, result: null, reason: null };
    expect(await s.applyMove(m.gameId, "ha", 0, mv)).toBe(false); // black can't start
    expect(await s.applyMove(m.gameId, "hb", 0, mv)).toBe(true);
    expect(await s.applyMove(m.gameId, "hb", 0, mv)).toBe(false); // stale ply
    expect(await s.applyMove(m.gameId, "nobody", 1, mv)).toBe(false);
    expect((await s.getGame(m.gameId))?.moves).toEqual(["e2e4"]);
    expect(await s.endGame(m.gameId, "hb", "claim")).toBe(false);
    t += CLAIM_WIN_MS + 1;
    await s.touch(m.gameId, "hb");
    expect((await s.touch(m.gameId, "hb"))?.opponentIdleMs).toBeGreaterThan(CLAIM_WIN_MS);
    expect(await s.endGame(m.gameId, "hb", "claim")).toBe(true);
    expect(await s.getGame(m.gameId)).toMatchObject({ status: "abandoned", result: "1-0" });
  });
});

describe("chess API route (memory store)", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  let ip = 0;
  async function api(body: Record<string, unknown>) {
    const res = await POST(new Request("http://x/api/games/chess", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": `10.0.0.${ip}` } }));
    return { status: res.status, data: (await res.json()) as Record<string, unknown> & { game?: OnlineGame } };
  }

  it("matches two players and plays fool's mate to checkmate", async () => {
    ip++;
    const p1 = { ticket: crypto.randomUUID(), secret: "secret-one-1234567890" };
    const p2 = { ticket: crypto.randomUUID(), secret: "secret-two-1234567890" };
    expect((await api({ action: "find", name: "no", ...p1 })).status).toBe(400); // name too short
    expect((await api({ action: "find", name: "Player One", ...p1 })).data).toEqual({ state: "waiting" });
    const m2 = (await api({ action: "find", name: "Player Two", ...p2 })).data;
    const m1 = (await api({ action: "find", name: "Player One", ...p1 })).data;
    expect(m2.state).toBe("matched");
    expect(m1.gameId).toBe(m2.gameId);
    const gameId = m1.gameId as string;
    const white = m1.color === "w" ? p1 : p2;
    const black = m1.color === "w" ? p2 : p1;

    const s = await api({ action: "state", gameId, secret: white.secret });
    expect(s.data).toMatchObject({ color: "w", realtime: null });
    expect((await api({ action: "state", gameId, secret: "someone-else-12345678" })).status).toBe(403);

    expect((await api({ action: "move", gameId, secret: black.secret, ply: 0, from: "e7", to: "e5" })).status).toBe(422);
    expect((await api({ action: "move", gameId, secret: white.secret, ply: 0, from: "e2", to: "e5" })).status).toBe(422);
    for (const [who, from, to, ply] of [
      [white, "f2", "f3", 0],
      [black, "e7", "e5", 1],
      [white, "g2", "g4", 2],
    ] as const) {
      expect((await api({ action: "move", gameId, secret: who.secret, ply, from, to })).status).toBe(200);
    }
    expect((await api({ action: "move", gameId, secret: white.secret, ply: 2, from: "a2", to: "a3" })).status).toBe(409);
    const mate = await api({ action: "move", gameId, secret: black.secret, ply: 3, from: "d8", to: "h4" });
    expect(mate.data.game).toMatchObject({ status: "checkmate", result: "0-1", ply: 4 });
    expect((await api({ action: "resign", gameId, secret: white.secret })).data.game).toMatchObject({ status: "checkmate" });
    expect((await api({ action: "move", gameId, secret: white.secret, ply: 4, from: "a2", to: "a3" })).status).toBe(422);
  });

  it("resigns and cancels", async () => {
    ip++;
    const p1 = { ticket: crypto.randomUUID(), secret: "secret-three-1234567" };
    const p2 = { ticket: crypto.randomUUID(), secret: "secret-four-12345678" };
    await api({ action: "find", name: "Third", ...p1 });
    expect((await api({ action: "cancel", ...p1 })).data).toEqual({ state: "cancelled" });
    await api({ action: "find", name: "Third", ...p1 });
    const m = (await api({ action: "find", name: "Fourth", ...p2 })).data;
    const r = await api({ action: "resign", gameId: m.gameId, secret: p2.secret });
    expect(r.data.game).toMatchObject({ status: "resigned", result: m.color === "w" ? "0-1" : "1-0" });
  });
});

describe("chess_multiplayer.sql", () => {
  const sql = readFileSync(join(__dirname, "..", "supabase", "chess_multiplayer.sql"), "utf8");
  it("is idempotent, race-safe, locked down and published for Realtime", () => {
    expect(sql).toMatch(/create table if not exists public\.chess_games/);
    expect(sql).toMatch(/for update skip locked/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.chess_games/);
    expect(sql).not.toMatch(/create policy[^;]*chess_(queue|seats)/i);
    expect(sql).toMatch(/drop policy if exists/);
    expect(hashSecret("a")).not.toBe(hashSecret("b"));
  });
});
