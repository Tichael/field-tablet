import { useState, useEffect } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import { useAppStore } from "../../store/app-store";
import { useConfigStore } from "../../store/config-store";
import { Button } from "../ui/button";
import { Capacitor } from "@capacitor/core";
import { get } from "idb-keyval";
import { Input } from "../ui/input";

import { FileJson, ChevronRight } from "lucide-react";

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
  const [jsonFiles, setJsonFiles] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState("");

  const [smbHost, setSmbHost] = useState("");
  const [smbShare, setSmbShare] = useState("");
  const [smbDomain, setSmbDomain] = useState("");
  const [smbUser, setSmbUser] = useState("");
  const [smbPass, setSmbPass] = useState("");

  const fetchJsonFiles = async () => {
    try {
      const files = await get("app_config_files");
      if (files && Array.isArray(files)) {
        const jsonNames = files
          .filter((f) => f.name.endsWith(".json"))
          .map((f) => f.name);
        setJsonFiles(jsonNames);
      }
    } catch (e) {
      console.error("Failed to load files from cache", e);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("skipSetupStep1") === "true") {
      localStorage.removeItem("skipSetupStep1");
      fetchJsonFiles().then(() => setStep(2));
    }
  }, []);

  const handleSelectFolder = async () => {
    try {
      const success = await syncManager.configure({ forcePrompt: true });
      if (success) {
        await fetchJsonFiles();
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
        await fetchJsonFiles();
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
        <div className="max-w-md w-full bg-background rounded-xl shadow-lg border p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Select Configuration
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Please choose a configuration file to load.
            </p>
          </div>

          <div className="space-y-3">
            {jsonFiles.length > 0 ? (
              <div className="border rounded-lg overflow-hidden divide-y">
                {jsonFiles.map((file) => (
                  <button
                    key={file}
                    onClick={() => selectConfigFile(file)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <FileJson className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium text-sm">{file}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No .json files found.
              </p>
            )}
          </div>

          <div className="border-t pt-4 space-y-3 mt-4">
            <h3 className="text-sm font-medium">
              Or create a new configuration:
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
                  if (jsonFiles.includes(jsonName)) {
                    alert(
                      `A configuration file named "${jsonName}" already exists. Please choose another name or load the existing one.`,
                    );
                    return;
                  }
                  selectConfigFile(name, true);
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
