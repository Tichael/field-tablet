import { useEffect, useState } from "react";
import "./App.css";
import { syncManager } from "./lib/sync/sync-manager";
import { useAppStore } from "./store/app-store";
import { DEFAULT_CONFIG, useConfigStore } from "./store/config-store";
import { SetupScreen } from "./components/setup/SetupScreen";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { Button } from "./components/ui/button";

import {
  Folder,
  FileText,
  ClipboardList,
  Plus,
  FolderPlus,
} from "lucide-react";
import { applyTheme } from "./lib/theme";
import { DocumentList } from "./components/documents/DocumentList";
import { DocumentViewer } from "./components/documents/DocumentViewer";
import { SyncIndicator } from "./components/ui/SyncIndicator";
import { FormRunner } from "./components/forms/FormRunner";
import { FormsBrowser } from "./components/forms/FormsBrowser";
import type { FormTemplate, FormSubmission } from "./types/form";
import { formService } from "./lib/forms/form-service";
import { cn } from "@/lib/utils";

function App() {
  const isConfigured = useAppStore((state) => state.isConfigured);
  const isEditingConfig = useAppStore((state) => state.isEditingConfig);
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const needsPermission = useAppStore((state) => state.needsPermission);
  const { config, loadConfig } = useConfigStore();
  const [isInitializing, setIsInitializing] = useState(true);

  const [isDocumentBrowserOpen, setDocumentBrowserOpen] = useState(false);

  // Forms state
  const [activeFormTemplate, setActiveFormTemplate] =
    useState<FormTemplate | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<
    FormSubmission | undefined
  >(undefined);
  const [isFormsBrowserOpen, setFormsBrowserOpen] = useState(false);
  const [formsBrowserFolder, setFormsBrowserFolder] = useState<
    string | undefined
  >(undefined);
  const [formsBrowserInitialForm, setFormsBrowserInitialForm] = useState<
    FormTemplate | undefined
  >(undefined);
  const [viewingPdfPath, setViewingPdfPath] = useState<string | null>(null);

  const handleOpenFormRunner = async (
    formType: "dailyReports" | "incidentLogs" | "equipmentChecks",
    folder: string,
  ) => {
    try {
      const template = await formService.getOrCreateTemplate(formType, folder);
      setActiveFormTemplate(template);
      setActiveSubmission(undefined);
    } catch (e) {
      console.error("Failed to load form template:", e);
      alert("Failed to load form template.");
    }
  };

  const handleOpenFormHistory = async (
    formType: "dailyReports" | "incidentLogs" | "equipmentChecks",
    folder: string,
  ) => {
    try {
      const template = await formService.getOrCreateTemplate(formType, folder);
      setFormsBrowserInitialForm(template);
      setFormsBrowserFolder(folder);
      setFormsBrowserOpen(true);
    } catch (e) {
      console.error("Failed to open form history:", e);
    }
  };

  useEffect(() => {
    if (!isConfigured) {
      setSettingsOpen(false);
    }
  }, [isConfigured, setSettingsOpen]);

  useEffect(() => {
    const init = async () => {
      if (isConfigured) {
        await loadConfig();
      }
      await syncManager.initialize();
      if (isConfigured) {
        if (localStorage.getItem("openEditor") === "true") {
          localStorage.removeItem("openEditor");
          setSettingsOpen(true);
        }
      }
      setIsInitializing(false);
    };
    init();

    return () => {
      syncManager.stopPeriodicSync();
    };
  }, [isConfigured, loadConfig, setSettingsOpen]);

  useEffect(() => {
    if (!config) {
      // By omitting primaryColor, we let index.css take over the default theme colors
      return applyTheme(DEFAULT_CONFIG.theme);
    }
    return applyTheme(config.theme);
  }, [config]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isConfigured || !config) {
    return <SetupScreen />;
  }

  if (needsPermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow border p-8 space-y-4 text-center">
          <Folder className="w-16 h-16 text-blue-500 mx-auto opacity-50" />
          <h2 className="text-xl font-semibold">Restore Folder Access</h2>
          <p className="text-muted-foreground text-sm">
            For security reasons, your browser requires you to confirm access to
            your local folder after a refresh.
          </p>
          <div className="space-y-2 mt-4">
            <Button
              className="w-full"
              onClick={async () => {
                const success = await syncManager
                  .getAdapter()
                  .requestPermission(false);
                if (success) {
                  useAppStore.getState().setNeedsPermission(false);
                  syncManager.sync().catch(console.error);
                  syncManager.startPeriodicSync();
                  loadConfig();
                }
              }}
            >
              Grant Permission
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-destructive"
              onClick={async () => {
                const confirmed = window.confirm(
                  "Reset folder configuration? You will need to select a folder again.",
                );
                if (confirmed) {
                  const { del } = await import("idb-keyval");
                  await del("app_config_directory_handle");
                  useAppStore.getState().setNeedsPermission(false);
                  useAppStore.getState().setConfigured(false);
                }
              }}
            >
              Reset Folder Selection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewingPdfPath) {
    return (
      <DocumentViewer
        filePath={viewingPdfPath}
        onClose={() => setViewingPdfPath(null)}
      />
    );
  }

  if (activeFormTemplate) {
    return (
      <FormRunner
        template={activeFormTemplate}
        initialSubmission={activeSubmission}
        onClose={() => {
          setActiveFormTemplate(null);
          setActiveSubmission(undefined);
        }}
        onViewPdf={(path) => setViewingPdfPath(path)}
      />
    );
  }

  if (isFormsBrowserOpen) {
    return (
      <FormsBrowser
        initialFolder={formsBrowserFolder}
        initialForm={formsBrowserInitialForm}
        onClose={() => {
          setFormsBrowserOpen(false);
          setFormsBrowserInitialForm(undefined);
        }}
        onSelectForm={(tmpl, sub) => {
          setFormsBrowserOpen(false);
          setFormsBrowserInitialForm(undefined);
          setActiveFormTemplate(tmpl);
          setActiveSubmission(sub);
        }}
        onViewPdf={(path) => setViewingPdfPath(path)}
      />
    );
  }

  if (isDocumentBrowserOpen) {
    return (
      <DocumentList basePath="" onClose={() => setDocumentBrowserOpen(false)} />
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-primary text-primary-foreground border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {config.branding.logoBase64 && (
              <img
                src={config.branding.logoBase64}
                alt="App Logo"
                className="h-8 object-contain"
              />
            )}
            <h1 className="text-xl font-semibold tracking-tight">
              {config.branding.appTitle || "Field Tablet App"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            {!isEditingConfig && (
              <Button
                onClick={() => setSettingsOpen(!isSettingsOpen)}
                variant={isSettingsOpen ? "secondary" : "outline"}
              >
                {isSettingsOpen ? "Back to App" : "Settings"}
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        {isSettingsOpen ? (
          <SettingsScreen />
        ) : (
          <div className="px-4 py-6 sm:px-0 max-w-4xl mx-auto space-y-6">
            {/* Forms Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-amber-500" />
                  <h2 className="text-xl font-bold tracking-tight">
                    Field Forms
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormsBrowserFolder(undefined);
                      setFormsBrowserOpen(true);
                    }}
                    className="text-xs gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Browse All & History</span>
                  </Button>
                </div>
              </div>

              {/* Three Form Type Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Daily Report Card */}
                <div
                  className={cn(
                    "border rounded-xl p-5 flex flex-col justify-between bg-card shadow-xs transition-all",
                    config.formFolders?.dailyReports
                      ? "hover:border-foreground/40 hover:bg-muted/20"
                      : "border-dashed opacity-85",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                        Report
                      </span>
                      {config.formFolders?.dailyReports ? (
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                          /{config.formFolders.dailyReports}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          Folder required
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-foreground">
                      Daily Report
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Shift progress, crew personnel, work activities, and
                      supervisor signature.
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t">
                    {config.formFolders?.dailyReports ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs gap-1 font-semibold"
                          onClick={() =>
                            handleOpenFormRunner(
                              "dailyReports",
                              config.formFolders!.dailyReports!,
                            )
                          }
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Fill Form</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() =>
                            handleOpenFormHistory(
                              "dailyReports",
                              config.formFolders!.dailyReports!,
                            )
                          }
                          title="View Previous Submissions & PDFs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs gap-1.5"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Configure Folder</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* 2. Incident Log Card */}
                <div
                  className={cn(
                    "border rounded-xl p-5 flex flex-col justify-between bg-card shadow-xs transition-all",
                    config.formFolders?.incidentLogs
                      ? "hover:border-foreground/40 hover:bg-muted/20"
                      : "border-dashed opacity-85",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        Safety
                      </span>
                      {config.formFolders?.incidentLogs ? (
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                          /{config.formFolders.incidentLogs}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          Folder required
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-foreground">
                      Incident Log
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Immediate documentation of safety, equipment, near-miss,
                      or environmental incidents.
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t">
                    {config.formFolders?.incidentLogs ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs gap-1 font-semibold"
                          onClick={() =>
                            handleOpenFormRunner(
                              "incidentLogs",
                              config.formFolders!.incidentLogs!,
                            )
                          }
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Fill Form</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() =>
                            handleOpenFormHistory(
                              "incidentLogs",
                              config.formFolders!.incidentLogs!,
                            )
                          }
                          title="View Previous Submissions & PDFs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs gap-1.5"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Configure Folder</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* 3. Equipment Check Card */}
                <div
                  className={cn(
                    "border rounded-xl p-5 flex flex-col justify-between bg-card shadow-xs transition-all",
                    config.formFolders?.equipmentChecks
                      ? "hover:border-foreground/40 hover:bg-muted/20"
                      : "border-dashed opacity-85",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Inspection
                      </span>
                      {config.formFolders?.equipmentChecks ? (
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                          /{config.formFolders.equipmentChecks}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          Folder required
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-foreground">
                      Equipment Check
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Pre-operational machinery checklist, fluid levels,
                      mechanical checks, and certification.
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t">
                    {config.formFolders?.equipmentChecks ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs gap-1 font-semibold"
                          onClick={() =>
                            handleOpenFormRunner(
                              "equipmentChecks",
                              config.formFolders!.equipmentChecks!,
                            )
                          }
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Fill Form</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() =>
                            handleOpenFormHistory(
                              "equipmentChecks",
                              config.formFolders!.equipmentChecks!,
                            )
                          }
                          title="View Previous Submissions & PDFs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs gap-1.5"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Configure Folder</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom row: Large document button */}
            <div
              className="border border-muted-foreground/25 rounded-xl p-10 flex flex-col items-center justify-center bg-card shadow-xs hover:shadow-md transition-shadow cursor-pointer w-full"
              onClick={() => setDocumentBrowserOpen(true)}
            >
              <Folder className="w-16 h-16 text-blue-500 mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Documents</h2>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Browse and view offline documents, manuals, circuit diagrams,
                and building plans.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
