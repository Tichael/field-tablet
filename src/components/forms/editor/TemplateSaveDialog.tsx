import { useState, useEffect } from "react";
import type { FormTemplate } from "../../../types/form";
import { syncManager } from "../../../lib/sync/sync-manager";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { sanitizeFilenamePart } from "../../../lib/forms/pdf-generator";
import { GenericFileBrowser } from "../../documents/GenericFileBrowser";
import {
  X,
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
      setError("Form title is required.");
      return;
    }

    if (!targetFolder) {
      setError("Destination folder is required.");
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
              `A form template already exists in "/${cleanTarget}". Do you want to overwrite it?`,
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
      setError(e.message || "Failed to save template to disk.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150 text-foreground">
      <div className="bg-background rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20 shrink-0">
          <div>
            <h3 className="font-bold text-lg">Save Form Template</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Confirm form details and select destination folder.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
            title="Close"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2 whitespace-pre-line">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="save-title" className="text-xs font-semibold">
              Form Title <span className="text-destructive">*</span>
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
              Description (Optional)
            </Label>
            <Input
              id="save-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary shown on forms dashboard"
              className="text-xs"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="save-cat" className="text-xs font-semibold">
              Category Tag (Optional)
            </Label>
            <Input
              id="save-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Safety, Maintenance, Reports, Quality"
              className="text-xs"
            />
          </div>

          {/* Destination Folder Selector */}
          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="save-folder" className="text-xs font-semibold">
                Direct Folder Path <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Destination on storage / SMB share
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
                  placeholder="e.g. Daily Reports or Safety/Inspections"
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
                title="Browse existing folders"
              >
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Browse</span>
              </Button>
            </div>

            {/* Resulting Path Preview Card */}
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <FolderCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Disk & SMB Storage Layout</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground space-y-0.5 pl-6">
                <div>
                  Template:{" "}
                  <span className="text-foreground font-semibold">
                    /{targetFolder || "..."}/form.json
                  </span>
                </div>
                <div>
                  Submissions & PDFs:{" "}
                  <span className="text-foreground">
                    /{targetFolder || "..."}/Filled Forms/
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-2 bg-muted/10 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
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
                <span>Saving Template...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Template</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Directory Browser Modal */}
      {isBrowserOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-xl h-[80vh] flex flex-col overflow-hidden border">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20 shrink-0">
              <div>
                <h4 className="font-semibold text-base">
                  Select Destination Folder
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Browse or create a folder on the storage share.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsBrowserOpen(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-3 sm:p-4">
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
          </div>
        </div>
      )}
    </div>
  );
}
