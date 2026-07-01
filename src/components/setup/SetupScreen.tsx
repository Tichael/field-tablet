import { useState } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import { Button } from "../ui/button";
import { Capacitor } from "@capacitor/core";

export function SetupScreen() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const isNative = Capacitor.isNativePlatform();

  // Check if we are running in a browser on Android (not Capacitor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAndroidBrowser =
    !isNative && /android/i.test(navigator.userAgent || "");

  // Check if the browser supports the File System Access API
  const isBrowserSupported = "showDirectoryPicker" in window;

  const [smbHost, setSmbHost] = useState("");
  const [smbShare, setSmbShare] = useState("");
  const [smbDomain, setSmbDomain] = useState("");
  const [smbUser, setSmbUser] = useState("");
  const [smbPass, setSmbPass] = useState("");

  const handleSelectFolder = async () => {
    try {
      await syncManager.configure();
    } catch (e) {
      console.error("Error during configure:", e);
      alert("An error occurred. Check the console for details.");
    }
  };

  const handleNativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const success = await syncManager.configure({
        host: smbHost,
        share: smbShare,
        domain: smbDomain,
        username: smbUser,
        password: smbPass,
      });
      if (!success) {
        alert("Failed to connect to SMB share. Please check your credentials.");
      }
    } catch (e: any) {
      console.error("Error during native configure:", e);
      alert(`SMB Configuration Error: ${e.message || "Unknown error"}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="max-w-md w-full bg-background rounded-xl shadow-lg border p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            App Configuration
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {isNative
              ? "Please configure your SMB share details."
              : "Please select a source folder containing your configuration files."}
          </p>
        </div>

        {isAndroidBrowser ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-2">Android Web Browser Detected</p>
            <p className="mb-3">
              The web version is not supported on Android browsers. Please
              download the native app for the best experience.
            </p>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() =>
                window.open(
                  "https://github.com/Tichael/field-tablet/releases",
                  "_blank",
                )
              }
            >
              Get Android App
            </Button>
          </div>
        ) : !isNative && !isBrowserSupported ? (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-1">Browser Not Supported</p>
            <p>
              Your browser does not support the required File System
              capabilities. Please use a recent Chromium-based browser (Chrome,
              Edge, Opera).
            </p>
          </div>
        ) : null}

        {isNative ? (
          <form
            onSubmit={handleNativeSubmit}
            className="flex flex-col gap-3 pt-4"
          >
            <input
              type="text"
              placeholder="SMB Host (e.g. 192.168.1.10)"
              value={smbHost}
              onChange={(e) => setSmbHost(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              required
            />
            <input
              type="text"
              placeholder="Share Name"
              value={smbShare}
              onChange={(e) => setSmbShare(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              required
            />
            <input
              type="text"
              placeholder="Domain (Optional)"
              value={smbDomain}
              onChange={(e) => setSmbDomain(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
            />
            <input
              type="text"
              placeholder="Username"
              value={smbUser}
              onChange={(e) => setSmbUser(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={smbPass}
              onChange={(e) => setSmbPass(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              required
            />
            <Button
              type="submit"
              disabled={isSyncing}
              className="w-full h-10 mt-2"
            >
              {isSyncing ? "Configuring..." : "Connect and Sync"}
            </Button>
          </form>
        ) : (
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
        )}
      </div>
    </div>
  );
}
