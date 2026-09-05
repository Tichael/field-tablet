import { useState, useEffect, useCallback, useMemo } from "react";
import type { FormTemplate, FormSubmission } from "../../types/form";
import { formService } from "../../lib/forms/form-service";
import { getFormFoldersList, useConfigStore } from "../../store/config-store";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import {
  Folder,
  ChevronLeft,
  FileText,
  Plus,
  Clock,
  ExternalLink,
  Edit3,
  Loader2,
  Calendar,
  Camera,
  Video,
} from "lucide-react";
import { formatDateTime } from "../../lib/forms/pdf-generator";
import { formatBytes } from "../../lib/forms/media-utils";
import { cn } from "@/lib/utils";

interface FormsBrowserProps {
  onClose: () => void;
  onSelectForm: (template: FormTemplate, submission?: FormSubmission) => void;
  onViewPdf: (filePath: string) => void;
  initialFolder?: string;
  initialForm?: FormTemplate;
}

export function FormsBrowser({
  onClose,
  onSelectForm,
  onViewPdf,
  initialFolder,
  initialForm,
}: FormsBrowserProps) {
  const { t, i18n } = useTranslation();
  const formFoldersConfig = useConfigStore(
    (state) => state.config?.formFolders,
  );
  const formFolders = useMemo(
    () =>
      getFormFoldersList(
        formFoldersConfig ? ({ formFolders: formFoldersConfig } as any) : null,
      ),
    [formFoldersConfig],
  );
  const [selectedFolder, setSelectedFolder] = useState<string>(
    initialFolder || "",
  );
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected form for submissions history
  const [selectedFormForHistory, setSelectedFormForHistory] =
    useState<FormTemplate | null>(initialForm || null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Load forms in selected folder
  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const foldersToScan = selectedFolder ? [selectedFolder] : formFolders;
      const discovered = await formService.discoverForms(foldersToScan);
      setForms(discovered);
    } catch (e) {
      console.error("Failed to discover forms:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, formFolders]);

  useEffect(() => {
    if (!selectedFormForHistory) {
      loadForms();
    }
  }, [selectedFormForHistory, loadForms]);

  // Load submissions when viewing history of a form
  const loadSubmissions = useCallback(async (form: FormTemplate) => {
    setLoadingSubmissions(true);
    try {
      const subs = await formService.listSubmissions(
        form.folderPath,
        form.legacyFolderPaths,
      );
      setSubmissions(subs);
    } catch (e) {
      console.error("Failed to load submissions:", e);
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  useEffect(() => {
    if (initialForm) {
      setSelectedFormForHistory(initialForm);
      loadSubmissions(initialForm);
    }
  }, [initialForm, loadSubmissions]);

  const handleOpenHistory = (form: FormTemplate) => {
    setSelectedFormForHistory(form);
    loadSubmissions(form);
  };

  // 1. If viewing submissions history for a form
  if (selectedFormForHistory) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b bg-muted/10 shadow-xs shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (initialForm) {
                  onClose();
                } else {
                  setSelectedFormForHistory(null);
                }
              }}
              className="rounded-full shrink-0"
              title={t("common.back")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">
                {selectedFormForHistory.title} —{" "}
                {t("forms.browser.submissionsAndPdfs")}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {selectedFormForHistory.folderPath}/
                {t("forms.browser.filledForms")}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => onSelectForm(selectedFormForHistory)}
            className="gap-1.5 font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t("forms.browser.newSubmission")}</span>
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-4">
          {loadingSubmissions ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-sm">{t("forms.browser.loadingSubmissions")}</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="border border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 bg-card">
              <FileText className="w-12 h-12 text-muted-foreground/30" />
              <div className="space-y-1">
                <h3 className="font-semibold text-base">
                  {t("forms.browser.noSubmissionsYet")}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {t("forms.browser.noSubmissionsDesc")}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onSelectForm(selectedFormForHistory)}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-1.5" />{" "}
                {t("forms.browser.startFirstSubmission")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => {
                const updatedDate = new Date(sub.updatedAt || sub.createdAt);
                const { displayDate, displayTime } = formatDateTime(
                  updatedDate,
                  i18n.language,
                );

                return (
                  <div
                    key={sub.id}
                    className="bg-card border rounded-xl p-4 sm:p-5 shadow-xs space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm sm:text-base">
                            {sub.id}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold",
                              sub.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 border border-amber-500/20",
                            )}
                          >
                            {sub.status === "completed"
                              ? t("forms.browser.completed")
                              : t("forms.browser.draft")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {displayDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {displayTime}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onSelectForm(selectedFormForHistory, sub)
                        }
                        className="gap-1 text-xs self-start sm:self-center"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t("forms.browser.editSubmission")}</span>
                      </Button>
                    </div>

                    {/* PDF Exports list for this submission */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("forms.browser.datedPdfCopies", {
                          count: sub.pdfExports?.length || 0,
                        })}
                      </span>

                      {!sub.pdfExports || sub.pdfExports.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          {t("forms.browser.noPdfGenerated")}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sub.pdfExports.map((pdf) => (
                            <button
                              key={pdf.path}
                              onClick={() => onViewPdf(pdf.path)}
                              className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/50 hover:border-foreground/30 transition-all text-left text-foreground"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                <span className="text-xs font-mono truncate font-medium text-foreground">
                                  {pdf.filename}
                                </span>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Media Attachments list for this submission */}
                    {sub.attachments && sub.attachments.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("forms.browser.mediaAttachmentsCount", {
                            count: sub.attachments.length,
                          })}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sub.attachments.map((att) => (
                            <button
                              key={att.id || att.path}
                              onClick={() => onViewPdf(att.path)}
                              className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/50 hover:border-foreground/30 transition-all text-left text-foreground group"
                              title={t("forms.browser.openFileTitle", {
                                name: att.name || att.filename,
                              })}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                {att.type === "photo" ? (
                                  <Camera className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <Video className="w-4 h-4 text-blue-500 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate text-foreground">
                                    {att.name || att.filename}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    {formatBytes(att.size)}
                                  </p>
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // 2. Main forms browser view
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-muted/10 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
            title={t("forms.browser.backToDashboard")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {t("forms.browser.formTemplates")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedFolder
                ? t("forms.browser.browsingFolder", { folder: selectedFolder })
                : t("forms.browser.selectFormSubtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {formFolders.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Button
                variant={selectedFolder === "" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setSelectedFolder("")}
                className="text-xs"
              >
                {t("forms.browser.allFolders")}
              </Button>
              {formFolders.map((f) => (
                <Button
                  key={f}
                  variant={selectedFolder === f ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setSelectedFolder(f)}
                  className="text-xs"
                >
                  /{f}
                </Button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">{t("forms.browser.scanningFolders")}</p>
          </div>
        ) : forms.length === 0 ? (
          <div className="border border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 bg-card">
            <Folder className="w-14 h-14 text-amber-500/40" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">
                {t("forms.browser.noFormsFound")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {formFolders.length === 0
                  ? t("forms.browser.noFoldersConfigured")
                  : selectedFolder
                    ? t("forms.browser.noFormsInThisFolder", {
                        folder: selectedFolder,
                      })
                    : t("forms.browser.noFormsInConfiguredFolders")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {forms.map((form) => (
              <div
                key={form.folderPath}
                className="bg-card border rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                      /{form.folderPath}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      v{form.version || 1}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground">
                      {form.title}
                    </h3>
                    {form.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {form.description}
                      </p>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {t("forms.browser.sectionsCount", {
                      count: form.sections.length,
                    })}{" "}
                    •{" "}
                    {t("forms.browser.fieldsCount", {
                      count: form.sections.reduce(
                        (acc, s) => acc + s.fields.length,
                        0,
                      ),
                    })}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t flex items-center gap-1.5">
                  <Button
                    onClick={() => onSelectForm(form)}
                    className="flex-1 text-xs font-semibold gap-1.5 shadow-xs"
                    size="sm"
                  >
                    <Plus className="w-3.5 h-3.5" />{" "}
                    {t("forms.browser.fillForm")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOpenHistory(form)}
                    size="sm"
                    className="text-xs gap-1"
                    title={t("forms.browser.submissionsAndPdfs")}
                  >
                    <FileText className="w-3.5 h-3.5" />{" "}
                    {t("forms.runner.history")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
