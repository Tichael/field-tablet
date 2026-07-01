import { useEffect, useState } from "react";
import "./App.css";
import { syncManager } from "./lib/sync/sync-manager";
import { useAppStore } from "./store/app-store";
import { DEFAULT_CONFIG, useConfigStore } from "./store/config-store";
import { SetupScreen } from "./components/setup/SetupScreen";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { Button } from "./components/ui/button";

import { Folder } from "lucide-react";
import { applyTheme } from "./lib/theme";
import { DocumentList } from "./components/documents/DocumentList";
import { SyncIndicator } from "./components/ui/SyncIndicator";

function App() {
  const isConfigured = useAppStore((state) => state.isConfigured);
  const isEditingConfig = useAppStore((state) => state.isEditingConfig);
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const needsPermission = useAppStore((state) => state.needsPermission);
  const { config, loadConfig } = useConfigStore();
  const [isInitializing, setIsInitializing] = useState(true);

  const [isDocumentBrowserOpen, setDocumentBrowserOpen] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setSettingsOpen(false);
    }
  }, [isConfigured, setSettingsOpen]);

  useEffect(() => {
    const init = async () => {
      await syncManager.initialize();
      if (isConfigured) {
        await loadConfig();
        if (localStorage.getItem("openEditor") === "true") {
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
            For security reasons, your browser requires you to confirm access to your local folder after a refresh.
          </p>
          <Button 
            className="w-full mt-4" 
            onClick={async () => {
              const success = await syncManager.getAdapter().requestPermission(false);
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
        </div>
      </div>
    );
  }

  if (isDocumentBrowserOpen) {
    return <DocumentList basePath="" onClose={() => setDocumentBrowserOpen(false)} />;
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
            {/* Top row: 3 buttons for forms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center justify-center bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer opacity-70">
                <h3 className="font-semibold text-lg mb-1">Daily Report</h3>
                <p className="text-xs text-muted-foreground">Form template</p>
              </div>
              <div className="border border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center justify-center bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer opacity-70">
                <h3 className="font-semibold text-lg mb-1">Incident Log</h3>
                <p className="text-xs text-muted-foreground">Form template</p>
              </div>
              <div className="border border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center justify-center bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer opacity-70">
                <h3 className="font-semibold text-lg mb-1">Equipment Check</h3>
                <p className="text-xs text-muted-foreground">Form template</p>
              </div>
            </div>

            {/* Bottom row: Large document button */}
            <div
              className="border border-muted-foreground/25 rounded-xl p-10 flex flex-col items-center justify-center bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer w-full"
              onClick={() => setDocumentBrowserOpen(true)}
            >
              <Folder className="w-16 h-16 text-blue-500 mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Documents</h2>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Browse and view offline documents, manuals, circuit diagrams, and building plans.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
