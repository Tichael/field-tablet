import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import { Button } from "../ui/button";

export function SettingsScreen() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const setConfigured = useAppStore((state) => state.setConfigured);

  const handleManualSync = () => {
    syncManager.sync(true);
  };

  const handleChangeFolder = async () => {
    await syncManager.configure();
  };

  const handleClear = () => {
    setConfigured(false);
  };

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
          <Button onClick={handleChangeFolder} variant="outline">
            Change Folder
          </Button>
          <Button onClick={handleClear} variant="destructive">
            Clear Configuration
          </Button>
        </div>

        <div className="pt-6 border-t">
          <h3 className="text-sm font-medium mb-3">Editor</h3>
          <Button variant="secondary" className="w-full" disabled>
            Open Editor (Coming Soon)
          </Button>
        </div>
      </div>
    </div>
  );
}
