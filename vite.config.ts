import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  server: {
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn(warning: any, warn: any) {
        if (warning.code === "INEFFECTIVE_DYNAMIC_IMPORT") return;
        warn(warning);
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,mjs,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: "Field Tablet",
        short_name: "FieldTablet",
        description: "Field Tablet Application",
        name_localized: {
          en: { value: "Field Tablet" },
          fr: { value: "Tablette de terrain" },
          "fr-CA": { value: "Tablette de terrain" },
        },
        short_name_localized: {
          en: { value: "FieldTablet" },
          fr: { value: "Tablette" },
          "fr-CA": { value: "Tablette" },
        },
        description_localized: {
          en: { value: "Field Tablet" },
          fr: { value: "Tablette de terrain" },
          "fr-CA": { value: "Tablette de terrain" },
        },
        translations: {
          fr: {
            name: "Tablette de terrain",
            short_name: "Tablette",
            description: "Tablette de terrain",
          },
          "fr-CA": {
            name: "Tablette de terrain",
            short_name: "Tablette",
            description: "Tablette de terrain",
          },
        },
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      } as any,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
