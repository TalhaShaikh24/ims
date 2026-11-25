export default function manifest() {
  return {
    name: "IMS — POS & Business Management",
    short_name: "IMS",
    description: "Point of sale, inventory, purchases and financials workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#2563EB",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
