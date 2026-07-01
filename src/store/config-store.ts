import { create } from "zustand";
import { get } from "idb-keyval";
import { syncManager } from "../lib/sync/sync-manager";

export interface AppConfig {
  theme: {
    primaryColor: string;
    darkMode: "system" | "light" | "dark";
  };
  branding: {
    appTitle: string;
    logoBase64?: string;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  theme: {
    primaryColor: "#0f172a",
    darkMode: "system",
  },
  branding: {
    appTitle: "Field Tablet App",
  },
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
  activeConfigFile: localStorage.getItem("activeConfigFile"),
  isLoading: false,
  error: null,

  setActiveConfigFile: (filename: string) => {
    localStorage.setItem("activeConfigFile", filename);
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
        const file = files.find((f) => f.name === activeConfigFile);
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
        const freshFiles = await syncManager.getAdapter().getFiles();
        const file = freshFiles.find((f: any) => f.name === activeConfigFile);
        if (file) {
          const parsed = JSON.parse(file.content);
          set({ config: { ...DEFAULT_CONFIG, ...parsed }, isLoading: false });
          return;
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

    try {
      const jsonStr = JSON.stringify(newConfig, null, 2);
      await syncManager.getAdapter().saveFile(filenameToSave, jsonStr);

      // Update local state
      if (filenameToSave !== activeConfigFile) {
        localStorage.setItem("activeConfigFile", filenameToSave);
        set({ activeConfigFile: filenameToSave });
      }
      set({ config: newConfig });

      // Trigger a sync
      syncManager.sync(true);
    } catch (error: any) {
      console.error("Error saving config:", error);
      throw error;
    }
  },
}));
