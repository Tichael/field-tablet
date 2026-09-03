import { useEffect, useState } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import { useConfigStore } from "../../store/config-store";
import { del } from "idb-keyval";
import { Button } from "../ui/button";
import { ConfigEditorScreen } from "./ConfigEditorScreen";

import { Capacitor } from "@capacitor/core";

export function SettingsScreen() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const setConfigured = useAppStore((state) => state.setConfigured);
  const setActiveConfigFile = useConfigStore(
    (state) => state.setActiveConfigFile,
  );

  const isEditingConfig = useAppStore((state) => state.isEditingConfig);
  const setEditingConfig = useAppStore((state) => state.setEditingConfig);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);

  const [cameFromSetup, setCameFromSetup] = useState(false);

  useEffect(() => {
    const open = localStorage.getItem("openEditor") === "true";
    if (open) {
      localStorage.removeItem("openEditor");
      setEditingConfig(true);
      setCameFromSetup(true);
    }
  }, [setEditingConfig]);

  const handleCloseEditor = () => {
    setEditingConfig(false);
    if (cameFromSetup) {
      setSettingsOpen(false);
    }
  };

  const handleManualSync = () => {
    syncManager.sync(true);
  };

  const handleLoadConfig = () => {
    setActiveConfigFile("");
    localStorage.setItem("skipSetupStep1", "true");
    setConfigured(false);
  };

  const handleClear = async () => {
    const isNative = Capacitor.isNativePlatform();
    const target = isNative ? "SMB share" : "source folder";
    const confirmed = window.confirm(
      `Are you sure you want to reset the app? You will need to reconnect to your ${target}. If you are offline, any unsynced changes will not be pushed to the share.`,
    );
    if (!confirmed) return;

    await del("app_config_directory_handle");
    setActiveConfigFile("");
    setConfigured(false);
  };

  if (isEditingConfig) {
    return (
      <div className="p-8">
        <ConfigEditorScreen onClose={handleCloseEditor} />
      </div>
    );
  }

  return (
    <div className="p-8 bg-background border rounded-xl shadow-sm max-w-2xl mx-auto mt-10 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your app configuration and synchronization.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-lg border">
          <h3 className="text-sm font-medium">Sync Status</h3>
          <p className="mt-1 text-sm">
            {isSyncing ? "Syncing now..." : "Idle"}
          </p>
          {lastSyncTime && (
            <p className="text-xs text-muted-foreground mt-2">
              Last synced: {new Date(lastSyncTime).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleManualSync} disabled={isSyncing}>
            Sync Now
          </Button>
          <Button onClick={handleLoadConfig} variant="outline">
            Load Configuration File
          </Button>
        </div>

        <div className="pt-6 border-t">
          <h3 className="text-sm font-medium mb-3">Editor</h3>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setEditingConfig(true)}
          >
            Open Configuration Editor
          </Button>
        </div>

        <div className="pt-6 border-t flex flex-col items-start gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground">
            Disconnect from the current network share and reset app settings.
            Works while offline.
          </p>
          <Button
            onClick={handleClear}
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 mt-2"
          >
            Reset Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
