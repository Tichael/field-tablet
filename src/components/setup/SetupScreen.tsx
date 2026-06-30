import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import { Button } from "../ui/button";

export function SetupScreen() {
  const isSyncing = useAppStore((state) => state.isSyncing);

  // Check if we are running in a browser on Android (not Capacitor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAndroidBrowser = !(window as any).Capacitor && /android/i.test(navigator.userAgent || '');
  
  // Check if the browser supports the File System Access API
  const isBrowserSupported = 'showDirectoryPicker' in window;

  const handleSelectFolder = async () => {
    try {
      await syncManager.configure();
    } catch (e) {
      console.error('Error during configure:', e);
      alert('An error occurred. Check the console for details.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="max-w-md w-full bg-background rounded-xl shadow-lg border p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">App Configuration</h1>
          <p className="mt-2 text-muted-foreground text-sm">Please select a source folder containing your configuration files.</p>
        </div>

        {isAndroidBrowser ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-2">Android Web Browser Detected</p>
            <p className="mb-3">The web version is not supported on Android browsers. Please download the native app for the best experience.</p>
            <Button 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white" 
              onClick={() => window.open('https://github.com/Tichael/field-tablet/releases', '_blank')}
            >
              Get Android App
            </Button>
          </div>
        ) : !isBrowserSupported ? (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-1">Browser Not Supported</p>
            <p>Your browser does not support the required File System capabilities. Please use a recent Chromium-based browser (Chrome, Edge, Opera).</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={handleSelectFolder} 
            disabled={isSyncing || isAndroidBrowser || !isBrowserSupported} 
            className="w-full h-10"
          >
            {isSyncing ? "Configuring..." : "Select Source Folder"}
          </Button>
          <Button variant="outline" className="w-full h-10" disabled>
            Open Editor (Coming Soon)
          </Button>
        </div>
      </div>
    </div>
  );
}
