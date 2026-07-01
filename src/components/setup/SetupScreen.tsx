import { useState, useEffect } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import { useConfigStore } from "../../store/config-store";
import { Button } from "../ui/button";
import { Capacitor } from "@capacitor/core";
// idb-keyval is no longer needed here
import { Input } from "../ui/input";

import { GenericFileBrowser } from "../documents/GenericFileBrowser";

export function SetupScreen() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const setConfigured = useAppStore((state) => state.setConfigured);
  const setActiveConfigFile = useConfigStore(
    (state) => state.setActiveConfigFile,
  );

  const isNative = Capacitor.isNativePlatform();

  // Check if we are running in a browser on Android (not Capacitor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAndroidBrowser =
    !isNative && /android/i.test(navigator.userAgent || "");

  // Check if the browser supports the File System Access API
  const isBrowserSupported = "showDirectoryPicker" in window;

  const [step, setStep] = useState<1 | 2>(1);
  const [newFileName, setNewFileName] = useState("");
  const [browserPath, setBrowserPath] = useState("");

  const [smbHost, setSmbHost] = useState("");
  const [smbShare, setSmbShare] = useState("");
  const [smbDomain, setSmbDomain] = useState("");
  const [smbUser, setSmbUser] = useState("");
  const [smbPass, setSmbPass] = useState("");

  useEffect(() => {
    if (localStorage.getItem("skipSetupStep1") === "true") {
      localStorage.removeItem("skipSetupStep1");
      setStep(2);
    }
  }, []);

  const handleSelectFolder = async () => {
    try {
      const success = await syncManager.configure({ forcePrompt: true });
      if (success) {
        setStep(2);
      }
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
      } else {
        setStep(2);
      }
    } catch (e: any) {
      console.error("Error during native configure:", e);
      alert(`SMB Configuration Error: ${e.message || "Unknown error"}`);
    }
  };

  const selectConfigFile = (filename: string, isNew = false) => {
    let finalName = filename.trim();
    if (!finalName) {
      alert("Filename cannot be empty");
      return;
    }
    if (!finalName.endsWith(".json")) {
      finalName += ".json";
    }
    if (isNew) {
      localStorage.setItem("openEditor", "true");
    }
    setActiveConfigFile(finalName);
    setConfigured(true);
  };

  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
        <div className="max-w-2xl w-full bg-background rounded-xl shadow-lg border p-8 space-y-6 flex flex-col h-[80vh]">
          <div className="text-center shrink-0">
            <h1 className="text-2xl font-bold tracking-tight">
              Select Configuration
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Please browse and select the active configuration (.json) file.
            </p>
          </div>

          <div className="flex-1 overflow-hidden">
            <GenericFileBrowser 
              onFileSelect={(path) => selectConfigFile(path)}
              onPathChange={setBrowserPath}
              allowedExtensions={[".json"]}
            />
          </div>

          <div className="border-t pt-4 space-y-3 mt-4 shrink-0">
            <h3 className="text-sm font-medium">
              Or create a new configuration {browserPath ? `in /${browserPath}` : 'at root'}:
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. tablet-config"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
              />
              <Button
                onClick={() => {
                  const name = newFileName.trim() || "tablet-config";
                  const jsonName = name.endsWith(".json")
                    ? name
                    : name + ".json";
                  const fullPath = browserPath ? `${browserPath}/${jsonName}` : jsonName;
                  selectConfigFile(fullPath, true);
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        ) : !isNative ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm mb-4">
            <p className="font-semibold mb-1">Important: Select the Main Folder</p>
            <p>
              Please make sure to select the main, top-level folder of your server drive. If you select a sub-folder, the paths might not match and the app may not work correctly on other devices.
            </p>
          </div>
        ) : null}

        {isNative ? (
          <form
            onSubmit={handleNativeSubmit}
            className="flex flex-col gap-3 pt-4"
          >
            <Input
              type="text"
              placeholder="SMB Host (e.g. 192.168.1.10)"
              value={smbHost}
              onChange={(e) => setSmbHost(e.target.value)}
              required
            />
            <Input
              type="text"
              placeholder="Share Name"
              value={smbShare}
              onChange={(e) => setSmbShare(e.target.value)}
              required
            />
            <Input
              type="text"
              placeholder="Domain (Optional)"
              value={smbDomain}
              onChange={(e) => setSmbDomain(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Username"
              value={smbUser}
              onChange={(e) => setSmbUser(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={smbPass}
              onChange={(e) => setSmbPass(e.target.value)}
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
          </div>
        )}
      </div>
    </div>
  );
}
