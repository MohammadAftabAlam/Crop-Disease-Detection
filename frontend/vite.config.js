import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + offline app shell. The offline model (~31 MB) is NOT precached:
    // it is downloaded only when the user turns on offline mode (src/offline/model.js).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon.png"],
      manifest: {
        name: "CropCare AI",
        short_name: "CropCare",
        description: "Crop disease detection that works on field photos, in English and Hindi, even offline.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        background_color: "#070b09",
        theme_color: "#070b09",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Hand-written service worker (src/sw.js): the generated one breaks on the ' in this folder's path
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,woff2}"],
        globIgnores: ["model/**", "**/*.wasm"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
