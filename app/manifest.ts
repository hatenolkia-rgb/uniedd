import type { MetadataRoute } from "next";

// Lets phones install uniedd.com from the browser ("Add to Home Screen")
// and open it full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UniEDD — Live 1:1 Music, Dance & Chess Classes",
    short_name: "UniEDD",
    description:
      "Live 1-on-1 online classes in Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking, and Chess for kids and adults.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
