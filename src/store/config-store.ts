import { create } from "zustand";
import { get } from "idb-keyval";
import { syncManager } from "../lib/sync/sync-manager";

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

export interface FormFoldersConfig {
  dailyReports?: string;
  incidentLogs?: string;
  equipmentChecks?: string;
}

export function getFormFoldersList(config?: AppConfig | null): string[] {
  if (!config || !config.formFolders) return [];
  if (Array.isArray(config.formFolders)) {
    return Array.from(
      new Set(
        (config.formFolders as string[])
          .map((f) => f?.trim())
          .filter((f): f is string => Boolean(f)),
      ),
    );
  }
  const { dailyReports, incidentLogs, equipmentChecks } = config.formFolders;
  return Array.from(
    new Set(
      [dailyReports, incidentLogs, equipmentChecks]
        .map((f) => f?.trim())
        .filter((f): f is string => Boolean(f)),
    ),
  );
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
}

export const DEFAULT_CONFIG: AppConfig = {
  theme: {
    primaryColor: "#0f172a",
    darkMode: "system",
  },
  branding: {
    appTitle: "Field Tablet App",
  },
  formFolders: {},
  pdfPageSize: detectDefaultPdfPageSize(),
};

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
            set({ config: { ...DEFAULT_CONFIG, ...parsed }, isLoading: false });
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
          set({ config: { ...DEFAULT_CONFIG, ...parsed }, isLoading: false });
          return;
        } catch (e) {
          console.error("Failed to load active config file directly", e);
        }
      }

      // If file is not found, fallback to default config
      set({ config: DEFAULT_CONFIG, isLoading: false });
    } catch (error: any) {
      console.error("Error loading config:", error);
      set({ error: error.message, isLoading: false, config: DEFAULT_CONFIG });
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

      // Trigger a sync
      syncManager.sync(true).catch(console.error);
    } catch (error: any) {
      console.error("Error saving config:", error);
      throw error;
    }
  },
}));
