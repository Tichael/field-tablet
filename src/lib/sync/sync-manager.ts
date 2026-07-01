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
      // Don't auto-request on start unless we know we already had it configured,
      // but since we want to reduce prompts, we'll check if a handle is in idb.
      // Actually we will let the SetupScreen trigger the first prompt.
      // For initialization, we will just sync if we are already configured.
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
        await SmbSync.forceSync();
      }
      const files = await this.adapter.getFiles();
      await set(CACHED_FILES_KEY, files);
      useAppStore.getState().setLastSyncTime(Date.now());
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      useAppStore.getState().setSyncing(false);
    }
  }

  startPeriodicSync() {
    if (this.isNative) {
      SmbSync.startBackgroundSync({ intervalMinutes: 15 });
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
