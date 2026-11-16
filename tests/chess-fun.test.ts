import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { newerGame, rowToGame } from "../app/games/chess/online";
import { REACTIONS, REACTION_COOLDOWN_MS, addReaction, isReactionId, mergeReactions, parseReactions, takeNewReactions } from "../app/games/chess/reactions";
import { BOARD_THEMES, PIECE_SETS, getPieceSet, getTheme, pieceEmoji } from "../app/games/chess/themes";
import { majorCapture, squarePercent } from "../app/games/chess/captures";
import { createMemoryStore } from "../app/lib/games/chessStore";
import { POST } from "../app/api/games/chess/route";

describe("board themes and piece sets", () => {
  it("has unique ids, a classic default and falls back for unknown ids", () => {
    expect(new Set(BOARD_THEMES.map((t) => t.id)).size).toBe(BOARD_THEMES.length);
    expect(BOARD_THEMES.length).toBeGreaterThanOrEqual(10);
    expect(getTheme("nope").id).toBe("classic");
    expect(getTheme("matrix").name).toMatch(/Matrix/);
    expect(getPieceSet(null).id).toBe("classic");
  });

  it("emoji sets cover all six pieces with distinct emoji", () => {
    for (const set of PIECE_SETS.filter((p) => p.emoji)) {
      const vals = Object.values(set.emoji!);
      expect(vals).toHaveLength(6);
      expect(new Set(vals).size).toBe(6);
    }
    expect(pieceEmoji(getPieceSet("animals"), "wN")).toBe("🐴");
    expect(pieceEmoji(getPieceSet("animals"), "bK")).toBe("🦁");
    expect(pieceEmoji(getPieceSet("classic"), "wK")).toBeNull();
  });
});

describe("emoji reactions", () => {
  it("only accepts allowlisted ids and enforces the cooldown", () => {
    expect(isReactionId("wave")).toBe(true);
    expect(isReactionId("<script>")).toBe(false);
    expect(addReaction(undefined, "w", "free text", 1000, "abcd1234")).toMatchObject({ ok: false });
    const a = addReaction(undefined, "w", "wave", 1000, "abcd1234");
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = addReaction(a.reactions, "w", "fire", 1000 + REACTION_COOLDOWN_MS - 1, "abcd1235");
    expect(b).toMatchObject({ ok: false, retryMs: 1 });
    const c = addReaction(a.reactions, "b", "fire", 1001, "abcd1236"); // the other player isn't blocked
    expect(c.ok && c.reactions).toMatchObject({ w: { e: "wave" }, b: { e: "fire" } });
    expect(addReaction(a.reactions, "w", "fire", 1000 + REACTION_COOLDOWN_MS, "abcd1237").ok).toBe(true);
  });

  it("parses rx from last_move, dropping anything not on the allowlist", () => {
    expect(parseReactions({ w: { e: "wave", id: "abcd1234", at: 5 }, b: { e: "rude", id: "x1234", at: 5 } })).toEqual({ w: { e: "wave", id: "abcd1234", at: 5 } });
    expect(parseReactions({ w: { e: "wave", id: "<b>", at: 5 } })).toBeUndefined();
    const g = rowToGame({ id: "g", ply: 1, last_move: { from: "e2", to: "e4", rx: { b: { e: "gg", id: "abcd1234", at: 9 } } } });
    expect(g.lastMove).toEqual({ from: "e2", to: "e4" });
    expect(g.reactions).toEqual({ b: { e: "gg", id: "abcd1234", at: 9 } });
    expect(rowToGame({ id: "g", last_move: { rx: { w: { e: "wave", id: "abcd1234", at: 1 } } } }).lastMove).toBeNull();
  });

  it("newerGame keeps the newest reaction at the same position, and identity when nothing changed", () => {
    const base = rowToGame({ id: "g", ply: 2, last_move: { from: "e7", to: "e5" } });
    expect(newerGame(base, { ...base })).toBe(base);
    const withRx = { ...base, reactions: { w: { e: "wave" as const, id: "abcd1234", at: 10 } } };
    expect(newerGame(base, withRx).reactions).toEqual(withRx.reactions);
    expect(newerGame(withRx, base).reactions).toEqual(withRx.reactions);
    expect(mergeReactions({ w: { e: "wave", id: "aaaa1", at: 1 } }, { w: { e: "fire", id: "bbbb2", at: 2 } })?.w?.e).toBe("fire");
  });

  it("takeNewReactions reports each reaction once", () => {
    const seen = new Set<string>();
    const rx = { w: { e: "wave" as const, id: "abcd1234", at: 2 }, b: { e: "gg" as const, id: "efgh5678", at: 1 } };
    expect(takeNewReactions(rx, seen).map((r) => r.side)).toEqual(["b", "w"]);
    expect(takeNewReactions(rx, seen)).toEqual([]);
  });

  it("all reactions are distinct", () => {
    expect(new Set(REACTIONS.map((r) => r.emoji)).size).toBe(REACTIONS.length);
  });
});

