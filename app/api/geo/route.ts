import { NextResponse } from "next/server";

// The visitor's country from Vercel's edge header (e.g. "IN"), so offers can
// show local prices. Nothing about the visitor is stored.
export function GET(request: Request) {
  const country = (request.headers.get("x-vercel-ip-country") || "").slice(0, 2).toUpperCase();
  return NextResponse.json({ country }, { headers: { "Cache-Control": "private, no-store" } });
}
