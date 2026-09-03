import { useState, useEffect } from "react";
import { get } from "idb-keyval";
import { useConfigStore, DEFAULT_CONFIG } from "../../store/config-store";
import type { AppConfig } from "../../store/config-store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useAppStore } from "../../store/app-store";
import { syncManager } from "../../lib/sync/sync-manager";

import { applyTheme } from "../../lib/theme";
import { GenericFileBrowser } from "../documents/GenericFileBrowser";
import { Folder, FolderPlus, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfigEditorScreenProps {
  onClose: () => void;
}

export function ConfigEditorScreen({ onClose }: ConfigEditorScreenProps) {
  const { config, saveConfig, activeConfigFile } = useConfigStore();
  const isSyncing = useAppStore((state) => state.isSyncing);
  const isConfigured = useAppStore((state) => state.isConfigured);

  const [formData, setFormData] = useState<AppConfig>(config || DEFAULT_CONFIG);
  const [isBrowserOpen, setBrowserOpen] = useState(false);
  const [folderNotice, setFolderNotice] = useState<{
    type: "info" | "warning";
    message: string;
  } | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);

  const handleAddSyncFolder = (path: string) => {
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, "");
    if (!cleanPath) {
      setBrowserOpen(false);
      return;
    }

    const currentFolders = formData.syncFolders || [];
    const normalizedCurrent = currentFolders.map((f) =>
      f.trim().replace(/^\/+|\/+$/g, ""),
    );

    // Check 1: Already exists in sync list
    if (normalizedCurrent.includes(cleanPath)) {
      setFolderNotice({
        type: "warning",
        message: `Folder "/${cleanPath}" is already configured to sync.`,
      });
      setBrowserOpen(false);
      return;
    }

    // Check 2: Parent folder is already in sync list
    const parentFolder = normalizedCurrent.find((f) =>
      cleanPath.startsWith(`${f}/`),
    );
    if (parentFolder) {
      const confirmed = window.confirm(
        `Folder "/${cleanPath}" is inside "/${parentFolder}", which is already being synced. Do you still want to add it as a separate sync folder?`,
      );
      if (!confirmed) {
        setBrowserOpen(false);
        return;
      }
    }

    // Check 3: If adding a parent of already synced subfolders, clean up redundant subfolders
    const childFolders = normalizedCurrent.filter((f) =>
      f.startsWith(`${cleanPath}/`),
    );
    let newFolders: string[];
    if (childFolders.length > 0) {
      newFolders = normalizedCurrent.filter(
        (f) => !f.startsWith(`${cleanPath}/`),
      );
      newFolders.push(cleanPath);
      setFolderNotice({
        type: "info",
        message: `Added "/${cleanPath}" and merged redundant subfolder(s): ${childFolders.map((c) => `/${c}`).join(", ")}.`,
      });
    } else {
      newFolders = [...normalizedCurrent, cleanPath];
      setFolderNotice(null);
    }

    setFormData((prev) => ({
      ...prev,
      syncFolders: newFolders,
    }));
    setBrowserOpen(false);
  };

  const handleRemoveSyncFolder = (path: string) => {
    setFormData((prev) => ({
      ...prev,
      syncFolders: (prev.syncFolders || []).filter((f) => f !== path),
    }));
  };

  const [saveAsName, setSaveAsName] = useState(
    activeConfigFile || "app-config.json",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  // Check network share connection on mount (unless unconfigured initial setup)
  useEffect(() => {
    if (!isConfigured) {
      setIsConnected(true);
      return;
    }
    let isMounted = true;
    setCheckingConnection(true);
    syncManager
      .checkShareConnection()
      .then((connected) => {
        if (isMounted) {
          setIsConnected(connected);
          setCheckingConnection(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsConnected(false);
          setCheckingConnection(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [isConfigured]);

  // Live preview effect: apply changes as user adjusts settings
  useEffect(() => {
    applyTheme(formData.theme);
  }, [formData.theme]);

  // On unmount, restore the original saved theme if the editor was closed without saving
  useEffect(() => {
    return () => {
      if (config) {
        applyTheme(config.theme);
      }
    };
  }, [config]);

  // Warn on browser navigate/close if there are unsaved changes
  useEffect(() => {
    const hasUnsavedChanges =
      JSON.stringify(formData) !== JSON.stringify(config || DEFAULT_CONFIG);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formData, config]);

  const handleThemeChange = (key: keyof AppConfig["theme"], value: string) => {
    setFormData((prev) => ({
      ...prev,
      theme: { ...prev.theme, [key]: value },
    }));
  };

  const handleBrandingChange = (
    key: keyof AppConfig["branding"],
    value: string | undefined,
  ) => {
    setFormData((prev) => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleBrandingChange("logoBase64", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    handleBrandingChange("logoBase64", undefined);
  };

  const handleSave = async () => {
    let finalName = saveAsName.trim();
    if (!finalName.endsWith(".json")) {
      finalName += ".json";
    }

    if (finalName !== activeConfigFile) {
      try {
        const files = await get("app_config_files");
        if (files && Array.isArray(files)) {
          const exists = files.find((f: any) => f.name === finalName);
          if (exists) {
            const confirm = window.confirm(
              `A configuration file named "${finalName}" already exists. Do you want to overwrite it?`,
            );
            if (!confirm) return;
          }
        }
      } catch (e) {
        console.error("Failed to check existing files", e);
      }
    }

    setIsSaving(true);
    try {
      await saveConfig(formData, finalName);
      onClose();
    } catch (e) {
      alert("Failed to save configuration.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const hasUnsavedChanges =
      JSON.stringify(formData) !== JSON.stringify(config || DEFAULT_CONFIG);
    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        "You have unsaved changes. Are you sure you want to discard them?",
      );
      if (!confirm) return;
    }
    onClose();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Configuration Editor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the app's appearance and branding.
          </p>
        </div>
      </div>

      {isConfigured && isConnected === false && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 p-4 rounded-xl flex items-center gap-3 animate-in fade-in duration-150">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Network Share Disconnected</p>
            <p className="text-xs mt-0.5">
              Configuration cannot be edited while offline to prevent conflicts.
              Please reconnect to your network share to make and save changes.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="theme" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="theme">Theme & Layout</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="sync">Sync Folders</TabsTrigger>
        </TabsList>

        <TabsContent value="theme">
          <Card>
            <CardHeader>
              <CardTitle>Theme Colors</CardTitle>
              <CardDescription>
                Adjust the primary colors and dark mode settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-3 items-center">
                  <Input
                    id="primaryColor"
                    type="color"
                    className="w-16 h-10 p-1 cursor-pointer"
                    value={formData.theme.primaryColor}
                    onChange={(e) =>
                      handleThemeChange("primaryColor", e.target.value)
                    }
                  />
                  <Input
                    type="text"
                    value={formData.theme.primaryColor}
                    onChange={(e) =>
                      handleThemeChange("primaryColor", e.target.value)
                    }
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="darkMode">Dark Mode</Label>
                <Select
                  value={formData.theme.darkMode}
                  onValueChange={(val) => {
                    if (val) handleThemeChange("darkMode", val);
                  }}
                >
                  <SelectTrigger id="darkMode">
                    <SelectValue placeholder="Select dark mode preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">
                      Auto (System Default)
                    </SelectItem>
                    <SelectItem value="light">Always Light</SelectItem>
                    <SelectItem value="dark">Always Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>App Branding</CardTitle>
              <CardDescription>
                Customize the app title and logo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="appTitle">In-App Title</Label>
                <Input
                  id="appTitle"
                  value={formData.branding.appTitle}
                  onChange={(e) =>
                    handleBrandingChange("appTitle", e.target.value)
                  }
                  placeholder="e.g. Field Tablet App"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="logoUpload">Company Logo (Optional)</Label>
                {formData.branding.logoBase64 ? (
                  <div className="flex flex-col gap-3 items-start border rounded-md p-4">
                    <img
                      src={formData.branding.logoBase64}
                      alt="Logo preview"
                      className="max-h-24 object-contain rounded"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveImage}
                    >
                      Remove Image
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="logoUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  This image will be saved directly into your configuration
                  file. For best performance, use a small image.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>Sync Folders</CardTitle>
              <CardDescription>
                Configure the folders that should be synchronized for offline
                document viewing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {folderNotice && (
                <div
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg text-xs font-medium border animate-in fade-in duration-150",
                    folderNotice.type === "warning"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{folderNotice.message}</span>
                  </div>
                  <button
                    onClick={() => setFolderNotice(null)}
                    className="text-muted-foreground hover:text-foreground p-1 text-xs"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <Label>Folders to Sync</Label>
                {!formData.syncFolders || formData.syncFolders.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No sync folders added. Root files will be synced.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {formData.syncFolders.map((folder) => (
                      <li
                        key={folder}
                        className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/20"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-mono text-sm truncate">
                            /{folder}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSyncFolder(folder)}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 shrink-0"
                          title={`Remove /${folder}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => setBrowserOpen(true)}
                >
                  <FolderPlus className="w-4 h-4 mr-2" /> Add Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isBrowserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden border">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20 shrink-0">
              <div>
                <h3 className="font-semibold text-lg">Select Folder to Sync</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Browse or create a folder to synchronize with this device.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBrowserOpen(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-3 sm:p-4">
              <GenericFileBrowser
                onFolderSelect={handleAddSyncFolder}
                onFileSelect={() => {}} // No-op, we only care about folders
                allowCreateFolder={true}
                allowSelectRoot={false}
                existingFolders={formData.syncFolders || []}
              />
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="saveAsName">Save Configuration As</Label>
            <Input
              id="saveAsName"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              placeholder="app-config.json"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={handleCancel}
              disabled={isSaving || isSyncing}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={handleSave}
              disabled={
                isSaving ||
                isSyncing ||
                !saveAsName.trim() ||
                (isConfigured && isConnected === false) ||
                checkingConnection
              }
              title={
                isConfigured && isConnected === false
                  ? "Cannot save while disconnected from network share"
                  : undefined
              }
            >
              {isSaving || isSyncing
                ? "Saving..."
                : checkingConnection
                  ? "Checking Connection..."
                  : "Save & Apply Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
