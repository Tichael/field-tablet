import { create } from "zustand";
import { get } from "idb-keyval";
import { syncManager } from "../lib/sync/sync-manager";
import { syncLanguageWithConfig, detectDefaultAppLanguage } from "../i18n";
import type { SupportedLanguage } from "../i18n";

export { detectDefaultAppLanguage };

export function detectDefaultPdfPageSize(): "a4" | "letter" {
  if (typeof navigator !== "undefined" && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (
      lang.endsWith("-us") ||
      lang.endsWith("-ca") ||
      lang.endsWith("-mx") ||
      lang.endsWith("-ph") ||
      lang.endsWith("-cl")
    ) {
      return "letter";
    }
  }
  return "a4";
}

export type FormFoldersConfig =
  | string[]
  | {
      folders?: string[];
      dailyReports?: string;
      incidentLogs?: string;
      equipmentChecks?: string;
      customFolders?: string[];
      [key: string]: any;
    };

export function getFormFoldersList(config?: AppConfig | null): string[] {
  if (!config || !config.formFolders) return [];
  if (Array.isArray(config.formFolders)) {
    return Array.from(
      new Set(
        config.formFolders
          .map((f) => f?.trim())
          .filter((f): f is string => Boolean(f)),
      ),
    );
  }
  const {
    folders,
    customFolders,
    dailyReports,
    incidentLogs,
    equipmentChecks,
    ...rest
  } = config.formFolders;
  const list = [
    ...(Array.isArray(folders) ? folders : []),
    dailyReports,
    incidentLogs,
    equipmentChecks,
    ...(Array.isArray(customFolders) ? customFolders : []),
    ...Object.values(rest),
  ];
  return Array.from(
    new Set(
      list
        .map((f) => (typeof f === "string" ? f.trim() : ""))
        .filter((f): f is string => Boolean(f)),
    ),
  );
}

export type PhotoQuality = "2mp" | "5mp" | "10mp" | "original";

export interface MediaConfig {
  photoQuality?: PhotoQuality;
}

export interface AppConfig {
  theme: {
    primaryColor: string;
    darkMode: "system" | "light" | "dark";
  };
  branding: {
    appTitle: string;
    logoBase64?: string;
  };
  syncFolders?: string[];
  formFolders?: FormFoldersConfig;
  pdfPageSize?: "a4" | "letter";
  media?: MediaConfig;
  language?: SupportedLanguage;
}

export function detectDefaultAppTitle(lang?: SupportedLanguage): string {
  const language = lang || detectDefaultAppLanguage();
  return language.startsWith("fr") ? "Tablette de terrain" : "Field Tablet";
}

export function isDefaultAppTitle(title?: string | null): boolean {
  if (!title || !title.trim()) return true;
  const trimmed = title.trim();
  return (
    trimmed === "Field Tablet" ||
    trimmed === "Tablette de terrain" ||
    trimmed === "Field Tablet App" ||
    trimmed === "Application Tablette Terrain" ||
    trimmed === "Application tablette de terrain"
  );
}

export function getDefaultConfig(lang?: SupportedLanguage): AppConfig {
  const language = lang || detectDefaultAppLanguage();
  return {
    theme: {
      primaryColor: "#0f172a",
      darkMode: "system",
    },
    branding: {
      appTitle: detectDefaultAppTitle(language),
    },
    formFolders: [],
    pdfPageSize: detectDefaultPdfPageSize(),
    media: {
      photoQuality: "2mp",
    },
    language,
  };
}

export const DEFAULT_CONFIG: AppConfig = getDefaultConfig();

interface ConfigState {
  config: AppConfig | null;
  activeConfigFile: string | null;
  isLoading: boolean;
  error: string | null;
  setActiveConfigFile: (filename: string) => void;
  loadConfig: () => Promise<void>;
  saveConfig: (config: AppConfig, filename?: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, getStore) => ({
  config: null,
  activeConfigFile:
    typeof localStorage !== "undefined"
      ? localStorage.getItem("activeConfigFile")
      : null,
  isLoading: false,
  error: null,

  setActiveConfigFile: (filename: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("activeConfigFile", filename);
    }
    set({ activeConfigFile: filename });
  },

  loadConfig: async () => {
    const { activeConfigFile } = getStore();
    if (!activeConfigFile) {
      set({ config: null, isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      // First try to load from IndexedDB cache
      const files = await get("app_config_files");
      if (files && Array.isArray(files)) {
        const file = files.find(
          (f) =>
            f.name === activeConfigFile ||
            f.name === activeConfigFile.split("/").pop(),
        );
        if (file) {
          try {
            const parsed = JSON.parse(file.content);
            const baseDefault = getDefaultConfig(parsed.language);
            const loaded = {
              ...baseDefault,
              ...parsed,
              branding: {
                ...baseDefault.branding,
                ...(parsed.branding || {}),
              },
            };
            set({ config: loaded, isLoading: false });
            syncLanguageWithConfig(loaded.language).catch(console.error);
            return;
          } catch (e) {
            console.error("Failed to parse config from cache", e);
          }
        }
      }

      // If not in cache or parse failed, try to read from adapter directly if possible,
      // but syncManager is supposed to cache it. Let's sync and try again.
      if (syncManager.getAdapter().isAvailable()) {
        try {
          const content = await syncManager
            .getAdapter()
            .readFileText(activeConfigFile);
          const parsed = JSON.parse(content);
          const baseDefault = getDefaultConfig(parsed.language);
          const loaded = {
            ...baseDefault,
            ...parsed,
            branding: {
              ...baseDefault.branding,
              ...(parsed.branding || {}),
            },
          };
          set({ config: loaded, isLoading: false });
          syncLanguageWithConfig(loaded.language).catch(console.error);
          return;
        } catch (e) {
          console.error("Failed to load active config file directly", e);
        }
      }

      // If file is not found, fallback to default config
      const fallbackConfig = getDefaultConfig();
      set({ config: fallbackConfig, isLoading: false });
      syncLanguageWithConfig(fallbackConfig.language).catch(console.error);
    } catch (error: any) {
      console.error("Error loading config:", error);
      const fallbackConfig = getDefaultConfig();
      set({ error: error.message, isLoading: false, config: fallbackConfig });
      syncLanguageWithConfig(fallbackConfig.language).catch(console.error);
    }
  },

  saveConfig: async (newConfig: AppConfig, newFilename?: string) => {
    const { activeConfigFile } = getStore();
    const filenameToSave = newFilename || activeConfigFile || "app-config.json";

    // Configuration can only be edited when connected to the network share,
    // except on initial setup when no share is configured yet.
    const isConfigured =
      typeof localStorage !== "undefined" &&
      localStorage.getItem("isConfigured") === "true";
    if (isConfigured) {
      const isConnected = await syncManager.checkShareConnection();
      if (!isConnected) {
        throw new Error(
          "Cannot save configuration: no connection to network share. Configuration editing requires an active connection.",
        );
      }
    }

    try {
      const jsonStr = JSON.stringify(newConfig, null, 2);
      await syncManager.getAdapter().saveFile(filenameToSave, jsonStr);

      // Update local state
      if (filenameToSave !== activeConfigFile) {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("activeConfigFile", filenameToSave);
        }
        set({ activeConfigFile: filenameToSave });
      }
      set({ config: newConfig });
      syncLanguageWithConfig(newConfig.language).catch(console.error);

      // Trigger a sync
      syncManager.sync(true).catch(console.error);
    } catch (error: any) {
      console.error("Error saving config:", error);
      throw error;
    }
  },
}));
