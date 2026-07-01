import { registerPlugin } from "@capacitor/core";
import type { FileInfo } from "./adapter";

export interface SmbSyncPlugin {
  configure(options: {
    host: string;
    share: string;
    username?: string;
    password?: string;
    domain?: string;
  }): Promise<{ success: boolean }>;

  startBackgroundSync(options?: {
    intervalMinutes?: number;
    syncFolders?: string[];
    configFile?: string;
  }): Promise<{ success: boolean }>;

  stopBackgroundSync(): Promise<{ success: boolean }>;

  forceSync(options?: {
    syncFolders?: string[];
    configFile?: string;
  }): Promise<{ success: boolean; error?: string; folder?: string }>;

  getFiles(): Promise<{ files: { name: string; content: string }[] }>;

  saveFile(options: {
    path: string;
    content: string;
  }): Promise<{ success: boolean }>;

  listRemoteFiles(options: { path: string }): Promise<{ files: FileInfo[] }>;
  listLocalFiles(options: { path: string }): Promise<{ files: FileInfo[] }>;
  getFileUrl(options: { path: string }): Promise<{ url: string }>;
  readFileText(options: { path: string }): Promise<{ content: string }>;
}

export const SmbSync = registerPlugin<SmbSyncPlugin>("SmbSync");
