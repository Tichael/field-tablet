import { useState, useMemo } from "react";
import type { FormTemplate, FormSubmission, FormField } from "../../types/form";
import { useConfigStore } from "../../store/config-store";
import { formService } from "../../lib/forms/form-service";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SignaturePad } from "./SignaturePad";
import {
  ChevronLeft,
  AlertCircle,
  Loader2,
  Save,
  CheckCircle2,
  FileText,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FormRunnerProps {
  template: FormTemplate;
  initialSubmission?: FormSubmission;
  onClose: () => void;
  onViewPdf?: (filePath: string) => void;
}

export function FormRunner({
  template,
  initialSubmission,
  onClose,
  onViewPdf,
}: FormRunnerProps) {
  const config = useConfigStore((state) => state.config);

  // Initialize form state
  const [values, setValues] = useState<Record<string, any>>(() => {
    if (initialSubmission) {
      return { ...initialSubmission.values };
    }
    const defaults: Record<string, any> = {};
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const nowDateTimeStr = now.toISOString().slice(0, 16);
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (
          field.type === "date" &&
          (field.defaultValue === "today" ||
            field.id === "work_date" ||
            field.id === "date")
        ) {
          defaults[field.id] = todayStr;
        } else if (
          field.type === "datetime" &&
          (field.defaultValue === "now" ||
            field.id === "incident_datetime" ||
            field.id === "datetime")
        ) {
          defaults[field.id] = nowDateTimeStr;
        } else if (field.defaultValue !== undefined) {
          defaults[field.id] = field.defaultValue;
        }
      }
    }
    return defaults;
  });

  const [savedSubmissionId, setSavedSubmissionId] = useState<
    string | undefined
  >(initialSubmission?.id);

  const [activeSectionId, setActiveSectionId] = useState<string>(
    template.sections[0]?.id || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [lastExportedPdfPath, setLastExportedPdfPath] = useState<string | null>(
    null,
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Track if user has modified anything
  const [isDirty, setIsDirty] = useState(false);

  const handleFieldChange = (fieldId: string, val: any) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
    setIsDirty(true);
    setJustSaved(false);
    // Clear error for this field
    setValidationErrors((prev) => prev.filter((id) => id !== fieldId));
  };

  // Validate required fields
  const validateForm = (): { valid: boolean; missing: string[] } => {
    const missing: string[] = [];
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.required) {
          const val = values[field.id];
          if (field.type === "checkbox") {
            if (val !== true && val !== "true") {
              missing.push(field.id);
            }
          } else if (field.type === "checkbox-group") {
            if (!Array.isArray(val) || val.length === 0) {
              missing.push(field.id);
            }
          } else if (
            val === undefined ||
            val === null ||
            (typeof val === "string" && val.trim() === "")
          ) {
            missing.push(field.id);
          }
        }
      }
    }
    setValidationErrors(missing);
    return { valid: missing.length === 0, missing };
  };

  const handleSave = async (status: "completed" | "draft" = "completed") => {
    if (status === "completed") {
      const { valid, missing } = validateForm();
      if (!valid) {
        // Synchronously switch to first section containing an error
        for (const section of template.sections) {
          const errorField = section.fields.find((f) => missing.includes(f.id));
          if (errorField) {
            setActiveSectionId(section.id);
            break;
          }
        }
        return;
      }
    }

    if (!config) {
      alert("App configuration not loaded. Please try again.");
      return;
    }

    setIsSaving(true);
    try {
      let resolvedId = savedSubmissionId;
      if (!resolvedId) {
        let identifierValue: string | undefined;
        for (const section of template.sections) {
          for (const f of section.fields) {
            if (f.isIdentifier && values[f.id]) {
              identifierValue = String(values[f.id]);
              break;
            }
          }
          if (identifierValue) break;
        }
        resolvedId = formService.generateSubmissionId(
          template.title,
          identifierValue,
        );
        setSavedSubmissionId(resolvedId);
      }

      const submissionToSave: FormSubmission = {
        id: resolvedId,
        templateId: template.id,
        templateTitle: template.title,
        templateVersion: template.version || 1,
        folderPath: template.folderPath,
        createdAt: initialSubmission?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status,
        values,
        pdfExports: initialSubmission?.pdfExports || [],
      };

      const result = await formService.saveSubmissionAndExportPdf(
        template,
        submissionToSave,
        config,
      );

      setLastExportedPdfPath(result.pdfPath);
      setIsDirty(false);
      setJustSaved(true);
      setTimeout(() => {
        setJustSaved(false);
      }, 3500);
    } catch (e) {
      console.error("Failed to save form submission:", e);
      alert("An error occurred while saving the form and exporting the PDF.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close without saving?",
      );
      if (!confirmed) return;
    }
    onClose();
  };

  const renderFieldInput = (field: FormField) => {
    const val = values[field.id];
    const hasError = validationErrors.includes(field.id);

    switch (field.type) {
      case "heading":
        return (
          <div className="pt-2 pb-1 border-b">
            <h4 className="font-semibold text-base text-foreground">
              {field.label}
            </h4>
          </div>
        );

      case "notes":
        return (
          <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground border">
            {field.label}
          </div>
        );

      case "text":
        return (
          <Input
            value={val ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              "h-11 text-base",
              hasError && "border-destructive ring-destructive/20",
            )}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            inputMode="numeric"
            value={val ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              "h-11 text-base",
              hasError && "border-destructive ring-destructive/20",
            )}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={val ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={cn(
              "h-11 text-base",
              hasError && "border-destructive ring-destructive/20",
            )}
          />
        );

      case "time":
        return (
          <Input
            type="time"
            value={val ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={cn(
              "h-11 text-base",
              hasError && "border-destructive ring-destructive/20",
            )}
          />
        );

      case "datetime":
        return (
          <Input
            type="datetime-local"
            value={val ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={cn(
              "h-11 text-base",
              hasError && "border-destructive ring-destructive/20",
            )}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={val ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={cn(
              "text-base min-h-[100px]",
              hasError && "border-destructive ring-destructive/20",
            )}
          />
        );

      case "select":
        return (
          <Select
            value={val ?? ""}
            onValueChange={(selected) => handleFieldChange(field.id, selected)}
          >
            <SelectTrigger
              className={cn(
                "h-11 text-base w-full",
                hasError && "border-destructive ring-destructive/20",
              )}
            >
              <SelectValue
                placeholder={field.placeholder || "Select option..."}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {field.options?.map((opt) => {
              const isSelected = val === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleFieldChange(field.id, opt.value)}
                  className={cn(
                    "flex items-center p-3 rounded-xl border text-left text-sm font-medium transition-all active:scale-[0.99]",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-background hover:bg-muted/60 border-input",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border mr-3 flex items-center justify-center shrink-0",
                      isSelected
                        ? "border-white bg-white"
                        : "border-muted-foreground",
                    )}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        );

      case "checkbox":
        return (
          <button
            type="button"
            onClick={() => handleFieldChange(field.id, !val)}
            className={cn(
              "flex items-center gap-3 p-3.5 rounded-xl border w-full text-left transition-all active:scale-[0.99]",
              val
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-300"
                : "bg-background border-input hover:bg-muted/50",
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                val
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-muted-foreground",
              )}
            >
              {val && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
            <span className="text-sm font-medium">
              {val ? "Yes / Confirmed" : "No / Not Checked"}
            </span>
          </button>
        );

      case "checkbox-group": {
        const currentSelected: string[] = Array.isArray(val) ? val : [];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {field.options?.map((opt) => {
              const isChecked = currentSelected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = isChecked
                      ? currentSelected.filter((v) => v !== opt.value)
                      : [...currentSelected, opt.value];
                    handleFieldChange(field.id, next);
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-left text-sm font-medium transition-all active:scale-[0.99]",
                    isChecked
                      ? "bg-primary/10 border-primary text-foreground shadow-xs"
                      : "bg-background hover:bg-muted/60 border-input",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground",
                    )}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        );
      }

      case "signature":
        return (
          <div
            className={cn(
              hasError &&
                "p-1 rounded-xl border border-destructive ring-1 ring-destructive/20",
            )}
          >
            <SignaturePad
              value={val}
              onChange={(sig) => handleFieldChange(field.id, sig)}
            />
          </div>
        );

      default:
        return (
          <Input
            value={val ?? ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="h-11 text-base"
          />
        );
    }
  };

  const activeSection = useMemo(() => {
    return (
      template.sections.find((s) => s.id === activeSectionId) ||
      template.sections[0]
    );
  }, [template.sections, activeSectionId]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Top Tablet Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full shrink-0"
              title="Close"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold truncate tracking-tight">
                  {template.title}
                </h1>
                {initialSubmission && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border shrink-0">
                    Editing
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {template.folderPath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lastExportedPdfPath && onViewPdf && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewPdf(lastExportedPdfPath)}
                className="text-xs gap-1.5 font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              >
                <FileText className="w-3.5 h-3.5 text-red-500" />
                <span>View PDF</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSaving}
              className="px-3"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave("completed")}
              disabled={isSaving}
              className="font-semibold shadow-xs px-4 min-w-[80px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : justSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>Save</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Section Jump Bar (if multiple sections) */}
        {template.sections.length > 1 && (
          <div className="max-w-4xl mx-auto flex items-center gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {template.sections.map((section, idx) => {
              const isActive = section.id === activeSection.id;
              const sectionHasError = section.fields.some((f) =>
                validationErrors.includes(f.id),
              );

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                    sectionHasError &&
                      !isActive &&
                      "border border-destructive/40 text-destructive",
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span>{section.title}</span>
                  {sectionHasError && (
                    <AlertCircle className="w-3 h-3 text-destructive" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Form Fields Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-28">
        {validationErrors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3.5 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Required Fields Incomplete</p>
              <p className="text-xs mt-0.5">
                Please fill in all fields marked with an asterisk before
                finalizing your submission.
              </p>
            </div>
          </div>
        )}

        {/* Active Section Card */}
        <div className="bg-card border rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {activeSection.title}
            </h2>
            {activeSection.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {activeSection.description}
              </p>
            )}
          </div>

          <div className="space-y-6">
            {activeSection.fields.map((field) => {
              const hasError = validationErrors.includes(field.id);
              return (
                <div key={field.id} className="space-y-1.5">
                  {field.type !== "heading" && field.type !== "notes" && (
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={field.id}
                        className={cn(
                          "text-sm font-semibold",
                          hasError && "text-destructive",
                        )}
                      >
                        {field.label}
                        {field.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      {hasError && (
                        <span className="text-xs text-destructive font-medium">
                          Required
                        </span>
                      )}
                    </div>
                  )}

                  {renderFieldInput(field)}

                  {field.helperText && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {field.helperText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Navigation Buttons */}
        {template.sections.length > 1 ? (
          <div className="flex items-center justify-between pt-2">
            {template.sections.findIndex((s) => s.id === activeSection.id) >
            0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  const currIdx = template.sections.findIndex(
                    (s) => s.id === activeSection.id,
                  );
                  setActiveSectionId(template.sections[currIdx - 1].id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Previous Section
              </Button>
            ) : (
              <div />
            )}

            {template.sections.findIndex((s) => s.id === activeSection.id) <
            template.sections.length - 1 ? (
              <Button
                onClick={() => {
                  const currIdx = template.sections.findIndex(
                    (s) => s.id === activeSection.id,
                  );
                  setActiveSectionId(template.sections[currIdx + 1].id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Next Section
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {lastExportedPdfPath && onViewPdf && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onViewPdf(lastExportedPdfPath)}
                    className="gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                    <span>View PDF</span>
                  </Button>
                )}
                <Button
                  onClick={() => handleSave("completed")}
                  disabled={isSaving}
                  className="font-semibold shadow-xs min-w-[100px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : justSaved ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      <span>Save</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pt-2">
            {lastExportedPdfPath && onViewPdf && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onViewPdf(lastExportedPdfPath)}
                className="gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              >
                <FileText className="w-4 h-4 text-red-500" />
                <span>View PDF</span>
              </Button>
            )}
            <Button
              onClick={() => handleSave("completed")}
              disabled={isSaving}
              className="font-semibold shadow-xs min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : justSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>Save Form</span>
                </>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
