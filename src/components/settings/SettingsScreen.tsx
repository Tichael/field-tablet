import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import { useConfigStore } from "../../store/config-store";
import { del } from "idb-keyval";
import { Button } from "../ui/button";
import { SyncIndicator } from "../ui/SyncIndicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ConfigEditorScreen } from "./ConfigEditorScreen";
import { Capacitor } from "@capacitor/core";
import {
  SUPPORTED_LANGUAGES,
  getAppLanguage,
  getDeviceLanguageOverride,
  setDeviceLanguage,
  clearDeviceLanguageOverride,
  formatAppDateTime,
  type SupportedLanguage,
} from "../../i18n";
import { Globe, RotateCcw } from "lucide-react";

export function SettingsScreen() {
  const { t } = useTranslation();
  const isSyncing = useAppStore((state) => state.isSyncing);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const setConfigured = useAppStore((state) => state.setConfigured);
  const config = useConfigStore((state) => state.config);
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
    const target = isNative
      ? t("settings.targetSmbShare")
      : t("settings.targetSourceFolder");
    const confirmed = window.confirm(
      t("settings.resetAlertPrompt", { target }),
    );
    if (!confirmed) return;

    await del("app_config_directory_handle");
    setActiveConfigFile("");
    setConfigured(false);
  };

  const currentLanguage = getAppLanguage();
  const hasManualOverride = getDeviceLanguageOverride() !== null;

  if (isEditingConfig) {
    return (
      <div className="fixed inset-0 z-40 bg-background flex flex-col">
        <ConfigEditorScreen onClose={handleCloseEditor} />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 bg-background border rounded-xl shadow-sm max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("settings.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Sync Status */}
        <div className="bg-muted/50 p-4 rounded-lg border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t("settings.syncStatus")}</h3>
            <SyncIndicator />
          </div>
          {lastSyncTime && (
            <p className="text-xs text-muted-foreground">
              {t("settings.lastSynced", {
                time: formatAppDateTime(lastSyncTime),
              })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleManualSync} disabled={isSyncing}>
            {t("settings.syncNow")}
          </Button>
          <Button onClick={handleLoadConfig} variant="outline">
            {t("settings.loadConfigFile")}
          </Button>
        </div>

        {/* Device Language Settings */}
        <div className="pt-6 border-t space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium">
              {t("settings.languageTitle")}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.languageSubtitle")}
          </p>

          <div className="flex items-center gap-3 pt-1">
            <Select
              value={currentLanguage}
              onValueChange={(val) => {
                if (val) setDeviceLanguage(val as SupportedLanguage);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasManualOverride && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  clearDeviceLanguageOverride(config?.language || "en")
                }
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                title={t("settings.resetLanguageToDefault")}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t("settings.resetLanguageToDefault")}</span>
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("languages.deviceNote")}
          </p>
        </div>

        {/* Editor */}
        <div className="pt-6 border-t">
          <h3 className="text-sm font-medium mb-3">
            {t("settings.editorTitle")}
          </h3>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setEditingConfig(true)}
          >
            {t("settings.openConfigEditor")}
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 border-t flex flex-col items-start gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("settings.dangerZone")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.dangerZoneDesc")}
          </p>
          <Button
            onClick={handleClear}
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 mt-2"
          >
            {t("settings.resetConfig")}
          </Button>
        </div>
      </div>
    </div>
  );
}
