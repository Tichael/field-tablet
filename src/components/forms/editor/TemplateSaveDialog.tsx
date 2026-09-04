import { useState, useEffect } from "react";
import type { FormTemplate } from "../../../types/form";
import {
  useConfigStore,
  getFormFoldersList,
} from "../../../store/config-store";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { sanitizeFilenamePart } from "../../../lib/forms/pdf-generator";
import { X, Save, Loader2, FolderCheck, AlertCircle } from "lucide-react";

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
  const config = useConfigStore((state) => state.config);
  const formFolders = getFormFoldersList(config);

  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description || "");
  const [category, setCategory] = useState(template.category || "");

  // Base folder + subfolder strategy
  const [selectedBaseFolder, setSelectedBaseFolder] = useState<string>(
    formFolders[0] || "Forms",
  );
  const [subfolderName, setSubfolderName] = useState<string>(() => {
    if (template.folderPath) {
      const parts = template.folderPath.split("/").filter(Boolean);
      return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
    }
    return sanitizeFilenamePart(template.title) || "Custom Form";
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(template.title);
    setDescription(template.description || "");
    setCategory(template.category || "");

    if (template.folderPath) {
      const clean = template.folderPath.trim().replace(/^\/+|\/+$/g, "");
      // Check if matches an existing base folder
      const matchingBase = formFolders.find(
        (f) => clean === f || clean.startsWith(`${f}/`),
      );
      if (matchingBase) {
        setSelectedBaseFolder(matchingBase);
        const sub = clean.slice(matchingBase.length).replace(/^\/+/, "");
        setSubfolderName(sub);
      } else {
        setSelectedBaseFolder(clean);
        setSubfolderName("");
      }
    } else {
      setSelectedBaseFolder(formFolders[0] || "Forms");
      setSubfolderName(sanitizeFilenamePart(template.title) || "Custom Form");
    }
    setError(null);
  }, [template, isOpen, formFolders]);

  if (!isOpen) return null;

  const targetFolder = subfolderName.trim()
    ? selectedBaseFolder
      ? `${selectedBaseFolder.trim().replace(/^\/+|\/+$/g, "")}/${subfolderName.trim().replace(/^\/+|\/+$/g, "")}`
      : subfolderName.trim().replace(/^\/+|\/+$/g, "")
    : selectedBaseFolder.trim().replace(/^\/+|\/+$/g, "");

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
      const updatedTemplate: FormTemplate = {
        ...template,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        folderPath: targetFolder,
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
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
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
              onChange={(e) => setTitle(e.target.value)}
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
              <Label className="text-xs font-semibold">
                Destination Folder
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Saved into SMB / local folder
              </span>
            </div>

            {/* Base Folder buttons */}
            {formFolders.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">
                  Base Form Folder:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {formFolders.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSelectedBaseFolder(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                        selectedBaseFolder === f
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-muted/30 hover:bg-muted/70 text-foreground border-input"
                      }`}
                    >
                      /{f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subfolder Input */}
            <div className="space-y-1.5">
              <Label htmlFor="save-subfolder" className="text-xs font-semibold">
                Form Folder Name
              </Label>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0 font-mono text-xs">
                  /{selectedBaseFolder}/
                </div>
                <Input
                  id="save-subfolder"
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                  placeholder="e.g. HVAC Inspection"
                  className="font-mono text-xs"
                />
              </div>
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
                    /{targetFolder}/form.json
                  </span>
                </div>
                <div>
                  Submissions & PDFs:{" "}
                  <span className="text-foreground">
                    /{targetFolder}/Filled Forms/
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
    </div>
  );
}
