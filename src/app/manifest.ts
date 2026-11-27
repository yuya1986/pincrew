import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PinCrew",
    short_name: "PinCrew",
    description: "場所をピンして、みんなで共有できるマップ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F4EF",
    theme_color: "#F7F4EF",
    lang: "ja",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