describe("reactions in the memory store and API", () => {
  let t = 5_000_000;
  it("stores reactions per seat, rate-limits and clears them on the next move", async () => {
    const s = createMemoryStore(() => t, () => 0.2);
    await s.matchmake("t1", "Ann", "ha");
    const m = await s.matchmake("t2", "Bob", "hb");
    if (m.state !== "matched") throw new Error("not matched");
    const id = m.gameId;
    expect(await s.react(id, "w", "wave")).toEqual({ ok: true });
    expect(await s.react(id, "w", "fire")).toMatchObject({ ok: false });
    expect(await s.react(id, "b", "fire")).toEqual({ ok: true });
    expect((await s.getGame(id))?.reactions).toMatchObject({ w: { e: "wave" }, b: { e: "fire" } });
    t += REACTION_COOLDOWN_MS;
    expect(await s.react(id, "w", "party")).toEqual({ ok: true });
    const whiteHash = m.color === "w" ? "hb" : "ha";
    expect(await s.applyMove(id, whiteHash, 0, { uci: "e2e4", fen: new Chess().fen(), lastMove: { from: "e2", to: "e4" }, status: "active", result: null, reason: null })).toBe(true);
    expect((await s.getGame(id))?.reactions).toBeUndefined();
  });

  describe("route", () => {
    beforeEach(() => {
      vi.stubEnv("SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    });
    afterEach(() => vi.unstubAllEnvs());

    async function api(body: Record<string, unknown>) {
      const res = await POST(new Request("http://x/api/games/chess", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "10.9.9.9" } }));
      return { status: res.status, data: (await res.json()) as Record<string, unknown> & { game?: { reactions?: unknown } } };
    }

    it("validates the emoji, needs a seat, and rate-limits", async () => {
      const p1 = { ticket: crypto.randomUUID(), secret: "react-one-1234567890" };
      const p2 = { ticket: crypto.randomUUID(), secret: "react-two-1234567890" };
      await api({ action: "find", name: "Reacty", ...p1 });
      const m = (await api({ action: "find", name: "Emojo", ...p2 })).data;
      const gameId = m.gameId as string;
      expect((await api({ action: "react", gameId, secret: p1.secret, emoji: "💩" })).status).toBe(400);
      expect((await api({ action: "react", gameId, secret: "not-a-player-123456", emoji: "wave" })).status).toBe(403);
      const ok = await api({ action: "react", gameId, secret: p1.secret, emoji: "wave" });
      expect(ok.status).toBe(200);
      expect(JSON.stringify(ok.data.game?.reactions)).toContain("wave");
      expect((await api({ action: "react", gameId, secret: p1.secret, emoji: "fire" })).status).toBe(429);
      expect((await api({ action: "react", gameId, secret: p2.secret, emoji: "gg" })).status).toBe(200);
    });
  });
});

describe("capture celebrations", () => {
  const after = (fen: string, move: string) => {
    const g = new Chess(fen);
    g.move(move);
    return g.fen();
  };

  it("picks the tier from the captured piece", () => {
    // White queen takes black queen.
    const q = "rnb1kbnr/pppp1ppp/8/4p1q1/4P1Q1/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3";
    expect(majorCapture(q, after(q, "Qxg5"))).toMatchObject({ piece: "q", tier: "huge", color: "b", square: "g5", text: "QUEEN DOWN!" });
    const r = "4k3/8/8/8/8/8/8/r3K2R w - - 0 1";
    expect(majorCapture(r, after(r, "Kf2"))).toBeNull();
    const r2 = "4k3/8/8/8/8/8/1K6/r6R w - - 0 1";
    expect(majorCapture(r2, after(r2, "Rxa1"))).toMatchObject({ piece: "r", tier: "big" });
    const n = "4k3/8/8/3n4/8/2B5/8/4K3 w - - 0 1";
    expect(majorCapture(n, after(n, "Kd2"))).toBeNull();
    const n2 = "4k3/8/8/8/3n4/2B5/8/4K3 w - - 0 1";
    expect(majorCapture(n2, after(n2, "Bxd4"))).toMatchObject({ piece: "n", tier: "small" });
  });

  it("ignores pawn captures, take-backs, resets and junk", () => {
    const p = "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";
    expect(majorCapture(p, after(p, "exd5"))).toBeNull();
    const n2 = "4k3/8/8/8/3n4/2B5/8/4K3 w - - 0 1";
    expect(majorCapture(after(n2, "Bxd4"), n2)).toBeNull(); // take-back
    expect(majorCapture(null, n2)).toBeNull();
    expect(majorCapture("garbage", n2)).toBeNull();
    expect(majorCapture(n2, new Chess().fen())).toBeNull(); // new puzzle / game
  });

  it("maps squares to board percentages for both orientations", () => {
    expect(squarePercent("a1", "white")).toEqual({ left: 6.25, top: 93.75 });
    expect(squarePercent("a1", "black")).toEqual({ left: 93.75, top: 6.25 });
    expect(squarePercent("h8", "white")).toEqual({ left: 93.75, top: 6.25 });
  });
});
