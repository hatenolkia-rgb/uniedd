import { NextResponse } from "next/server";
import { clientKey, isRateLimited } from "../../rate-limit";
import { nicknameError, normalizeNickname } from "../../../lib/games/nickname";
import { ChessStoreError, getChessStore, hashSecret, realtimeConfig } from "../../../lib/games/chessStore";
import { checkMove } from "../../../games/chess/online";
import { REACTION_IP_LIMIT, REACTION_IP_WINDOW_MS, isReactionId } from "../../../games/chess/reactions";

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
  emoji?: string;
};

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

    if (!body.gameId || !UUID.test(body.gameId)) return bad("Bad game.");
    const gameId = body.gameId;
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

    if (body.action === "react") {
      // Fixed allowlist of emoji ids only — never free text.
      if (!isReactionId(body.emoji)) return bad("Pick one of the emoji buttons.");
      if (await isRateLimited(`games-chess-react:${clientKey(request)}`, REACTION_IP_LIMIT, REACTION_IP_WINDOW_MS)) {
        return bad("Slow down a little 🙂", 429);
      }
      const r = await store.react(gameId, seat.color, body.emoji);
      const game = await store.getGame(gameId);
      if (!r.ok) return NextResponse.json({ error: r.error, retryMs: r.retryMs, game }, { status: 429, headers: { "Cache-Control": "no-store" } });
      return ok({ game, color: seat.color, opponentIdleMs: seat.opponentIdleMs });
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
