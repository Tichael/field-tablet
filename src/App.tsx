import { useEffect, useState } from "react";
import "./App.css";
import { syncManager } from "./lib/sync/sync-manager";
import { useAppStore } from "./store/app-store";
import { SetupScreen } from "./components/setup/SetupScreen";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { Button } from "./components/ui/button";

function App() {
  const isConfigured = useAppStore((state) => state.isConfigured);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const init = async () => {
      await syncManager.initialize();
      setIsInitializing(false);
    };
    init();

    return () => {
      syncManager.stopPeriodicSync();
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isConfigured) {
    return <SetupScreen />;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Field Tablet App
          </h1>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant={showSettings ? "secondary" : "outline"}
          >
            {showSettings ? "Back to App" : "Settings"}
          </Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        {showSettings ? (
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
