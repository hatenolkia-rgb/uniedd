import { NextResponse } from "next/server";
import { clientKey, isRateLimited } from "../../rate-limit";
import { nicknameError, normalizeNickname } from "../../../lib/games/nickname";
import { readSession, validateScore } from "../../../lib/games/session";
import { addScore, consumeNonce, detectStorage } from "../../../lib/games/storage";

export async function POST(request: Request) {
  if (await isRateLimited(`games-score:${clientKey(request)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many score submissions. Try again in a few minutes." }, { status: 429 });
  }

  let body: { token?: string; nickname?: string; score?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const session = body.token ? readSession(body.token) : null;
  if (!session) return NextResponse.json({ error: "That game session is not valid. Play again!" }, { status: 400 });

  const nameError = nicknameError(body.nickname || "");
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  const scoreError = validateScore(session.g, Number(body.score), session.t);
  if (scoreError) return NextResponse.json({ error: scoreError }, { status: 400 });

  const fresh = await consumeNonce(session.n);
  if (!fresh) return NextResponse.json({ error: "This result was already saved." }, { status: 409 });

  const entry = {
    name: normalizeNickname(body.nickname || ""),
    score: Math.round(Number(body.score)),
    at: Date.now(),
  };
  const storage = await addScore(session.g, entry);
  const kind = storage === "memory" ? await detectStorage() : storage;
  return NextResponse.json({
    ok: true,
    entry,
    storage,
    persistent: storage !== "memory",
    note:
      storage === "memory"
        ? kind === "supabase"
          ? "Supabase is connected but the game_scores table is missing."
          : "Global scores reset when this server sleeps until Redis or game_scores storage is enabled."
        : undefined,
  });
}
