import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLAIM_WIN_MS,
  QUEUE_STALE_MS,
  ROOM_CODE,
  applyRoomUpdate,
  checkMove,
  newerGame,
  outcomeOf,
  planRoomAction,
  positionAfter,
  replay,
  resultText,
  rowToGame,
  sanList,
  takebackPlies,
  type OnlineGame,
} from "../app/games/chess/online";
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
  it("teacher lobby SQL is a separate idempotent add-on that keeps secrets out of chess_games", () => {
    const t = readFileSync(join(__dirname, "..", "supabase", "chess_teacher_lobby.sql"), "utf8");
    expect(t).toMatch(/add column if not exists version/);
    expect(t).toMatch(/create table if not exists public\.chess_rooms/);
    expect(t).toMatch(/drop constraint if exists chess_games_status_check/);
    expect(t).not.toMatch(/create policy/i);
    expect(t).not.toMatch(/add column if not exists (code|\w*secret)/);
    expect(t).toMatch(/grant execute on function public\.chess_room_update[^;]*to service_role/);
  });

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

describe("private teacher rooms", () => {
  const base = (over: Partial<OnlineGame> = {}): OnlineGame => ({
    ...rowToGame({ id: "r1", white_name: "Coach", black_name: "Kid", status: "active", is_private: true, teacher_name: "Coach", student_name: "Kid", teacher_color: "w" }),
    ...over,
  });
  const after = (moves: string[], over: Partial<OnlineGame> = {}) => base({ ...positionAfter(moves), ply: moves.length, ...over });

  it("lets only the side to move play, and the teacher play both sides in demo mode", () => {
    const g = base();
    expect(planRoomAction(g, "student", "move", { from: "e7", to: "e5" })).toMatchObject({ ok: false });
    expect(planRoomAction(g, "teacher", "move", { from: "e2", to: "e4" })).toMatchObject({ ok: true });
    const g1 = after(["e2e4"]);
    expect(planRoomAction(g1, "teacher", "move", { from: "e7", to: "e5" })).toMatchObject({ ok: false });
    expect(planRoomAction({ ...g1, demoMode: true }, "teacher", "move", { from: "e7", to: "e5" })).toMatchObject({ ok: true });
    expect(planRoomAction({ ...g1, demoMode: true }, "student", "move", { from: "d2", to: "d4" })).toMatchObject({ ok: false });
    expect(planRoomAction(base({ status: "waiting" }), "teacher", "move", { from: "e2", to: "e4" })).toMatchObject({ ok: false });
  });

  it("computes take-backs to just before the student's last move", () => {
    // teacher White: e4 (T) e5 (S) Nf3 (T) -> student take-back undoes Nf3 and e5
    const g = after(["e2e4", "e7e5", "g1f3"]);
    expect(takebackPlies(g)).toBe(2);
    expect(takebackPlies(after(["e2e4", "e7e5"]))).toBe(1);
    expect(takebackPlies(after(["e2e4"]))).toBe(0);
    const tb = planRoomAction({ ...g, allowTakebacks: true }, "student", "takeback");
    expect(tb).toMatchObject({ ok: true, game: { moves: ["e2e4"], ply: 1 } });
    expect(planRoomAction(g, "student", "takeback")).toMatchObject({ ok: false });
    // teacher undo = one ply
    expect(planRoomAction(g, "teacher", "undo")).toMatchObject({ ok: true, game: { moves: ["e2e4", "e7e5"] } });
    expect(planRoomAction(g, "student", "undo")).toMatchObject({ ok: false, error: "Only the teacher can do that." });
  });

  it("handles request, approve, decline and stale approvals", () => {
    const g = after(["e2e4", "e7e5"]);
    const req = planRoomAction(g, "student", "request");
    if (!req.ok) throw new Error(req.error);
    expect(req.game.takebackRequest).toEqual({ n: 2 });
    expect(planRoomAction(req.game, "student", "request")).toMatchObject({ ok: false });
    expect(planRoomAction(req.game, "student", "approve")).toMatchObject({ ok: false });
    expect(planRoomAction(req.game, "teacher", "approve")).toMatchObject({ ok: true, game: { moves: ["e2e4"], takebackRequest: null } });
    expect(planRoomAction(req.game, "teacher", "decline")).toMatchObject({ ok: true, game: { moves: ["e2e4", "e7e5"], takebackRequest: null } });
    // a move after the request makes the old request invalid (and clears it)
    const moved = planRoomAction(req.game, "teacher", "move", { from: "g1", to: "f3" });
    if (!moved.ok) throw new Error(moved.error);
    expect(moved.game.takebackRequest).toBeNull();
    expect(applyRoomUpdate({ ...moved.game, takebackRequest: { n: 2 } }, "teacher", { kind: "approve", moves: ["e2e4"] }, true)).toBeNull();
  });

  it("resets, swaps colours, toggles settings, and undo after mate reopens the game", () => {
    const g = after(["e2e4", "e7e5"]);
    expect(planRoomAction(g, "teacher", "reset")).toMatchObject({ ok: true, game: { moves: [], status: "active" } });
    expect(planRoomAction(g, "teacher", "reset", {}, false)).toMatchObject({ ok: true, game: { status: "waiting" } });
    const sw = planRoomAction(g, "teacher", "set_teacher_color", { teacherColor: "b" });
    expect(sw).toMatchObject({ ok: true, game: { teacherColor: "b", whiteName: "Kid", blackName: "Coach" } });
    expect(planRoomAction(g, "student", "set_teacher_color", { teacherColor: "b" })).toMatchObject({ ok: false });
    expect(planRoomAction(g, "teacher", "set_takebacks", { flag: true })).toMatchObject({ ok: true, game: { allowTakebacks: true } });
    expect(planRoomAction(g, "student", "set_demo", { flag: true })).toMatchObject({ ok: false });
    // Teacher plays Black here so the student (White) is the one mated by Qh4#.
    const mate = after(["f2f3", "e7e5", "g2g4", "d8h4"], { teacherColor: "b" });
    expect(mate.status).toBe("checkmate");
    expect(planRoomAction(mate, "teacher", "undo")).toMatchObject({ ok: true, game: { status: "active", ply: 3 } });
    expect(planRoomAction(mate, "student", "resign")).toMatchObject({ ok: false });
  });

  it("memory store: create, join, rejoin, full room, version checks", async () => {
    let t = 5_000_000;
    const s = createMemoryStore(() => t);
    const room = await s.createRoom("Coach", "teach");
    expect(room.code).toMatch(ROOM_CODE);
    expect(await s.joinRoom("ZZZZZZ", "Kid", "kid")).toEqual({ state: "missing" });
    expect(await s.joinRoom(room.code.toLowerCase(), "Kid", "kid")).toEqual({ state: "joined", gameId: room.gameId, role: "student" });
    expect(await s.joinRoom(room.code, "Other", "other")).toEqual({ state: "full" });
    expect(await s.joinRoom(room.code, "Coach", "teach")).toMatchObject({ role: "teacher" });
    t += 61_000;
    expect(await s.joinRoom(room.code, "Other", "other")).toMatchObject({ state: "joined", role: "student" });
    expect(await s.touchRoom(room.gameId, "kid")).toBeNull();
    const g = (await s.getGame(room.gameId))!;
    expect(g).toMatchObject({ status: "active", studentName: "Other", blackName: "Other", isPrivate: true });
    const plan = planRoomAction(g, "teacher", "move", { from: "e2", to: "e4" });
    if (!plan.ok) throw new Error(plan.error);
    expect(await s.updateRoom(room.gameId, "teach", g.version - 1, plan.update)).toBe(false);
    expect(await s.updateRoom(room.gameId, "other", g.version, plan.update)).toBe(false);
    expect(await s.updateRoom(room.gameId, "teach", g.version, plan.update)).toBe(true);
    expect(await s.updateRoom(room.gameId, "teach", g.version, plan.update)).toBe(false);
    // a private room is never matched from the public queue
    expect(await s.matchmake("q1", "Solo", "solo")).toEqual({ state: "waiting" });
  });
});

