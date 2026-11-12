import { ImageResponse } from "next/og";

// Shared 1200×630 social preview card (Open Graph / Twitter) for the games and Jam pages.
export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({
  kicker,
  title,
  subtitle,
  accent = "#7c3aed",
}: {
  kicker: string;
  title: string;
  subtitle: string;
  accent?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0b0820 0%, #1b1446 55%, #2a1240 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: accent, display: "flex" }} />
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
            {kicker}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, display: "flex" }}>{title}</div>
          <div style={{ fontSize: 34, color: "rgba(255,255,255,0.8)", lineHeight: 1.3, display: "flex" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 800, display: "flex" }}>
            <span style={{ color: "#1a9fd4" }}>Uni</span>
            <span style={{ color: "#e8962e" }}>EDD</span>
          </div>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.6)", display: "flex" }}>uniedd.com · free · no download</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
