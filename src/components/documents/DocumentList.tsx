import { useState, useEffect, useCallback } from "react";
import { syncManager } from "../../lib/sync/sync-manager";
import type { FileInfo } from "../../lib/storage/adapter";
import {
  Folder,
  FileText,
  Image as ImageIcon,
  FileVideo,
  File,
} from "lucide-react";
import { DocumentViewer } from "./DocumentViewer";
import { useConfigStore } from "../../store/config-store";
import { useTranslation } from "react-i18next";
import { AppHeader } from "../layout/AppHeader";
import { EmptyState } from "../ui/empty-state";

interface DocumentListProps {
  basePath?: string;
  onClose: () => void;
}

const EMPTY_SYNC_FOLDERS: string[] = [];

export function DocumentList({ basePath = "", onClose }: DocumentListProps) {
  const { t } = useTranslation();
  const syncFolders =
    useConfigStore((state) => state.config?.syncFolders) ?? EMPTY_SYNC_FOLDERS;

  const initialPath =
    basePath || (syncFolders.length === 1 ? syncFolders[0] : "");
  const effectiveBasePath =
    basePath || (syncFolders.length === 1 ? syncFolders[0] : "");

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const loadDirectory = useCallback(
    async (path: string) => {
      if (path === "") {
        if (syncFolders.length === 0) {
          setFiles([]);
          setLoading(false);
          return;
        }
        if (syncFolders.length > 1) {
          setFiles(
            syncFolders.map((folder) => ({
              name: folder.split("/").pop() || folder,
              path: folder,
              isDirectory: true,
            })),
          );
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        const adapter = syncManager.getAdapter();
        // Only list local files for the document browser since it's offline-first
        const entries = await adapter.listLocalFiles(path);

        // Sort: folders first, then alphabetically
        entries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        setFiles(entries);
      } catch (e) {
        console.error("Failed to load directory", e);
      } finally {
        setLoading(false);
      }
    },
    [syncFolders],
  );

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const navigateUp = () => {
    if (currentPath === effectiveBasePath) {
      onClose();
      return;
    }
    const parts = currentPath.split("/").filter((p) => p);
    parts.pop();
    const newPath = parts.join("/");
    setCurrentPath(newPath);
  };

  const getThumbnailIcon = (file: FileInfo) => {
    if (file.isDirectory)
      return <Folder className="w-16 h-16 text-blue-500 mb-2" />;
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf"))
      return <FileText className="w-16 h-16 text-red-500 mb-2" />;
    if (
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg")
    )
      return <ImageIcon className="w-16 h-16 text-green-500 mb-2" />;
    if (name.endsWith(".mp4"))
      return <FileVideo className="w-16 h-16 text-purple-500 mb-2" />;
    return <File className="w-16 h-16 text-gray-400 mb-2" />;
  };

  if (selectedDocument) {
    return (
      <DocumentViewer
        filePath={selectedDocument}
        onClose={() => setSelectedDocument(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader
        onBack={navigateUp}
        title={
          currentPath === ""
            ? t("documents.title")
            : currentPath.split("/").pop()
        }
        subtitle={currentPath || undefined}
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            <div className="animate-pulse">
              {t("documents.loadingDocuments")}
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={Folder}
              title={
                currentPath === ""
                  ? t("documents.noSyncFolders")
                  : t("documents.folderEmpty")
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => {
                  if (file.isDirectory) {
                    setCurrentPath(file.path);
                  } else {
                    setSelectedDocument(file.path);
                  }
                }}
                className="flex flex-col items-center p-4 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="bg-background border rounded-xl p-6 shadow-sm group-hover:shadow-md transition-all mb-3 flex justify-center items-center w-full aspect-square">
                  {getThumbnailIcon(file)}
                </div>
                <span className="text-sm font-medium text-center line-clamp-2 w-full break-words">
                  {file.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
