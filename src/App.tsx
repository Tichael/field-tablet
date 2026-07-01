import { useEffect, useState } from "react";
import "./App.css";
import { syncManager } from "./lib/sync/sync-manager";
import { useAppStore } from "./store/app-store";
import { useConfigStore } from "./store/config-store";
import { SetupScreen } from "./components/setup/SetupScreen";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { Button } from "./components/ui/button";

import { applyTheme } from "./lib/theme";

function App() {
  const isConfigured = useAppStore((state) => state.isConfigured);
  const isEditingConfig = useAppStore((state) => state.isEditingConfig);
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const { config, loadConfig } = useConfigStore();
  const [isInitializing, setIsInitializing] = useState(true);

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
    if (!config) return;
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
          {!isEditingConfig && (
            <Button
              onClick={() => setSettingsOpen(!isSettingsOpen)}
              variant={isSettingsOpen ? "secondary" : "outline"}
            >
              {isSettingsOpen ? "Back to App" : "Settings"}
            </Button>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        {isSettingsOpen ? (
          <SettingsScreen />
        ) : (
          <div className="px-4 py-6 sm:px-0">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl h-96 flex flex-col items-center justify-center bg-background/50">
              <p className="text-muted-foreground font-medium">
                Main App Content
              </p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Forms and templates will be loaded here.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
