import { useState, useEffect } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import type { FileInfo } from "../../lib/storage/adapter";
import { Folder, FileText, ChevronLeft, Image, FileVideo, File } from "lucide-react";

interface GenericFileBrowserProps {
  onFileSelect?: (path: string) => void;
  onFolderSelect?: (path: string) => void;
  onPathChange?: (path: string) => void;
  allowedExtensions?: string[]; // e.g. ['.json']
  basePath?: string;
}

export function GenericFileBrowser({ onFileSelect, onFolderSelect, onPathChange, allowedExtensions, basePath = "" }: GenericFileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(basePath);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDirectory(currentPath);
    if (onPathChange) {
      onPathChange(currentPath);
    }
  }, [currentPath, onPathChange]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const adapter = syncManager.getAdapter();
      // For configuration, we might need listRemoteFiles for Android, listLocalFiles for PWA.
      // But both are mapped in the adapters.
      const entries = await adapter.listRemoteFiles(path);
      
      const filtered = entries.filter(e => {
        if (e.isDirectory) return true;
        if (!allowedExtensions) return true;
        return allowedExtensions.some(ext => e.name.toLowerCase().endsWith(ext));
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
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter(p => p);
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  const getIcon = (file: FileInfo) => {
    if (file.isDirectory) return <Folder className="w-5 h-5 text-blue-500" />;
    const name = file.name.toLowerCase();
    if (name.endsWith(".json")) return <FileText className="w-5 h-5 text-gray-500" />;
    if (name.endsWith(".pdf")) return <FileText className="w-5 h-5 text-red-500" />;
    if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return <Image className="w-5 h-5 text-green-500" />;
    if (name.endsWith(".mp4")) return <FileVideo className="w-5 h-5 text-purple-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-background border rounded-md">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center">
          <button 
            onClick={navigateUp} 
            disabled={!currentPath}
            className="p-1 mr-2 rounded hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-mono text-sm truncate">/{currentPath}</span>
        </div>
        {onFolderSelect && (
          <button
            onClick={() => onFolderSelect(currentPath || "")}
            className="px-3 py-1 text-xs font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90"
          >
            Select Folder
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
        ) : files.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Empty folder</div>
        ) : (
          <ul className="space-y-1">
            {files.map(file => (
              <li key={file.path}>
                <button
                  onClick={() => {
                    if (file.isDirectory) {
                      setCurrentPath(file.path);
                    } else if (onFileSelect) {
                      onFileSelect(file.path);
                    }
                  }}
                  className="w-full flex items-center p-2 rounded hover:bg-muted/50 text-left"
                >
                  {getIcon(file)}
                  <span className="ml-3 text-sm truncate">{file.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
