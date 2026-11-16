import { NextResponse } from "next/server";
import { clientKey, isRateLimited } from "../../rate-limit";
import { nicknameError, normalizeNickname } from "../../../lib/games/nickname";
import { ChessStoreError, getChessStore, hashSecret, realtimeConfig } from "../../../lib/games/chessStore";
import { ROOM_CODE, checkMove, planRoomAction, type Color, type RoomKind } from "../../../games/chess/online";

// Online multiplayer chess: waiting room, moves, heartbeats, resign.
// Every request carries the player's random secret (kept in their browser);
// only its SHA-256 hash is stored.

type Body = {
  action?: string;
  ticket?: string;
  secret?: string;
  name?: string;
  gameId?: string;
  ply?: number;
  from?: string;
  to?: string;
  promotion?: string;
  // private teacher rooms
  room?: boolean;
  code?: string;
  kind?: string;
  version?: number;
  flag?: boolean;
  teacherColor?: string;
};

const ROOM_KINDS: RoomKind[] = ["move", "undo", "takeback", "request", "approve", "decline", "set_takebacks", "set_demo", "reset", "set_teacher_color", "resign"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function ok(data: Record<string, unknown>) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  // Polling every 1.5–2 s is ~40 requests a minute per player; leave room for a
  // few players sharing one school / home IP.
  if (await isRateLimited(`games-chess:${clientKey(request)}`, 400, 60 * 1000)) {
    return bad("Too many requests. Wait a moment and try again.", 429);
  }

  let body: Body = {};
  try {
    // sendBeacon posts text/plain, so parse the text ourselves.
    body = JSON.parse(await request.text()) as Body;
  } catch {
    return bad("Expected JSON.");
  }

  const secret = typeof body.secret === "string" ? body.secret : "";
  if (secret.length < 16 || secret.length > 128) return bad("Missing player secret.");
  const secretHash = hashSecret(secret);

  try {
    const store = getChessStore();

    if (body.action === "find" || body.action === "cancel") {
      if (!body.ticket || !UUID.test(body.ticket)) return bad("Bad ticket.");
      if (body.action === "cancel") return ok(await store.cancel(body.ticket, secretHash));
      const nameErr = nicknameError(body.name || "");
      if (nameErr) return bad(nameErr);
      return ok(await store.matchmake(body.ticket, normalizeNickname(body.name || ""), secretHash));
    }

    if (body.action === "room-create" || body.action === "room-join") {
      const nameErr = nicknameError(body.name || "");
      if (nameErr) return bad(nameErr);
      const name = normalizeNickname(body.name || "");
      if (body.action === "room-create") {
        const room = await store.createRoom(name, secretHash);
        return ok({ state: "joined", gameId: room.gameId, code: room.code, role: "teacher" });
      }
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!ROOM_CODE.test(code)) return bad("Room codes are 6 letters and numbers, like K7M2QX.");
      const joined = await store.joinRoom(code, name, secretHash);
      if (joined.state === "missing") return bad("No room with that code. Check it with your teacher.", 404);
      if (joined.state === "full") return bad("This room already has a student.", 409);
      return ok(joined);
    }

    if (!body.gameId || !UUID.test(body.gameId)) return bad("Bad game.");
    const gameId = body.gameId;

    if (body.room) {
      const seat = await store.touchRoom(gameId, secretHash);
      if (!seat) return bad("You aren't in this room.", 403);
      const game = await store.getGame(gameId);
      if (!game) return bad("Room not found.", 404);
      const info = { color: seat.color, role: seat.role, code: seat.code, studentJoined: seat.studentJoined, opponentIdleMs: seat.opponentIdleMs };
      if (body.action === "state") return ok({ game, ...info, realtime: realtimeConfig() });
      if (body.action !== "room") return bad("Unknown action.");
      const kind = body.kind as RoomKind;
      if (!ROOM_KINDS.includes(kind)) return bad("Unknown room action.");
      if (typeof body.version === "number" && body.version !== game.version) {
        return NextResponse.json({ error: "The board changed. Updating…", game, ...info }, { status: 409 });
      }
      const teacherColor = body.teacherColor === "w" || body.teacherColor === "b" ? (body.teacherColor as Color) : undefined;
      const plan = planRoomAction(
        game,
        seat.role,
        kind,
        { from: body.from, to: body.to, promotion: body.promotion || undefined, flag: body.flag, teacherColor },
        seat.studentJoined,
      );
      if (!plan.ok) return NextResponse.json({ error: plan.error, game, ...info }, { status: kind !== "move" && plan.error.startsWith("Only the teacher") ? 403 : 422 });
      const saved = await store.updateRoom(gameId, secretHash, game.version, plan.update);
      const fresh = await store.getGame(gameId);
      const after = await store.touchRoom(gameId, secretHash);
      const infoAfter = after ? { color: after.color, role: after.role, code: after.code, studentJoined: after.studentJoined, opponentIdleMs: after.opponentIdleMs } : info;
      if (!saved) return NextResponse.json({ error: "The board changed. Updating…", game: fresh, ...infoAfter }, { status: 409 });
      return ok({ game: fresh, ...infoAfter });
    }
    const seat = await store.touch(gameId, secretHash);
    if (!seat) return bad("You aren't playing in this game.", 403);

    if (body.action === "state") {
      const game = await store.getGame(gameId);
      if (!game) return bad("Game not found.", 404);
      return ok({ game, color: seat.color, opponentIdleMs: seat.opponentIdleMs, realtime: realtimeConfig() });
    }

    if (body.action === "move") {
      const game = await store.getGame(gameId);
      if (!game) return bad("Game not found.", 404);
      if (typeof body.ply === "number" && body.ply !== game.ply) {
        return NextResponse.json({ error: "The board changed. Updating…", game }, { status: 409 });
      }
      const check = checkMove(game.moves, seat.color, { from: String(body.from ?? ""), to: String(body.to ?? ""), promotion: body.promotion || undefined }, game.status);
      if (!check.ok) return NextResponse.json({ error: check.error, game }, { status: 422 });
      const saved = await store.applyMove(gameId, secretHash, game.ply, {
        uci: check.uci,
        fen: check.fen,
        lastMove: { from: check.from, to: check.to },
        status: check.status,
        result: check.result,
        reason: check.reason,
      });
      const fresh = await store.getGame(gameId);
      if (!saved) return NextResponse.json({ error: "The board changed. Updating…", game: fresh }, { status: 409 });
      return ok({ game: fresh, color: seat.color, opponentIdleMs: seat.opponentIdleMs });
    }

    if (body.action === "resign" || body.action === "claim") {
      const done = await store.endGame(gameId, secretHash, body.action);
      const game = await store.getGame(gameId);
      if (!done && body.action === "claim") return NextResponse.json({ error: "Your opponent is still connected.", game }, { status: 409 });
      return ok({ game, color: seat.color, opponentIdleMs: seat.opponentIdleMs });
    }

    return bad("Unknown action.");
  } catch (err) {
    if (err instanceof ChessStoreError) {
      const status = err.code === "forbidden" ? 403 : 503;
      return bad(err.code === "failed" ? "Online chess is having trouble. Try again in a moment." : err.message, status);
    }
    console.error("chess route failed", err);
    return bad("Online chess is having trouble. Try again in a moment.", 500);
  }
}
