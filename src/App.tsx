import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { syncManager } from "./lib/sync/sync-manager";
import { useAppStore } from "./store/app-store";
import {
  DEFAULT_CONFIG,
  useConfigStore,
  getFormFoldersList,
} from "./store/config-store";
import { SetupScreen } from "./components/setup/SetupScreen";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { Button } from "./components/ui/button";

import { Folder, ChevronRight, FileText } from "lucide-react";
import { applyTheme } from "./lib/theme";
import { DocumentList } from "./components/documents/DocumentList";
import { DocumentViewer } from "./components/documents/DocumentViewer";
import { SyncIndicator } from "./components/ui/SyncIndicator";
import { FormRunner } from "./components/forms/FormRunner";
import { FormsBrowser } from "./components/forms/FormsBrowser";
import type { FormTemplate, FormSubmission } from "./types/form";
import { formService } from "./lib/forms/form-service";

const MAX_DASHBOARD_FORMS = 6;

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
  const [dashboardForms, setDashboardForms] = useState<FormTemplate[]>([]);
  const [activeFormTemplate, setActiveFormTemplate] =
    useState<FormTemplate | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<
    FormSubmission | undefined
  >(undefined);
  const [returnToFormOnHistoryClose, setReturnToFormOnHistoryClose] =
    useState<FormTemplate | null>(null);
  const [isFormsBrowserOpen, setFormsBrowserOpen] = useState(false);
  const [formsBrowserFolder, setFormsBrowserFolder] = useState<
    string | undefined
  >(undefined);
  const [formsBrowserInitialForm, setFormsBrowserInitialForm] = useState<
    FormTemplate | undefined
  >(undefined);
  const [viewingPdfPath, setViewingPdfPath] = useState<string | null>(null);

  const loadDashboardForms = useCallback(async () => {
    if (!config) return;
    const folders = getFormFoldersList(config);
    if (folders.length === 0) {
      setDashboardForms([]);
      return;
    }
    try {
      const discovered = await formService.discoverForms(folders);
      setDashboardForms(discovered);
    } catch (e) {
      console.error("Failed to load dashboard forms:", e);
    }
  }, [config]);

  const hasTooManyForms = dashboardForms.length > MAX_DASHBOARD_FORMS;
  const visibleForms = hasTooManyForms
    ? dashboardForms.slice(0, MAX_DASHBOARD_FORMS - 1)
    : dashboardForms;
  const remainingFormsCount = dashboardForms.length - visibleForms.length;

  useEffect(() => {
    if (isConfigured && !isSettingsOpen) {
      loadDashboardForms();
    }
  }, [isConfigured, isSettingsOpen, loadDashboardForms]);

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
        key={`${activeFormTemplate.folderPath || activeFormTemplate.id}_${activeSubmission?.id || "new"}`}
        template={activeFormTemplate}
        initialSubmission={activeSubmission}
        onClose={() => {
          setActiveFormTemplate(null);
          setActiveSubmission(undefined);
          setReturnToFormOnHistoryClose(null);
          loadDashboardForms();
        }}
        onViewPdf={(path) => setViewingPdfPath(path)}
        onOpenHistory={() => {
          const currentForm = activeFormTemplate;
          setReturnToFormOnHistoryClose(currentForm);
          setActiveFormTemplate(null);
          setActiveSubmission(undefined);
          setFormsBrowserInitialForm(currentForm);
          setFormsBrowserFolder(currentForm.folderPath);
          setFormsBrowserOpen(true);
        }}
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
          setFormsBrowserFolder(undefined);
          setFormsBrowserInitialForm(undefined);
          if (returnToFormOnHistoryClose) {
            setActiveFormTemplate(returnToFormOnHistoryClose);
            setReturnToFormOnHistoryClose(null);
          } else {
            loadDashboardForms();
          }
        }}
        onSelectForm={(tmpl, sub) => {
          setFormsBrowserOpen(false);
          setFormsBrowserInitialForm(undefined);
          setReturnToFormOnHistoryClose(null);
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
      <header className="bg-primary text-primary-foreground dark:bg-card dark:text-card-foreground border-b sticky top-0 z-10">
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
                className={
                  isSettingsOpen
                    ? ""
                    : "text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10 dark:text-foreground dark:border-border dark:hover:bg-accent"
                }
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
            {/* Forms dashboard grid if templates exist */}
            {dashboardForms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleForms.map((form) => (
                  <div
                    key={form.folderPath || form.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveFormTemplate(form);
                      setActiveSubmission(undefined);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveFormTemplate(form);
                        setActiveSubmission(undefined);
                      }
                    }}
                    className="group text-left border rounded-xl p-5 flex flex-col justify-between bg-card shadow-xs hover:border-primary/50 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer select-none"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center">
                        <span className="inline-flex items-center leading-none text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {form.category || "Form"}
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                        {form.title}
                      </h3>

                      {form.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {form.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}

                {hasTooManyForms && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setFormsBrowserFolder(undefined);
                      setFormsBrowserOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setFormsBrowserFolder(undefined);
                        setFormsBrowserOpen(true);
                      }
                    }}
                    className="group text-left border border-dashed rounded-xl p-5 flex flex-col justify-between bg-card/60 hover:bg-muted/30 hover:border-primary/50 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer select-none"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center leading-none text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-secondary text-secondary-foreground border border-border/40">
                          All Forms
                        </span>
                        <span className="leading-none text-[10px] font-mono font-semibold text-muted-foreground">
                          +{remainingFormsCount} More
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        <span>More Forms & History</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-all shrink-0" />
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        Browse all {dashboardForms.length} forms and past
                        submissions
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center bg-card/50 shadow-xs space-y-3">
                <FileText className="w-10 h-10 text-muted-foreground/50" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-foreground">
                    No Forms Configured
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Configure form folders or create new forms using the visual
                    form editor in Settings.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                  className="mt-2"
                >
                  Configure Forms in Settings
                </Button>
              </div>
            )}

            {/* Bottom row: Large document button */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setDocumentBrowserOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDocumentBrowserOpen(true);
                }
              }}
              className="group border rounded-xl p-10 flex flex-col items-center justify-center bg-card shadow-xs hover:border-primary/50 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer select-none w-full"
            >
              <Folder className="w-16 h-16 text-blue-500 mb-4 group-hover:scale-105 transition-transform" />
              <h2 className="text-2xl font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                Documents
              </h2>
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
