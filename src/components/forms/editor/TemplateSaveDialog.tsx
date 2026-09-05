import { useState, useEffect } from "react";
import type { FormTemplate } from "../../../types/form";
import { syncManager } from "../../../lib/sync/sync-manager";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { useTranslation } from "react-i18next";
import { sanitizeFilenamePart } from "../../../lib/forms/pdf-generator";
import { GenericFileBrowser } from "../../documents/GenericFileBrowser";
import { AppDialog } from "../../ui/app-dialog";
import {
  Save,
  Loader2,
  FolderCheck,
  AlertCircle,
  FolderOpen,
} from "lucide-react";

interface TemplateSaveDialogProps {
  isOpen: boolean;
  template: FormTemplate;
  onClose: () => void;
  onSave: (finalTemplate: FormTemplate, targetFolder: string) => Promise<void>;
}

export function TemplateSaveDialog({
  isOpen,
  template,
  onClose,
  onSave,
}: TemplateSaveDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description || "");
  const [category, setCategory] = useState(template.category || "");

  // Direct folder path
  const [folderPath, setFolderPath] = useState<string>(() => {
    if (template.folderPath) {
      return template.folderPath.trim().replace(/^\/+|\/+$/g, "");
    }
    return sanitizeFilenamePart(template.title) || "Custom Form";
  });

  const [isFolderManuallyEdited, setIsFolderManuallyEdited] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setTitle(template.title);
    setDescription(template.description || "");
    setCategory(template.category || "");

    if (template.folderPath) {
      setFolderPath(template.folderPath.trim().replace(/^\/+|\/+$/g, ""));
      setIsFolderManuallyEdited(true);
    } else {
      setFolderPath(sanitizeFilenamePart(template.title) || "Custom Form");
      setIsFolderManuallyEdited(false);
    }
    setError(null);
  }, [isOpen, template]);

  if (!isOpen) return null;

  const targetFolder = folderPath.trim().replace(/^\/+|\/+$/g, "");

  const handleConfirmSave = async () => {
    if (!title.trim()) {
      setError(t("editor.saveDialog.formTitleRequired"));
      return;
    }

    if (!targetFolder) {
      setError(t("editor.saveDialog.folderPathRequired"));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Check if target folder already has a form.json when saving to a new or different folder
      const cleanTarget = targetFolder.trim().replace(/^\/+|\/+$/g, "");
      const cleanOriginal = (template.folderPath || "")
        .trim()
        .replace(/^\/+|\/+$/g, "");

      if (cleanTarget !== cleanOriginal) {
        try {
          const adapter = syncManager.getAdapter();
          const existing = await adapter.readFileText(
            `${cleanTarget}/form.json`,
          );
          if (existing) {
            const confirmed = window.confirm(
              t("editor.saveDialog.overwriteConfirm", { folder: cleanTarget }),
            );
            if (!confirmed) {
              setIsSaving(false);
              return;
            }
          }
        } catch {
          // File does not exist, safe to proceed
        }
      }

      const updatedTemplate: FormTemplate = {
        ...template,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        folderPath: template.folderPath || targetFolder,
      };

      await onSave(updatedTemplate, targetFolder);
      onClose();
    } catch (e: any) {
      console.error("Failed to save template:", e);
      setError(e.message || t("editor.saveDialog.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <AppDialog
        isOpen={isOpen}
        onClose={onClose}
        title={t("editor.saveDialog.title")}
        subtitle={t("editor.saveDialog.subtitle")}
        maxWidth="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSave}
              disabled={isSaving || !title.trim() || !targetFolder}
              className="gap-1.5 font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("editor.saveDialog.savingTemplate")}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t("editor.saveDialog.saveTemplateButton")}</span>
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2 whitespace-pre-line">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="save-title" className="text-xs font-semibold">
              {t("editor.saveDialog.formTitle")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="save-title"
              value={title}
              onChange={(e) => {
                const newTitle = e.target.value;
                setTitle(newTitle);
                if (!template.folderPath && !isFolderManuallyEdited) {
                  setFolderPath(
                    sanitizeFilenamePart(newTitle) || "Custom Form",
                  );
                }
              }}
              placeholder="e.g. Daily Safety Inspection"
              className="text-sm font-medium"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="save-desc" className="text-xs font-semibold">
              {t("editor.saveDialog.description")}
            </Label>
            <Input
              id="save-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("editor.saveDialog.descriptionPlaceholder")}
              className="text-xs"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="save-cat" className="text-xs font-semibold">
              {t("editor.saveDialog.category")}
            </Label>
            <Input
              id="save-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("editor.saveDialog.categoryPlaceholder")}
              className="text-xs"
            />
          </div>

          {/* Destination Folder Selector */}
          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="save-folder" className="text-xs font-semibold">
                {t("editor.saveDialog.folderPath")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {t("editor.saveDialog.storageDestinationHint")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="save-folder"
                  value={folderPath}
                  onChange={(e) => {
                    setFolderPath(e.target.value);
                    setIsFolderManuallyEdited(true);
                  }}
                  placeholder={t("editor.saveDialog.folderPathPlaceholder")}
                  className="font-mono text-xs pl-6"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs select-none">
                  /
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBrowserOpen(true)}
                className="gap-1.5 text-xs shrink-0"
                title={t("editor.saveDialog.browseExistingFolders")}
              >
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t("common.browse")}</span>
              </Button>
            </div>

            {/* Resulting Path Preview Card */}
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <FolderCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t("editor.saveDialog.storageLayoutTitle")}</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground space-y-0.5 pl-6">
                <div>
                  {t("editor.saveDialog.templatePathLabel")}{" "}
                  <span className="text-foreground font-semibold">
                    /{targetFolder || "..."}/form.json
                  </span>
                </div>
                <div>
                  {t("editor.saveDialog.submissionsPathLabel")}{" "}
                  <span className="text-foreground">
                    /{targetFolder || "..."}/Filled Forms/
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppDialog>

      {/* Directory Browser Modal */}
      <AppDialog
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        title={t("editor.saveDialog.selectDestinationFolder")}
        subtitle={t("editor.saveDialog.selectDestinationFolderSubtitle")}
        maxWidth="xl"
      >
        <div className="h-[60vh] -mx-4 -my-4 sm:-mx-6 sm:-my-6">
          <GenericFileBrowser
            onFolderSelect={(path) => {
              setFolderPath(path);
              setIsFolderManuallyEdited(true);
              setIsBrowserOpen(false);
            }}
            onFileSelect={() => {}}
            allowCreateFolder={true}
            allowSelectRoot={false}
          />
        </div>
      </AppDialog>
    </>
  );
}
