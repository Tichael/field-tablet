import { useAppStore } from "../../store/app-store";
import { RefreshCw, CheckCircle, AlertCircle, CloudUpload } from "lucide-react";

export function SyncIndicator() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const error = useAppStore((state) => state.error);
  const pendingUploadsCount = useAppStore((state) => state.pendingUploadsCount);

  if (isSyncing) {
    return (
      <div
        className="flex items-center text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800 cursor-default"
        title="Synchronizing files with remote share..."
      >
        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (pendingUploadsCount > 0) {
    return (
      <div
        className="flex items-center text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 cursor-default"
        title={`${pendingUploadsCount} change(s) saved locally, waiting to upload when reconnected`}
      >
        <CloudUpload className="w-4 h-4 mr-1.5" />
        <span>Waiting to upload ({pendingUploadsCount})</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200 cursor-help"
        title={`Sync error: ${error}`}
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        <span>Sync Failed</span>
      </div>
    );
  }

  if (lastSyncTime) {
    const timeStr = new Date(lastSyncTime).toLocaleTimeString();
    return (
      <div
        className="flex items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200 cursor-default"
        title={`Last synchronized at ${timeStr}`}
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        <span>Synced</span>
      </div>
    );
  }

  return null;
}
