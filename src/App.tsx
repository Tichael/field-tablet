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

import {
  Folder,
  FileText,
  ClipboardList,
  Plus,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { applyTheme } from "./lib/theme";
import { DocumentList } from "./components/documents/DocumentList";
import { DocumentViewer } from "./components/documents/DocumentViewer";
import { SyncIndicator } from "./components/ui/SyncIndicator";
import { FormRunner } from "./components/forms/FormRunner";
import { FormsBrowser } from "./components/forms/FormsBrowser";
import { FormEditor } from "./components/forms/editor/FormEditor";
import type { FormTemplate, FormSubmission } from "./types/form";
import { formService } from "./lib/forms/form-service";

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
  const [isLoadingForms, setIsLoadingForms] = useState(false);
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

  // Form Editor state
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<FormTemplate | null>(
    null,
  );

  const handleOpenCreateForm = () => {
    setTemplateToEdit(null);
    setIsEditingTemplate(true);
    setFormsBrowserOpen(false);
  };

  const handleOpenEditTemplate = (tmpl: FormTemplate) => {
    setTemplateToEdit(tmpl);
    setIsEditingTemplate(true);
    setFormsBrowserOpen(false);
  };

  const handleOpenCloneTemplate = (tmpl: FormTemplate) => {
    const randomSuffix = Math.random().toString(36).slice(2, 6);
    const cloned: FormTemplate = {
      ...JSON.parse(JSON.stringify(tmpl)),
      id: `${tmpl.id}_copy_${randomSuffix}`,
      title: `${tmpl.title} (Copy)`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderPath: "",
    };
    setTemplateToEdit(cloned);
    setIsEditingTemplate(true);
    setFormsBrowserOpen(false);
  };

  const loadDashboardForms = useCallback(async () => {
    if (!config) return;
    const folders = getFormFoldersList(config);
    if (folders.length === 0) {
      setDashboardForms([]);
      return;
    }
    setIsLoadingForms(true);
    try {
      const discovered = await formService.discoverForms(folders);
      setDashboardForms(discovered);
    } catch (e) {
      console.error("Failed to load dashboard forms:", e);
    } finally {
      setIsLoadingForms(false);
    }
  }, [config]);

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

  if (isEditingTemplate) {
    return (
      <FormEditor
        initialTemplate={templateToEdit}
        onClose={() => {
          setIsEditingTemplate(false);
          setTemplateToEdit(null);
          loadDashboardForms();
        }}
        onSaved={(_saved) => {
          setIsEditingTemplate(false);
          setTemplateToEdit(null);
          loadDashboardForms();
        }}
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
          loadDashboardForms();
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
          setFormsBrowserFolder(undefined);
          setFormsBrowserInitialForm(undefined);
          loadDashboardForms();
        }}
        onSelectForm={(tmpl, sub) => {
          setFormsBrowserOpen(false);
          setFormsBrowserInitialForm(undefined);
          setActiveFormTemplate(tmpl);
          setActiveSubmission(sub);
        }}
        onViewPdf={(path) => setViewingPdfPath(path)}
        onCreateForm={handleOpenCreateForm}
        onEditTemplate={handleOpenEditTemplate}
        onCloneTemplate={handleOpenCloneTemplate}
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
                    size="sm"
                    onClick={handleOpenCreateForm}
                    className="text-xs gap-1.5 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Form</span>
                  </Button>
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

              {/* Dynamic User Forms */}
              {getFormFoldersList(config).length === 0 ? (
                <div className="border border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center space-y-3 bg-muted/10">
                  <FolderPlus className="w-10 h-10 text-muted-foreground/60" />
                  <div>
                    <h4 className="font-semibold text-sm">
                      No Form Folders Configured
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Configure folders in Settings to store and organize your
                      custom forms and submissions.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs gap-1.5 mt-2"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Configure Form Folders</span>
                  </Button>
                </div>
              ) : isLoadingForms ? (
                <div className="border rounded-xl p-12 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading forms...</span>
                </div>
              ) : dashboardForms.length === 0 ? (
                <div className="border border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center space-y-3 bg-muted/10">
                  <ClipboardList className="w-10 h-10 text-muted-foreground/60" />
                  <div>
                    <h4 className="font-semibold text-sm">
                      No Forms Created Yet
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Create your first custom form template using the Form
                      Editor to start collecting field data.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="text-xs gap-1.5 mt-2"
                    onClick={handleOpenCreateForm}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Form</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardForms.map((form) => (
                    <div
                      key={form.folderPath || form.id}
                      className="border rounded-xl p-5 flex flex-col justify-between bg-card shadow-xs hover:border-foreground/40 hover:bg-muted/20 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            v{form.version || 1}
                          </span>
                          {form.folderPath && (
                            <span
                              className="text-[10px] text-muted-foreground font-mono truncate max-w-[130px]"
                              title={`/${form.folderPath}`}
                            >
                              /{form.folderPath}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-base text-foreground">
                          {form.title}
                        </h3>
                        {form.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {form.description}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            {form.sections.reduce(
                              (acc, s) => acc + s.fields.length,
                              0,
                            )}{" "}
                            fields
                          </p>
                        )}
                      </div>

                      <div className="pt-4 mt-3 border-t flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs gap-1 font-semibold"
                          onClick={() => {
                            setActiveFormTemplate(form);
                            setActiveSubmission(undefined);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Fill Form</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setFormsBrowserInitialForm(form);
                            setFormsBrowserFolder(form.folderPath);
                            setFormsBrowserOpen(true);
                          }}
                          title="View Previous Submissions & PDFs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
