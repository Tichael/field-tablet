import { useState, useEffect, useMemo, useCallback } from "react";
import { get } from "idb-keyval";
import {
  useConfigStore,
  DEFAULT_CONFIG,
  getFormFoldersList,
} from "../../store/config-store";
import type { AppConfig } from "../../store/config-store";
import type { FormTemplate } from "../../types/form";
import { formService } from "../../lib/forms/form-service";
import { FormEditor } from "../forms/editor/FormEditor";
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
  Plus,
  Edit3,
  Copy,
  Loader2,
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

  // Form Editor state inside ConfigEditorScreen
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<FormTemplate | null>(
    null,
  );
  const [loadedTemplates, setLoadedTemplates] = useState<
    Record<string, FormTemplate | null>
  >({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const currentFormFolders = useMemo(
    () => getFormFoldersList(formData),
    [formData],
  );

  const loadTemplatesForFolders = useCallback(async (folders: string[]) => {
    setLoadingTemplates(true);
    const results: Record<string, FormTemplate | null> = {};
    for (const folder of folders) {
      try {
        const tmpl = await formService.loadTemplate(folder);
        results[folder] = tmpl;
      } catch {
        results[folder] = null;
      }
    }
    setLoadedTemplates(results);
    setLoadingTemplates(false);
  }, []);

  useEffect(() => {
    loadTemplatesForFolders(currentFormFolders);
  }, [currentFormFolders, loadTemplatesForFolders]);

  const handleCreateNewForm = () => {
    setTemplateToEdit(null);
    setIsEditingTemplate(true);
  };

  const handleEditForm = async (folder: string) => {
    let tmpl = loadedTemplates[folder];
    if (!tmpl) {
      tmpl = await formService.loadTemplate(folder);
    }
    if (tmpl) {
      setTemplateToEdit(tmpl);
    } else {
      setTemplateToEdit(formService.createEmptyTemplate("New Form", folder));
    }
    setIsEditingTemplate(true);
  };

  const handleDuplicateForm = async (folder: string) => {
    let tmpl = loadedTemplates[folder];
    if (!tmpl) {
      tmpl = await formService.loadTemplate(folder);
    }
    if (!tmpl) return;

    const randomSuffix = Math.random().toString(36).slice(2, 6);
    const cleanTitle = `${tmpl.title} (Copy)`;
    const cloned: FormTemplate = {
      ...JSON.parse(JSON.stringify(tmpl)),
      id: `${tmpl.id}_copy_${randomSuffix}`,
      title: cleanTitle,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderPath: `${tmpl.folderPath}_copy`,
      legacyFolderPaths: undefined,
    };
    setTemplateToEdit(cloned);
    setIsEditingTemplate(true);
  };

  const handleUnlinkFormFolder = (folderToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      formFolders: getFormFoldersList(prev).filter((f) => f !== folderToRemove),
    }));
    setFolderNotice({
      type: "info",
      message: `Unlinked "/${folderToRemove}". Files on the storage share were not deleted.`,
    });
  };

  const handleFormSaved = (saved: FormTemplate) => {
    setIsEditingTemplate(false);
    setTemplateToEdit(null);
    const cleanFolder = saved.folderPath.trim().replace(/^\/+|\/+$/g, "");

    setFormData((prev) => {
      const currentList = getFormFoldersList(prev);
      if (!currentList.includes(cleanFolder)) {
        return {
          ...prev,
          formFolders: [...currentList, cleanFolder],
        };
      }
      return prev;
    });

    setLoadedTemplates((prev) => ({
      ...prev,
      [cleanFolder]: saved,
    }));
  };

  const handleAddFormFolder = async (path: string) => {
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, "");
    if (!cleanPath) {
      setBrowserOpen(false);
      return;
    }

    const currentList = getFormFoldersList(formData);
    if (currentList.includes(cleanPath)) {
      setFolderNotice({
        type: "info",
        message: `Folder "/${cleanPath}" is already added as a form folder.`,
      });
      setBrowserOpen(false);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      formFolders: [...getFormFoldersList(prev), cleanPath],
    }));

    try {
      const tmpl = await formService.loadTemplate(cleanPath);
      if (tmpl) {
        setLoadedTemplates((prev) => ({ ...prev, [cleanPath]: tmpl }));
        setFolderNotice({
          type: "info",
          message: `Linked "/${cleanPath}" (Found form: "${tmpl.title}").`,
        });
      } else {
        setFolderNotice({
          type: "info",
          message: `Linked "/${cleanPath}". No form.json found yet—click "Create Template" to add one.`,
        });
      }
    } catch {
      // ignore
    }

    setBrowserOpen(false);
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

  if (isEditingTemplate) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <FormEditor
          initialTemplate={templateToEdit}
          onClose={() => {
            setIsEditingTemplate(false);
            setTemplateToEdit(null);
          }}
          onSaved={handleFormSaved}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Configuration Editor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the app's appearance, forms, and folders.
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
          <TabsTrigger value="forms">Forms & Folders</TabsTrigger>
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
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Forms & Folders</CardTitle>
                <CardDescription>
                  Create, edit, and organize form templates and their folders.
                  Forms configured here appear on the main screen for field
                  operators to fill.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={handleCreateNewForm}
                  className="gap-1.5 font-semibold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Form</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBrowserMode("form");
                    setBrowserOpen(true);
                  }}
                  className="gap-1.5 text-xs"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Link Existing Folder</span>
                </Button>
              </div>
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

              {currentFormFolders.length === 0 ? (
                <div className="border border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center space-y-3 bg-muted/10">
                  <FolderPlus className="w-10 h-10 text-muted-foreground/50" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">
                      No Forms or Form Folders Configured
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Create a new form template to define questions and its
                      storage folder, or link an existing folder on the storage
                      share.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleCreateNewForm}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Form</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBrowserMode("form");
                        setBrowserOpen(true);
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Link Folder</span>
                    </Button>
                  </div>
                </div>
              ) : loadingTemplates ? (
                <div className="border rounded-xl p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/10">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading form templates...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentFormFolders.map((folder) => {
                    const tmpl = loadedTemplates[folder];
                    return (
                      <div
                        key={folder}
                        className="border rounded-xl p-4 bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate">
                              {tmpl ? tmpl.title : folder}
                            </span>
                            {tmpl?.version && (
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                v{tmpl.version}
                              </span>
                            )}
                            {tmpl?.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/40 font-medium">
                                {tmpl.category}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">/{folder}</span>
                          </div>

                          {tmpl ? (
                            <p className="text-xs text-muted-foreground">
                              {tmpl.sections.length} Section
                              {tmpl.sections.length > 1 ? "s" : ""} •{" "}
                              {tmpl.sections.reduce(
                                (acc, s) => acc + s.fields.length,
                                0,
                              )}{" "}
                              Fields
                              {tmpl.description ? ` — ${tmpl.description}` : ""}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              No form.json found in this folder yet.
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditForm(folder)}
                            className="gap-1 text-xs"
                            title="Edit Template Schema & Questions"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-primary" />
                            <span>
                              {tmpl ? "Edit Form" : "Create Template"}
                            </span>
                          </Button>

                          {tmpl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDuplicateForm(folder)}
                              className="text-xs px-2"
                              title="Duplicate / Clone Form"
                            >
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkFormFolder(folder)}
                            className="text-destructive hover:bg-destructive/10 text-xs px-2"
                            title="Unlink form folder from configuration (files on share are not deleted)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                    ? "Select Folder to Link"
                    : "Select Folder to Sync"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {browserMode === "form"
                    ? "Browse or select an existing folder on the storage share to link as a form folder."
                    : "Browse or create a folder to synchronize with this device."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBrowserOpen(false);
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
              disabled={isConfigured && isConnected === false}
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
          {isConfigured && isConnected === false && (
            <p className="text-xs text-center text-amber-600 dark:text-amber-400 font-medium">
              Network share is disconnected. Connect to the network share to
              save configuration changes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
