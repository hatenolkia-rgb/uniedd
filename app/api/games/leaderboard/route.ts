import { NextResponse } from "next/server";
import { boardKey, getGame } from "../../../games/catalog";
import { listScores } from "../../../lib/games/storage";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("game") || "";
  if (!getGame(slug)) return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  const key = boardKey(slug, params.get("board"));
  if (!key) return NextResponse.json({ error: "Unknown leaderboard." }, { status: 404 });
  const board = await listScores(key);
  return NextResponse.json(board);
}
