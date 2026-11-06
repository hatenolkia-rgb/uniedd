import { NextResponse } from "next/server";
import { clientKey, isRateLimited } from "../../rate-limit";
import { getGame } from "../../../games/catalog";
import { signSession } from "../../../lib/games/session";

export async function POST(request: Request) {
  if (await isRateLimited(`games-session:${clientKey(request)}`, 40, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many game starts. Take a tiny break!" }, { status: 429 });
  }
  let body: { slug?: string } = {};
  try {
    body = (await request.json()) as { slug?: string };
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  const game = body.slug ? getGame(body.slug) : undefined;
  if (!game) return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  const { token, payload } = signSession(game.slug);
  return NextResponse.json({ token, startedAt: payload.t, slug: game.slug });
}
