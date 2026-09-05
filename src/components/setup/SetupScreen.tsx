import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import {
  useConfigStore,
  DEFAULT_CONFIG,
  type AppConfig,
} from "../../store/config-store";
import { Button } from "../ui/button";
import { Capacitor } from "@capacitor/core";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { GenericFileBrowser } from "../documents/GenericFileBrowser";
import { ChevronLeft, Languages, Loader2 } from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  getAppLanguage,
  setDeviceLanguage,
  type SupportedLanguage,
} from "../../i18n";

export function SetupScreen() {
  const { t } = useTranslation();
  const isSyncing = useAppStore((state) => state.isSyncing);
  const setConfigured = useAppStore((state) => state.setConfigured);
  const setEditingConfig = useAppStore((state) => state.setEditingConfig);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const setActiveConfigFile = useConfigStore(
    (state) => state.setActiveConfigFile,
  );
  const saveConfig = useConfigStore((state) => state.saveConfig);
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  // Check if we are running in a browser on Android (not Capacitor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAndroidBrowser =
    !isNative && /android/i.test(navigator.userAgent || "");

  // Check if the browser supports the File System Access API
  const isBrowserSupported = "showDirectoryPicker" in window;

  const [step, setStep] = useState<1 | 2>(1);
  const [newFileName, setNewFileName] = useState("");
  const [browserPath, setBrowserPath] = useState("");

  const [smbHost, setSmbHost] = useState("");
  const [smbShare, setSmbShare] = useState("");
  const [smbDomain, setSmbDomain] = useState("");
  const [smbUser, setSmbUser] = useState("");
  const [smbPass, setSmbPass] = useState("");

  useEffect(() => {
    if (localStorage.getItem("skipSetupStep1") === "true") {
      localStorage.removeItem("skipSetupStep1");
      setStep(2);
    }
  }, []);

  useEffect(() => {
    document.title = t("header.fieldTablet");
  }, [t]);

  const handleSelectFolder = async () => {
    try {
      const success = await syncManager.configure({ forcePrompt: true });
      if (success) {
        setStep(2);
      }
    } catch (e) {
      console.error("Error during configure:", e);
      alert(t("setup.genericError"));
    }
  };

  const handleNativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const success = await syncManager.configure({
        host: smbHost,
        share: smbShare,
        domain: smbDomain,
        username: smbUser,
        password: smbPass,
      });
      if (!success) {
        alert(t("setup.smbConnectionError"));
      } else {
        setStep(2);
      }
    } catch (e: any) {
      console.error("Error during native configure:", e);
      alert(t("setup.smbConfigError", { error: e.message || "Unknown error" }));
    }
  };

  const selectConfigFile = async (filename: string, isNew = false) => {
    let finalName = filename.trim();
    if (!finalName) {
      alert(t("setup.emptyFilenameError"));
      return;
    }
    if (!finalName.endsWith(".json")) {
      finalName += ".json";
    }

    if (isNew) {
      setIsCreatingConfig(true);
      try {
        // If file already exists on the storage share, ask for confirmation
        try {
          const adapter = syncManager.getAdapter();
          const existing = await adapter.readFileText(finalName);
          if (existing) {
            const overwrite = window.confirm(
              t("editor.config.confirmOverwriteConfig", { name: finalName }),
            );
            if (!overwrite) {
              setIsCreatingConfig(false);
              return;
            }
          }
        } catch {
          // File does not exist yet, proceed
        }

        const currentLang = getAppLanguage();
        const initialConfig: AppConfig = {
          ...DEFAULT_CONFIG,
          language: currentLang,
          branding: {
            ...DEFAULT_CONFIG.branding,
            appTitle: t("header.fieldTabletApp"),
          },
        };

        await saveConfig(initialConfig, finalName);
        localStorage.setItem("openEditor", "true");
        setActiveConfigFile(finalName);
        setSettingsOpen(true);
        setEditingConfig(true);
        setConfigured(true);
      } catch (e) {
        console.error("Failed to save initial configuration:", e);
        alert(t("editor.config.failedToSaveConfig"));
      } finally {
        setIsCreatingConfig(false);
      }
    } else {
      localStorage.removeItem("openEditor");
      setActiveConfigFile(finalName);
      setConfigured(true);
    }
  };

  const handleCreateNewConfig = () => {
    const defaultName = t("setup.defaultConfigFilename");
    const name = newFileName.trim() || defaultName;
    const jsonName = name.endsWith(".json") ? name : name + ".json";
    const fullPath = browserPath ? `${browserPath}/${jsonName}` : jsonName;
    selectConfigFile(fullPath, true);
  };

  const renderLanguagePicker = () => (
    <div className="flex justify-end mb-2">
      <Select
        value={getAppLanguage()}
        onValueChange={(val) => {
          if (val) setDeviceLanguage(val as SupportedLanguage);
        }}
      >
        <SelectTrigger className="h-8 text-xs gap-1.5 w-[150px]">
          <Languages className="w-3.5 h-3.5 text-muted-foreground" />
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
    </div>
  );

  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
        <div className="max-w-2xl w-full bg-background rounded-xl shadow-lg border p-8 space-y-6 flex flex-col h-[80vh]">
          {renderLanguagePicker()}
          <div className="relative flex items-center justify-center shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              className="absolute left-0 gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t("common.back")}</span>
            </Button>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                {t("setup.selectConfiguration")}
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {t("setup.selectConfigSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <GenericFileBrowser
              onFileSelect={(path) => selectConfigFile(path)}
              onPathChange={setBrowserPath}
              allowedExtensions={[".json"]}
            />
          </div>

          <div className="border-t pt-4 space-y-3 mt-4 shrink-0">
            <h3 className="text-sm font-medium">
              {browserPath
                ? t("setup.orCreateNewIn", { path: browserPath })
                : t("setup.orCreateNewAtRoot")}
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder={t("setup.newConfigPlaceholder")}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateNewConfig();
                  }
                }}
                disabled={isCreatingConfig}
              />
              <Button
                onClick={handleCreateNewConfig}
                disabled={isCreatingConfig}
                className="gap-1.5"
              >
                {isCreatingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t("common.loading")}</span>
                  </>
                ) : (
                  t("common.create")
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="max-w-md w-full bg-background rounded-xl shadow-lg border p-8 space-y-6">
        {renderLanguagePicker()}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("setup.appConfiguration")}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {isNative
              ? t("setup.step1SubtitleNative")
              : t("setup.step1SubtitleWeb")}
          </p>
        </div>

        {isAndroidBrowser ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-2">
              {t("setup.androidDetectedTitle")}
            </p>
            <p className="mb-3">{t("setup.androidDetectedDesc")}</p>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() =>
                window.open(
                  "https://github.com/Tichael/field-tablet/releases",
                  "_blank",
                )
              }
            >
              {t("setup.getAndroidApp")}
            </Button>
          </div>
        ) : !isNative && !isBrowserSupported ? (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-1">
              {t("setup.browserNotSupportedTitle")}
            </p>
            <p>{t("setup.browserNotSupportedDesc")}</p>
          </div>
        ) : !isNative ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-1">
              {t("setup.selectMainFolderTitle")}
            </p>
            <p>{t("setup.selectMainFolderDesc")}</p>
          </div>
        ) : null}

        {isNative ? (
          <form
            onSubmit={handleNativeSubmit}
            className="flex flex-col gap-3 pt-4"
          >
            <Input
              type="text"
              placeholder={t("setup.smbHost")}
              value={smbHost}
              onChange={(e) => setSmbHost(e.target.value)}
              required
            />
            <Input
              type="text"
              placeholder={t("setup.shareName")}
              value={smbShare}
              onChange={(e) => setSmbShare(e.target.value)}
              required
            />
            <Input
              type="text"
              placeholder={t("setup.domain")}
              value={smbDomain}
              onChange={(e) => setSmbDomain(e.target.value)}
            />
            <Input
              type="text"
              placeholder={t("setup.username")}
              value={smbUser}
              onChange={(e) => setSmbUser(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder={t("setup.password")}
              value={smbPass}
              onChange={(e) => setSmbPass(e.target.value)}
              required
            />
            <Button
              type="submit"
              disabled={isSyncing}
              className="w-full h-10 mt-2"
            >
              {isSyncing ? t("setup.configuring") : t("setup.connectAndSync")}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={handleSelectFolder}
              disabled={isSyncing || isAndroidBrowser || !isBrowserSupported}
              className="w-full h-10"
            >
              {isSyncing
                ? t("setup.configuring")
                : t("setup.selectSourceFolder")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
