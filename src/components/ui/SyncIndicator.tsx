import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/app-store";
import { RefreshCw, CheckCircle, AlertCircle, CloudUpload } from "lucide-react";
import { formatAppTime } from "../../i18n";

export function SyncIndicator() {
  const { t } = useTranslation();
  const isSyncing = useAppStore((state) => state.isSyncing);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const error = useAppStore((state) => state.error);
  const pendingUploadsCount = useAppStore((state) => state.pendingUploadsCount);

  if (isSyncing) {
    return (
      <div
        className="flex items-center text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800 cursor-default"
        title={t("sync.syncingTitle")}
      >
        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
        <span>{t("sync.syncing")}</span>
      </div>
    );
  }

  if (pendingUploadsCount > 0) {
    return (
      <div
        className="flex items-center text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 cursor-default"
        title={t("sync.waitingToUploadTitle", { count: pendingUploadsCount })}
      >
        <CloudUpload className="w-4 h-4 mr-1.5" />
        <span>{t("sync.waitingToUpload", { count: pendingUploadsCount })}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200 cursor-help"
        title={t("sync.syncFailedTitle", { error })}
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        <span>{t("sync.syncFailed")}</span>
      </div>
    );
  }

  if (lastSyncTime) {
    const timeStr = formatAppTime(lastSyncTime);
    return (
      <div
        className="flex items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200 cursor-default"
        title={t("sync.lastSyncedTitle", { time: timeStr })}
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        <span>{t("sync.synced")}</span>
      </div>
    );
  }

  return null;
}
