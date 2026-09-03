import { useState, useEffect } from "react";
import { get } from "idb-keyval";
import {
  useConfigStore,
  DEFAULT_CONFIG,
  getFormFoldersList,
} from "../../store/config-store";
import type { AppConfig, FormFoldersConfig } from "../../store/config-store";
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
import {
  Folder,
  FolderPlus,
  Trash2,
  AlertCircle,
  FileText,
} from "lucide-react";
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
  const [browserMode, setBrowserMode] = useState<"sync" | "form">("sync");
  const [formTypeForFolder, setFormTypeForFolder] = useState<
    keyof FormFoldersConfig | null
  >(null);
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

  const handleAddFormFolder = (path: string) => {
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, "");
    if (!cleanPath || !formTypeForFolder) {
      setBrowserOpen(false);
      setFormTypeForFolder(null);
      return;
    }

    setFormData((prev) => {
      const current =
        typeof prev.formFolders === "object" && !Array.isArray(prev.formFolders)
          ? { ...prev.formFolders }
          : {};
      current[formTypeForFolder] = cleanPath;
      return {
        ...prev,
        formFolders: current,
      };
    });
    setFolderNotice(null);
    setBrowserOpen(false);
    setFormTypeForFolder(null);
  };

  const handleClearFormFolder = (type: keyof FormFoldersConfig) => {
    setFormData((prev) => {
      const current =
        typeof prev.formFolders === "object" && !Array.isArray(prev.formFolders)
          ? { ...prev.formFolders }
          : {};
      delete current[type];
      return {
        ...prev,
        formFolders: current,
      };
    });
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

  const handlePdfPageSizeChange = (value: "a4" | "letter") => {
    setFormData((prev) => ({
      ...prev,
      pdfPageSize: value,
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="theme">Theme & Layout</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="sync">Sync Folders</TabsTrigger>
          <TabsTrigger value="forms">Form Folders</TabsTrigger>
        </TabsList>

        <TabsContent value="theme">
          <Card>
            <CardHeader>
              <CardTitle>Theme Colors & Layout</CardTitle>
              <CardDescription>
                Adjust primary colors, dark mode preference, and PDF export
                sizing.
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

              <div className="space-y-2">
                <Label htmlFor="pdfPageSize">
                  Default PDF Page Size (App-Wide)
                </Label>
                <Select
                  value={formData.pdfPageSize || "a4"}
                  onValueChange={(val) => {
                    if (val === "a4" || val === "letter")
                      handlePdfPageSizeChange(val);
                  }}
                >
                  <SelectTrigger id="pdfPageSize">
                    <SelectValue placeholder="Select default PDF page size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">
                      A4 (210 × 297 mm - Standard International)
                    </SelectItem>
                    <SelectItem value="letter">
                      Letter (8.5 × 11 in - US / Canada / Mexico)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Applied across all generated form PDF snapshots.
                </p>
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
                  onClick={() => {
                    setBrowserMode("sync");
                    setBrowserOpen(true);
                  }}
                >
                  <FolderPlus className="w-4 h-4 mr-2" /> Add Document Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms">
          <Card>
            <CardHeader>
              <CardTitle>Form Folders</CardTitle>
              <CardDescription>
                Configure dedicated folders for each of the three field form
                types. Templates, filled submissions, and dated PDF exports are
                stored inside each configured folder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Daily Reports Folder */}
              <div className="p-4 border rounded-xl bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>Daily Reports Folder</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shift progress, crew personnel, work activities, and
                      supervisor sign-offs.
                    </p>
                  </div>
                  {formData.formFolders?.dailyReports ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrowserMode("form");
                          setFormTypeForFolder("dailyReports");
                          setBrowserOpen(true);
                        }}
                        className="text-xs"
                      >
                        Change
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearFormFolder("dailyReports")}
                        className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setBrowserMode("form");
                        setFormTypeForFolder("dailyReports");
                        setBrowserOpen(true);
                      }}
                      className="text-xs shrink-0"
                    >
                      <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                      Select Folder
                    </Button>
                  )}
                </div>
                <div className="text-xs font-mono p-2.5 rounded-lg bg-muted/30 border">
                  {formData.formFolders?.dailyReports ? (
                    <span className="font-semibold text-foreground">
                      /{formData.formFolders.dailyReports}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Not configured (form cannot be filled until configured)
                    </span>
                  )}
                </div>
              </div>

              {/* Incident Logs Folder */}
              <div className="p-4 border rounded-xl bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Incident Logs Folder</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Immediate reporting of safety, equipment, near-miss, and
                      environmental incidents.
                    </p>
                  </div>
                  {formData.formFolders?.incidentLogs ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrowserMode("form");
                          setFormTypeForFolder("incidentLogs");
                          setBrowserOpen(true);
                        }}
                        className="text-xs"
                      >
                        Change
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearFormFolder("incidentLogs")}
                        className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setBrowserMode("form");
                        setFormTypeForFolder("incidentLogs");
                        setBrowserOpen(true);
                      }}
                      className="text-xs shrink-0"
                    >
                      <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                      Select Folder
                    </Button>
                  )}
                </div>
                <div className="text-xs font-mono p-2.5 rounded-lg bg-muted/30 border">
                  {formData.formFolders?.incidentLogs ? (
                    <span className="font-semibold text-foreground">
                      /{formData.formFolders.incidentLogs}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Not configured (form cannot be filled until configured)
                    </span>
                  )}
                </div>
              </div>

              {/* Equipment Checks Folder */}
              <div className="p-4 border rounded-xl bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Equipment Checks Folder</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pre-operational machinery checklist, fluids, mechanical
                      checks, and certification.
                    </p>
                  </div>
                  {formData.formFolders?.equipmentChecks ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrowserMode("form");
                          setFormTypeForFolder("equipmentChecks");
                          setBrowserOpen(true);
                        }}
                        className="text-xs"
                      >
                        Change
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearFormFolder("equipmentChecks")}
                        className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setBrowserMode("form");
                        setFormTypeForFolder("equipmentChecks");
                        setBrowserOpen(true);
                      }}
                      className="text-xs shrink-0"
                    >
                      <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                      Select Folder
                    </Button>
                  )}
                </div>
                <div className="text-xs font-mono p-2.5 rounded-lg bg-muted/30 border">
                  {formData.formFolders?.equipmentChecks ? (
                    <span className="font-semibold text-foreground">
                      /{formData.formFolders.equipmentChecks}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Not configured (form cannot be filled until configured)
                    </span>
                  )}
                </div>
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
                <h3 className="font-semibold text-lg">
                  {browserMode === "form"
                    ? formTypeForFolder === "dailyReports"
                      ? "Select Folder for Daily Reports"
                      : formTypeForFolder === "incidentLogs"
                        ? "Select Folder for Incident Logs"
                        : formTypeForFolder === "equipmentChecks"
                          ? "Select Folder for Equipment Checks"
                          : "Select Form Folder"
                    : "Select Folder to Sync"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {browserMode === "form"
                    ? "Browse or create a folder where forms and their filled copies will be stored."
                    : "Browse or create a folder to synchronize with this device."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBrowserOpen(false);
                  setFormTypeForFolder(null);
                }}
              >
                Cancel
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-3 sm:p-4">
              <GenericFileBrowser
                onFolderSelect={
                  browserMode === "form"
                    ? handleAddFormFolder
                    : handleAddSyncFolder
                }
                onFileSelect={() => {}}
                allowCreateFolder={true}
                allowSelectRoot={false}
                existingFolders={
                  browserMode === "form"
                    ? getFormFoldersList(formData)
                    : formData.syncFolders || []
                }
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
