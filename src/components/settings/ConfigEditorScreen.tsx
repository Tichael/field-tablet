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

import { applyTheme } from "../../lib/theme";
import { GenericFileBrowser } from "../documents/GenericFileBrowser";
import { FolderPlus, Trash2 } from "lucide-react";

interface ConfigEditorScreenProps {
  onClose: () => void;
}

export function ConfigEditorScreen({ onClose }: ConfigEditorScreenProps) {
  const { config, saveConfig, activeConfigFile } = useConfigStore();
  const isSyncing = useAppStore((state) => state.isSyncing);

  const [formData, setFormData] = useState<AppConfig>(config || DEFAULT_CONFIG);
  const [isBrowserOpen, setBrowserOpen] = useState(false);

  const handleAddSyncFolder = (path: string) => {
    setFormData((prev) => {
      const folders = prev.syncFolders || [];
      if (!folders.includes(path)) {
        return { ...prev, syncFolders: [...folders, path] };
      }
      return prev;
    });
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

  // Live preview effect
  useEffect(() => {
    const cleanup = applyTheme(formData.theme);
    return () => {
      cleanup();
      // On unmount, restore the original theme if we have one
      if (config) {
        applyTheme(config.theme);
      }
    };
  }, [formData.theme, config]);

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
                Configure the folders that should be synchronized for offline document viewing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Folders to Sync</Label>
                {(!formData.syncFolders || formData.syncFolders.length === 0) ? (
                  <p className="text-sm text-muted-foreground italic">No sync folders added.</p>
                ) : (
                  <ul className="space-y-2">
                    {formData.syncFolders.map(folder => (
                      <li key={folder} className="flex items-center justify-between p-2 border rounded bg-muted/20">
                        <span className="font-mono text-sm truncate">/{folder}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveSyncFolder(folder)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" className="w-full mt-2" onClick={() => setBrowserOpen(true)}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Add Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isBrowserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Select Folder to Sync</h3>
              <Button variant="ghost" size="sm" onClick={() => setBrowserOpen(false)}>Cancel</Button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <GenericFileBrowser 
                onFolderSelect={handleAddSyncFolder} 
                onFileSelect={() => {}} // No-op, we only care about folders
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
              disabled={isSaving || isSyncing || !saveAsName.trim()}
            >
              {isSaving || isSyncing
                ? "Saving..."
                : "Save & Apply Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