describe("chess API route: private rooms (memory store)", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());
  async function api(body: Record<string, unknown>) {
    const res = await POST(new Request("http://x/api/games/chess", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "10.9.9.9" } }));
    return { status: res.status, data: (await res.json()) as Record<string, unknown> & { game?: OnlineGame } };
  }

  it("teacher creates, student joins, take-back request is approved, settings are teacher-only", async () => {
    const T = "teacher-secret-123456789";
    const S = "student-secret-123456789";
    const created = (await api({ action: "room-create", name: "Coach Ana", secret: T })).data;
    expect(created).toMatchObject({ state: "joined", role: "teacher" });
    const code = created.code as string;
    const gameId = created.gameId as string;
    expect((await api({ action: "room-join", name: "Kid", code: "bad", secret: S })).status).toBe(400);
    expect((await api({ action: "room-join", name: "Kid", code, secret: S })).data).toMatchObject({ role: "student", gameId });
    const room = (b: Record<string, unknown>, secret: string) => api({ action: "room", room: true, gameId, secret, ...b });
    const state = async (secret: string) => (await api({ action: "state", room: true, gameId, secret })).data;
    expect(await state(T)).toMatchObject({ role: "teacher", color: "w", code, studentJoined: true });
    expect((await api({ action: "state", gameId, secret: S })).status).toBe(403); // not a public seat

    let v = ((await state(T)).game as OnlineGame).version;
    expect((await room({ kind: "move", version: v, from: "e2", to: "e4" }, T)).status).toBe(200);
    v++;
    expect((await room({ kind: "move", version: v - 1, from: "d2", to: "d4" }, T)).status).toBe(409); // stale version
    expect((await room({ kind: "move", version: v, from: "e7", to: "e5" }, S)).status).toBe(200);
    v++;
    expect((await room({ kind: "takeback", version: v }, S)).status).toBe(422); // not allowed yet
    expect((await room({ kind: "set_takebacks", version: v, flag: true }, S)).status).toBe(403);
    expect((await room({ kind: "request", version: v }, S)).data.game).toMatchObject({ takebackRequest: { n: 2 } });
    v++;
    const ok = await room({ kind: "approve", version: v }, T);
    expect(ok.data.game).toMatchObject({ moves: ["e2e4"], takebackRequest: null });
    v++;
    expect((await room({ kind: "set_takebacks", version: v, flag: true }, T)).data.game).toMatchObject({ allowTakebacks: true });
    v++;
    await room({ kind: "move", version: v, from: "c7", to: "c5" }, S);
    v++;
    expect((await room({ kind: "takeback", version: v }, S)).data.game).toMatchObject({ moves: ["e2e4"] });
    v++;
    const swap = await room({ kind: "set_teacher_color", version: v, teacherColor: "b" }, T);
    expect(swap.data).toMatchObject({ color: "b", game: { teacherColor: "b", whiteName: "Kid" } });
    v++;
    expect((await room({ kind: "reset", version: v }, T)).data.game).toMatchObject({ moves: [], status: "active" });
    v++;
    expect((await state(S)).color).toBe("w");
    expect((await room({ kind: "move", version: v, from: "e2", to: "e4" }, S)).status).toBe(200);
  });
});
