import { set } from "idb-keyval";
import type { StorageAdapter } from "../storage/adapter";
import { WebStorageAdapter } from "../storage/web-adapter";
import { AndroidSmbAdapter } from "../storage/android-adapter";
import { useAppStore } from "../../store/app-store";
import { Capacitor } from "@capacitor/core";
import { SmbSync } from "../storage/smb-sync-plugin";

const CACHED_FILES_KEY = "app_config_files";

export class SyncManager {
  private adapter: StorageAdapter;
  private syncTimer: number | null = null;
  private isNative = Capacitor.isNativePlatform();

  constructor() {
    this.adapter = this.isNative
      ? new AndroidSmbAdapter()
      : new WebStorageAdapter();
  }

  getAdapter() {
    return this.adapter;
  }

  async initialize() {
    if (this.adapter.isAvailable()) {
      const isNative = Capacitor.isNativePlatform();
      const isConfigured = useAppStore.getState().isConfigured;

      if (!isConfigured) return;

      if (!isNative) {
        const hasPermission = await this.adapter.verifyPermission();
        if (!hasPermission) {
          console.log("Browser requires user gesture to restore access.");
          useAppStore.getState().setNeedsPermission(true);
          return;
        }
      }
      
      // We have permission, sync.
      this.sync().catch(e => console.error("Initial sync failed", e));
      this.startPeriodicSync();
    }
  }

  async configure(options?: any) {
    console.log("Starting configure...");

    if (this.isNative && options) {
      try {
        const result = await SmbSync.configure(options);
        if (result.success) {
          await this.sync(true);
          this.startPeriodicSync();
          return true;
        }
        return false;
      } catch (e) {
        console.error("SMB Configure failed:", e);
        throw e;
      }
    }

    if (this.adapter.isAvailable()) {
      console.log("Adapter is available, requesting permission...");
      const hasPermission = await this.adapter.requestPermission(
        options?.forcePrompt,
      );
      console.log("Has permission:", hasPermission);
      if (hasPermission) {
        await this.sync();
        this.startPeriodicSync();
        return true;
      }
    } else {
      console.error("Storage adapter is not available in this environment.");
      alert(
        "Your browser does not support the File System Access API. Please use a recent version of Chrome, Edge, or Opera.",
      );
    }
    return false;
  }

  async sync(forceNative = false) {
    try {
      useAppStore.getState().setSyncing(true);
      if (this.isNative && forceNative) {
        const { useConfigStore } = await import("../../store/config-store");
        const configState = useConfigStore.getState();
        const syncFolders = configState.config?.syncFolders || [];
        const configFile = configState.activeConfigFile || "";
        const result = await SmbSync.forceSync({ syncFolders, configFile });
        if (result && result.success === false && result.error === "MISSING_FOLDER") {
          throw new Error(`MISSING_FOLDER:${result.folder}`);
        }
      }
      const files = await this.adapter.getFiles();
      await set(CACHED_FILES_KEY, files);
      useAppStore.getState().setLastSyncTime(Date.now());
      useAppStore.getState().setError(null);
    } catch (e: any) {
      console.error("Sync failed", e);
      useAppStore.getState().setError(e.message || "Sync Failed");
      throw e;
    } finally {
      useAppStore.getState().setSyncing(false);
    }
  }

  startPeriodicSync() {
    if (this.isNative) {
      // For background sync, we must read the config store dynamically
      import("../../store/config-store").then(({ useConfigStore }) => {
        const configState = useConfigStore.getState();
        const syncFolders = configState.config?.syncFolders || [];
        const configFile = configState.activeConfigFile || "";
        SmbSync.startBackgroundSync({ intervalMinutes: 15, syncFolders, configFile });
      });
    } else {
      if (this.syncTimer !== null) {
        clearInterval(this.syncTimer);
      }
      this.syncTimer = window.setInterval(
        () => {
          if (navigator.onLine) {
            this.sync();
          }
        },
        15 * 60 * 1000,
      );
    }
  }

  stopPeriodicSync() {
    if (this.isNative) {
      SmbSync.stopBackgroundSync();
    } else {
      if (this.syncTimer !== null) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }
    }
  }
}

export const syncManager = new SyncManager();
