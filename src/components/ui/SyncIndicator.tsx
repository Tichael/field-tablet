import { useAppStore } from "../../store/app-store";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export function SyncIndicator() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const error = useAppStore((state) => state.error); // assuming we have an error state, or just show if sync failed

  if (isSyncing) {
    return (
      <div className="flex items-center text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
        <AlertCircle className="w-4 h-4 mr-2" />
        <span>Sync Failed</span>
      </div>
    );
  }

  if (lastSyncTime) {
    return (
      <div className="flex items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
        <CheckCircle className="w-4 h-4 mr-2" />
        <span>Synced</span>
      </div>
    );
  }

  return null;
}
