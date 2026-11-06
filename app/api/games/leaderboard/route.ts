import { NextResponse } from "next/server";
import { getGame } from "../../../games/catalog";
import { listScores } from "../../../lib/games/storage";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("game") || "";
  if (!getGame(slug)) return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  const board = await listScores(slug);
  return NextResponse.json(board);
}
