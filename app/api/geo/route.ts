import { NextResponse, type NextRequest } from "next/server";

// Vercel automatically injects the visitor's country on every request
// once deployed (works in Preview + Production, not in local `next dev`).
export async function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") || null;

  return NextResponse.json({ country });
}
