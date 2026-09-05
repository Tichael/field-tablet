import { useState, useMemo, useEffect, useRef } from "react";
import type {
  FormTemplate,
  FormSubmission,
  FormField,
  PdfExportRecord,
} from "../../types/form";
import { useConfigStore } from "../../store/config-store";
import { formService } from "../../lib/forms/form-service";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SignaturePad } from "./SignaturePad";
import { MediaAttachmentField } from "./MediaAttachmentField";
import {
  ChevronLeft,
  AlertCircle,
  Loader2,
  Save,
  CheckCircle2,
  FileText,
  Check,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FormRunnerProps {
  template: FormTemplate;
  initialSubmission?: FormSubmission;
  onClose: () => void;
  onViewPdf?: (filePath: string) => void;
  onOpenHistory?: () => void;
  isPreview?: boolean;
}

export function FormRunner({
  template,
  initialSubmission,
  onClose,
  onViewPdf,
  onOpenHistory,
  isPreview = false,
}: FormRunnerProps) {
  const { t } = useTranslation();
  const config = useConfigStore((state) => state.config);

  // Initialize form state
  const [values, setValues] = useState<Record<string, any>>(() => {
    if (initialSubmission) {
      return { ...initialSubmission.values };
    }
    const defaults: Record<string, any> = {};
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    const nowDateTimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;

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

  const [instanceFolderPath, setInstanceFolderPath] = useState<
    string | undefined
  >(initialSubmission?.instanceFolderPath);

  const [currentPdfExports, setCurrentPdfExports] = useState<PdfExportRecord[]>(
    initialSubmission?.pdfExports || [],
  );

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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Prevent accidental data loss on browser refresh / navigation when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

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

  // Validate required fields and constraints
  const validateForm = (): { valid: boolean; missing: string[] } => {
    const missing: string[] = [];
    for (const section of template.sections) {
      for (const field of section.fields) {
        const val = values[field.id];
        if (field.required) {
          if (field.type === "checkbox") {
            if (val !== true && val !== "true") {
              missing.push(field.id);
            }
          } else if (field.type === "checkbox-group") {
            if (!Array.isArray(val) || val.length === 0) {
              missing.push(field.id);
            }
          } else if (field.type === "photo" || field.type === "video") {
            if (
              val === undefined ||
              val === null ||
              val === "" ||
              (Array.isArray(val) && val.length === 0)
            ) {
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

        // Numeric min/max range validation
        if (
          field.type === "number" &&
          val !== undefined &&
          val !== null &&
          val !== ""
        ) {
          const num = Number(val);
          if (
            Number.isNaN(num) ||
            (field.validation?.min !== undefined &&
              num < field.validation.min) ||
            (field.validation?.max !== undefined && num > field.validation.max)
          ) {
            if (!missing.includes(field.id)) {
              missing.push(field.id);
            }
          }
        }

        // Custom regex pattern validation
        if (
          field.validation?.pattern &&
          val !== undefined &&
          val !== null &&
          val !== ""
        ) {
          try {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(String(val))) {
              if (!missing.includes(field.id)) {
                missing.push(field.id);
              }
            }
          } catch {
            // ignore invalid regex pattern in template definition
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

    if (isPreview) {
      setIsDirty(false);
      setJustSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setJustSaved(false);
      }, 2500);
      return;
    }

    if (!config) {
      alert(t("forms.runner.configNotLoaded"));
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
        instanceFolderPath:
          instanceFolderPath || initialSubmission?.instanceFolderPath,
        createdAt: initialSubmission?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status,
        values,
        pdfExports: currentPdfExports,
      };

      const result = await formService.saveSubmissionAndExportPdf(
        template,
        submissionToSave,
        config,
      );

      setInstanceFolderPath(result.submission.instanceFolderPath);
      setValues(result.submission.values);
      setCurrentPdfExports(result.submission.pdfExports || []);
      setLastExportedPdfPath(result.pdfPath);
      setIsDirty(false);
      setJustSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setJustSaved(false);
      }, 3500);
    } catch (e) {
      console.error("Failed to save form submission:", e);
      alert(t("forms.runner.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      const confirmed = window.confirm(t("forms.runner.unsavedCloseConfirm"));
      if (!confirmed) return;
    }
    onClose();
  };

  const handleOpenHistory = () => {
    if (isDirty) {
      const confirmed = window.confirm(t("forms.runner.unsavedHistoryConfirm"));
      if (!confirmed) return;
    }
    onOpenHistory?.();
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
            id={field.id}
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
            id={field.id}
            type="number"
            inputMode="numeric"
            min={field.validation?.min}
            max={field.validation?.max}
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
            id={field.id}
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
            id={field.id}
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
            id={field.id}
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
            id={field.id}
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
              id={field.id}
              className={cn(
                "h-11 text-base w-full",
                hasError && "border-destructive ring-destructive/20",
              )}
            >
              <SelectValue
                placeholder={
                  field.placeholder || t("forms.runner.selectOption")
                }
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
          <div
            id={field.id}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1"
          >
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
            id={field.id}
            onClick={() => handleFieldChange(field.id, !val)}
            className={cn(
              "flex items-center gap-3 p-3.5 rounded-xl border w-full text-left transition-all active:scale-[0.99]",
              val
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-300"
                : "bg-background border-input hover:bg-muted/50",
              hasError && "border-destructive ring-1 ring-destructive/20",
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
              {val
                ? t("forms.runner.yesConfirmed")
                : t("forms.runner.noNotChecked")}
            </span>
          </button>
        );

      case "checkbox-group": {
        const currentSelected: string[] = Array.isArray(val) ? val : [];
        return (
          <div
            id={field.id}
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1",
              hasError &&
                "p-1.5 rounded-xl border border-destructive ring-1 ring-destructive/20",
            )}
          >
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
            id={field.id}
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

      case "photo":
      case "video":
        return (
          <div
            id={field.id}
            className={cn(
              hasError &&
                "p-1 rounded-xl border border-destructive ring-1 ring-destructive/20",
            )}
          >
            <MediaAttachmentField
              field={field}
              value={val}
              onChange={(newVal) => handleFieldChange(field.id, newVal)}
              hasError={hasError}
              disabled={isSaving}
            />
          </div>
        );

      default:
        return (
          <Input
            id={field.id}
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

  if (!activeSection) {
    return (
      <div
        className={cn(
          "flex flex-col bg-background text-foreground",
          isPreview ? "h-full" : "h-screen",
        )}
      >
        <header className="flex items-center justify-between p-4 border-b bg-muted/10 shadow-xs">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">{template.title || "Form"}</h1>
          <div className="w-9" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-semibold text-base">
            {t("forms.runner.noSectionsTitle")}
          </p>
          <p className="text-xs mt-1">{t("forms.runner.noSectionsDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        isPreview ? "h-full min-h-0" : "min-h-screen",
      )}
    >
      {/* Top Tablet Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full shrink-0"
              title={t("common.close")}
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
                    {t("forms.runner.editing")}
                  </span>
                )}
                {isPreview && (
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                    {t("forms.runner.preview")}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {template.folderPath ||
                  (isPreview ? t("forms.runner.previewingTemplate") : "")}
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
                <span>{t("forms.runner.viewPdf")}</span>
              </Button>
            )}
            {!isPreview && onOpenHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenHistory}
                className="text-xs gap-1.5 font-medium"
                title={t("forms.runner.viewSubmissionHistory")}
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {t("forms.runner.previouslyFilled")}
                </span>
                <span className="sm:hidden">{t("forms.runner.history")}</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSaving}
              className="px-3"
            >
              {t("common.close")}
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
                  <span>{t("forms.runner.saving")}</span>
                </>
              ) : justSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                  <span>{t("forms.runner.saved")}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>{t("common.save")}</span>
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
              <p className="font-semibold">
                {t("forms.runner.requiredFieldsIncomplete")}
              </p>
              <p className="text-xs mt-0.5">
                {t("forms.runner.requiredFieldsDesc")}
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
                          {field.type === "number" &&
                          field.validation &&
                          values[field.id] !== undefined &&
                          values[field.id] !== null &&
                          values[field.id] !== ""
                            ? t("forms.runner.invalidRange")
                            : t("common.required")}
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
                {t("forms.runner.previousSection")}
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
                {t("forms.runner.nextSection")}
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
                    <span>{t("forms.runner.viewPdf")}</span>
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
                      <span>{t("forms.runner.saving")}</span>
                    </>
                  ) : justSaved ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                      <span>{t("forms.runner.saved")}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      <span>{t("common.save")}</span>
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
                <span>{t("forms.runner.viewPdf")}</span>
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
                  <span>{t("forms.runner.saving")}</span>
                </>
              ) : justSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                  <span>{t("forms.runner.saved")}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>{t("forms.runner.saveForm")}</span>
                </>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
