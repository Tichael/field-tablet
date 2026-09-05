import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/app-store";
import { RefreshCw, CheckCircle, AlertCircle, CloudUpload } from "lucide-react";
import { formatAppTime } from "../../i18n";
import { cn } from "@/lib/utils";

interface SyncIndicatorProps {
  className?: string;
}

export function SyncIndicator({ className }: SyncIndicatorProps = {}) {
  const { t } = useTranslation();
  const isSyncing = useAppStore((state) => state.isSyncing);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const error = useAppStore((state) => state.error);
  const pendingUploadsCount = useAppStore((state) => state.pendingUploadsCount);

  if (isSyncing) {
    return (
      <div
        className={cn(
          "flex items-center text-xs sm:text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800 cursor-default shrink-0",
          className,
        )}
        title={t("sync.syncingTitle")}
      >
        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 animate-spin" />
        <span>{t("sync.syncing")}</span>
      </div>
    );
  }

  if (pendingUploadsCount > 0) {
    return (
      <div
        className={cn(
          "flex items-center text-xs sm:text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 cursor-default shrink-0",
          className,
        )}
        title={t("sync.waitingToUploadTitle", { count: pendingUploadsCount })}
      >
        <CloudUpload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
        <span>{t("sync.waitingToUpload", { count: pendingUploadsCount })}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center text-xs sm:text-sm text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800 cursor-help shrink-0",
          className,
        )}
        title={t("sync.syncFailedTitle", { error })}
      >
        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
        <span>{t("sync.syncFailed")}</span>
      </div>
    );
  }

  if (lastSyncTime) {
    const timeStr = formatAppTime(lastSyncTime);
    return (
      <div
        className={cn(
          "flex items-center text-xs sm:text-sm text-green-600 bg-green-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-green-200 dark:border-emerald-800 cursor-default shrink-0",
          className,
        )}
        title={t("sync.lastSyncedTitle", { time: timeStr })}
      >
        <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
        <span>{t("sync.synced")}</span>
      </div>
    );
  }

  return null;
}
