import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

import tailwindcss from "@tailwindcss/vite";

declare module "vite-plugin-pwa" {
  interface ManifestOptions {
    translations?: Record<
      string,
      {
        name?: string;
        short_name?: string;
        description?: string;
      }
    >;
  }
}

function getManifestTranslations(): Record<
  string,
  { name: string; short_name: string; description: string }
> {
  const localesDir = path.resolve(__dirname, "src/i18n/locales");
  const translations: Record<
    string,
    { name: string; short_name: string; description: string }
  > = {};

  try {
    const files = fs.readdirSync(localesDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = fs.readFileSync(path.join(localesDir, file), "utf-8");
      const content = JSON.parse(raw);
      const code = content._meta?.code || path.basename(file, ".json");
      if (code === "en") continue;

      const name =
        content.manifest?.name || content.header?.fieldTablet || "Field Tablet";
      const shortName =
        content.manifest?.shortName ||
        (content.header?.fieldTablet
          ? content.header.fieldTablet.replace(/\s+/g, "")
          : "FieldTablet");
      const description =
        content.manifest?.description ||
        content.header?.fieldTabletApp ||
        content.header?.fieldTablet ||
        "Field Tablet Application";

      const entry = {
        name,
        short_name: shortName,
        description,
      };

      translations[code] = entry;

      const baseCode = code.split("-")[0];
      if (baseCode && baseCode !== code && !translations[baseCode]) {
        translations[baseCode] = entry;
      }
    }
  } catch (e) {
    console.warn("Failed to load locale files for manifest translations:", e);
  }

  return translations;
}

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
        translations: getManifestTranslations(),
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
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
