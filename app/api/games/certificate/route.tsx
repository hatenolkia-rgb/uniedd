import { ImageResponse } from "next/og";
import { getGame } from "../../../games/catalog";
import { readCertificate } from "../../../lib/games/lead";

// The certificate image a player gets on WhatsApp after a game. The link is
// signed (app/lib/games/lead.ts), so only real certificates render.
export async function GET(request: Request) {
  const data = readCertificate(new URL(request.url).searchParams.get("c") || "");
  const game = data ? getGame(data.g) : null;
  if (!data || !game) return new Response("Certificate not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", padding: 36,
          background: "linear-gradient(135deg, #0b0820 0%, #1b1446 55%, #2a1240 100%)", fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
            padding: "56px 64px", borderRadius: 28, background: "#fffdf7", border: `10px solid ${game.accent}`, color: "#1b1446",
          }}
        >
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>
            <span style={{ color: "#1a9fd4" }}>Uni</span>
            <span style={{ color: "#e8962e" }}>EDD</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, textTransform: "uppercase", color: "#6b6587" }}>
            Certificate of achievement
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#6b6587" }}>This certificate is proudly presented to</div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: game.accent, textAlign: "center" }}>{data.n}</div>
          <div style={{ display: "flex", fontSize: 32, textAlign: "center" }}>
            {`for playing ${game.title} and scoring ${data.s} points`}
          </div>
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", fontSize: 24, color: "#6b6587" }}>
            <span>{data.d}</span>
            <span>uniedd.com/games</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 850,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
