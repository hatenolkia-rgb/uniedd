import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // YouTube thumbnails for the "Meet our learners" videos
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        // Pictures in Medium posts listed on /blog
        protocol: "https",
        hostname: "cdn-images-1.medium.com",
      },
      {
        // Country flags for the homepage "Worldwide" block
        protocol: "https",
        hostname: "flagcdn.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking protection -- stops the site (incl. the booking
          // form) from being embedded in a hidden iframe on another site.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from guessing content-types away from what's declared.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera and location stay off. Microphone is allowed for Jam (tuner,
          // voice type) and Games (pitch match, sustain, interval singing).
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
      {
        // The picking & strumming game's optional Camera Coach uses the webcam
        // (hand tracking runs on-device; nothing is recorded or uploaded).
        source: "/games/alternate-picking",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }],
      },
      {
        // Karaoke Maker: cross-origin isolation enables the multi-threaded
        // WASM backend of the on-device vocal remover (3–5x faster).
        // "credentialless" still allows ordinary cross-origin images/scripts.
        source: "/games/karaoke-maker",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // The vocal-remover worker and its onnxruntime-web files.
        source: "/karaoke/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
