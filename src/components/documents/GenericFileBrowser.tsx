import { useState, useEffect, useRef, useCallback } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import type { FileInfo } from "../../lib/storage/adapter";
import {
  Folder,
  FolderPlus,
  FolderCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  Image,
  FileVideo,
  File,
  Check,
  RotateCw,
  AlertCircle,
  Loader2,
  Home,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

interface GenericFileBrowserProps {
  onFileSelect?: (path: string) => void;
  onFolderSelect?: (path: string) => void;
  onPathChange?: (path: string) => void;
  allowedExtensions?: string[]; // e.g. ['.json']
  basePath?: string;
  allowCreateFolder?: boolean;
  allowSelectRoot?: boolean;
  existingFolders?: string[];
}

export function GenericFileBrowser({
  onFileSelect,
  onFolderSelect,
  onPathChange,
  allowedExtensions,
  basePath = "",
  allowCreateFolder = true,
  allowSelectRoot = false,
  existingFolders = [],
}: GenericFileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(basePath);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to normalize paths (trim whitespace and leading/trailing slashes)
  const normalizePath = (p: string) => p.trim().replace(/^\/+|\/+$/g, "");

  const normalizedExisting = new Set(
    (existingFolders || []).map(normalizePath).filter(Boolean),
  );
  const normalizedCurrent = normalizePath(currentPath);
  const isCurrentPathExisting = Boolean(
    normalizedCurrent && normalizedExisting.has(normalizedCurrent),
  );
  const parentOfCurrentPath = normalizedCurrent
    ? Array.from(normalizedExisting).find((existing) =>
        normalizedCurrent.startsWith(`${existing}/`),
      )
    : undefined;

  // Folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const adapter = syncManager.getAdapter();
        // For configuration, we might need listRemoteFiles for Android, listLocalFiles for PWA.
        // But both are mapped in the adapters.
        const entries = await adapter.listRemoteFiles(path);

        const filtered = entries.filter((e) => {
          if (e.isDirectory) return true;
          if (!allowedExtensions) return true;
          return allowedExtensions.some((ext) =>
            e.name.toLowerCase().endsWith(ext),
          );
        });

        // Sort: folders first, then alphabetically
        filtered.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        setFiles(filtered);
      } catch (e) {
        console.error("Failed to load directory", e);
      } finally {
        setLoading(false);
      }
    },
    [allowedExtensions],
  );

  useEffect(() => {
    loadDirectory(currentPath);
    if (onPathChange) {
      onPathChange(currentPath);
    }
    // Close new folder form when changing directory
    setIsCreatingFolder(false);
    setNewFolderName("");
    setCreateError(null);
  }, [currentPath, onPathChange, loadDirectory]);

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter((p) => p);
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    if (/[/\\:*?"<>|]/.test(trimmed)) {
      setCreateError('Folder name cannot contain / \\ : * ? " < > |');
      return;
    }

    if (
      files.some(
        (f) => f.isDirectory && f.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setCreateError(`A folder named "${trimmed}" already exists.`);
      return;
    }

    setCreatingFolder(true);
    setCreateError(null);

    const folderPath = currentPath ? `${currentPath}/${trimmed}` : trimmed;

    try {
      const adapter = syncManager.getAdapter();
      await adapter.createDirectory(folderPath);
      setIsCreatingFolder(false);
      setNewFolderName("");
      await loadDirectory(currentPath);
    } catch (e: unknown) {
      console.error("Failed to create folder", e);
      const msg = e instanceof Error ? e.message : "Failed to create folder";
      setCreateError(msg);
    } finally {
      setCreatingFolder(false);
    }
  };

  const getIcon = (file: FileInfo) => {
    if (file.isDirectory)
      return (
        <Folder className="w-5 h-5 text-blue-500 fill-blue-500/20 shrink-0" />
      );
    const name = file.name.toLowerCase();
    if (name.endsWith(".json"))
      return <FileText className="w-5 h-5 text-amber-500 shrink-0" />;
    if (name.endsWith(".pdf"))
      return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
    if (
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg")
    )
      return <Image className="w-5 h-5 text-green-500 shrink-0" />;
    if (name.endsWith(".mp4"))
      return <FileVideo className="w-5 h-5 text-purple-500 shrink-0" />;
    return <File className="w-5 h-5 text-muted-foreground shrink-0" />;
  };

  const pathParts = currentPath.split("/").filter(Boolean);
  const currentFolderName = pathParts[pathParts.length - 1] || "";

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden shadow-xs">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2.5 border-b bg-muted/30 shrink-0">
        <div className="flex items-center min-w-0 overflow-x-auto py-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={navigateUp}
            disabled={!currentPath || loading}
            title="Go up one folder"
            className="shrink-0 mr-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Clickable breadcrumbs */}
          <div className="flex items-center text-xs font-mono">
            <button
              onClick={() => setCurrentPath("")}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent transition-colors",
                !currentPath
                  ? "font-bold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Root directory"
            >
              <Home className="w-3.5 h-3.5" />
              <span>root</span>
            </button>

            {pathParts.map((part, index) => {
              const subPath = pathParts.slice(0, index + 1).join("/");
              const isLast = index === pathParts.length - 1;
              return (
                <div key={subPath} className="flex items-center">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mx-0.5" />
                  <button
                    onClick={() => setCurrentPath(subPath)}
                    disabled={isLast}
                    className={cn(
                      "px-1.5 py-0.5 rounded transition-colors truncate max-w-[130px]",
                      isLast
                        ? "font-bold text-foreground cursor-default"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                    title={part}
                  >
                    {part}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            title="Refresh directory"
          >
            <RotateCw
              className={cn("w-3.5 h-3.5", loading && "animate-spin")}
            />
          </Button>

          {allowCreateFolder && (
            <Button
              variant={isCreatingFolder ? "secondary" : "outline"}
              size="xs"
              onClick={() => {
                setIsCreatingFolder((prev) => !prev);
                setCreateError(null);
                setNewFolderName("");
              }}
              className="gap-1 text-xs"
            >
              <FolderPlus className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
          )}

          {onFolderSelect && (
            <Button
              size="xs"
              onClick={() => onFolderSelect(currentPath || "")}
              disabled={
                (!currentPath && !allowSelectRoot) || isCurrentPathExisting
              }
              className="gap-1 text-xs font-semibold shadow-xs"
              title={
                isCurrentPathExisting
                  ? "This folder is already added to sync"
                  : "Select current folder"
              }
            >
              {isCurrentPathExisting ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <FolderCheck className="w-3.5 h-3.5" />
                  <span>Select Current</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Inline Create Folder Form */}
      {isCreatingFolder && (
        <div className="p-2.5 bg-muted/40 border-b space-y-1.5 shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-primary shrink-0" />
            <Input
              ref={newFolderInputRef}
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                if (createError) setCreateError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateFolder();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setIsCreatingFolder(false);
                  setNewFolderName("");
                  setCreateError(null);
                }
              }}
              disabled={creatingFolder}
              className="h-7 text-xs flex-1"
            />
            <Button
              size="xs"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
              className="gap-1 font-medium"
            >
              {creatingFolder ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Create"
              )}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setIsCreatingFolder(false);
                setNewFolderName("");
                setCreateError(null);
              }}
              disabled={creatingFolder}
            >
              Cancel
            </Button>
          </div>
          {createError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive pl-6">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{createError}</span>
            </div>
          )}
        </div>
      )}

      {/* Directory Contents List */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center space-y-2 text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Loading...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <Folder className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-sm text-muted-foreground">Empty folder</div>
            {allowCreateFolder && !isCreatingFolder && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setIsCreatingFolder(true);
                  setCreateError(null);
                }}
                className="gap-1.5 text-xs mt-1"
              >
                <FolderPlus className="w-3.5 h-3.5 text-primary" />
                Create a folder here
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {files.map((file) => {
              const normalizedFilePath = normalizePath(file.path);
              const isFileExisting =
                file.isDirectory && normalizedExisting.has(normalizedFilePath);
              const parentOfFile = file.isDirectory
                ? Array.from(normalizedExisting).find((existing) =>
                    normalizedFilePath.startsWith(`${existing}/`),
                  )
                : undefined;

              return (
                <li
                  key={file.path}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-accent/70 dark:hover:bg-accent/50 border border-transparent hover:border-border/60 transition-colors group"
                >
                  <button
                    onClick={() => {
                      if (file.isDirectory) {
                        setCurrentPath(file.path);
                      } else if (onFileSelect) {
                        onFileSelect(file.path);
                      }
                    }}
                    className="w-full flex items-center p-1 text-left min-w-0"
                  >
                    <span className="shrink-0">{getIcon(file)}</span>
                    <span className="ml-3 text-sm truncate font-medium text-foreground group-hover:text-foreground transition-colors">
                      {file.name}
                    </span>
                  </button>

                  {/* For folders when in folder selection mode, provide explicit Select action or status badge */}
                  {onFolderSelect &&
                    file.isDirectory &&
                    (isFileExisting ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        <Check className="w-3 h-3" />
                        <span>Added</span>
                      </span>
                    ) : parentOfFile ? (
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground border border-border/40 hidden sm:inline-block"
                          title={`Already covered by parent folder: /${parentOfFile}`}
                        >
                          In /{parentOfFile}
                        </span>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFolderSelect(file.path);
                          }}
                          className="gap-1 text-xs shrink-0 font-medium"
                          title={`Select "${file.name}"`}
                        >
                          <Check className="w-3 h-3 text-primary" />
                          <span>Select</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFolderSelect(file.path);
                        }}
                        className="ml-2 gap-1 text-xs shrink-0 font-medium"
                        title={`Select "${file.name}"`}
                      >
                        <Check className="w-3 h-3 text-primary" />
                        <span>Select</span>
                      </Button>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Prominent Bottom Action Bar for Folder Selection */}
      {onFolderSelect && (
        <div className="flex items-center justify-between gap-3 p-3 border-t bg-muted/40 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current Folder
            </div>
            <div className="text-sm font-semibold truncate text-foreground flex items-center gap-1.5 mt-0.5">
              <Folder className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="font-mono text-xs sm:text-sm">
                {currentPath ? `/${currentPath}` : "/ (Root Directory)"}
              </span>
            </div>
            {isCurrentPathExisting && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>This folder is already in your sync folders list</span>
              </div>
            )}
            {!isCurrentPathExisting && parentOfCurrentPath && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Already covered by parent folder:{" "}
                <span className="font-mono font-medium text-foreground">
                  /{parentOfCurrentPath}
                </span>
              </div>
            )}
          </div>
          <Button
            size="default"
            onClick={() => onFolderSelect(currentPath || "")}
            disabled={
              (!currentPath && !allowSelectRoot) || isCurrentPathExisting
            }
            className={cn(
              "shrink-0 gap-2 font-semibold shadow px-4 text-sm",
              isCurrentPathExisting && "opacity-60",
            )}
          >
            {isCurrentPathExisting ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Already Added</span>
              </>
            ) : (
              <>
                <FolderCheck className="w-4 h-4" />
                <span>
                  {!currentPath && !allowSelectRoot
                    ? "Choose a Folder"
                    : currentPath
                      ? `Select "${currentFolderName}"`
                      : "Select Root Folder"}
                </span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
