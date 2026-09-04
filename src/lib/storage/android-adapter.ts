import type { StorageAdapter, FileInfo, SaveFileOptions } from "./adapter";
import { SmbSync } from "./smb-sync-plugin";
import { Capacitor } from "@capacitor/core";
import { useAppStore } from "../../store/app-store";

export class AndroidSmbAdapter implements StorageAdapter {
  id = "android-smb-sync";

  isAvailable(): boolean {
    return true;
  }

  async requestPermission(_forcePrompt = false): Promise<boolean> {
    return true; // Android permissions handled by OS/Plugin
  }

  async verifyPermission(): Promise<boolean> {
    return true;
  }

  async getFiles(
    _subpath: string = "",
  ): Promise<{ name: string; content: string }[]> {
    try {
      const result = await SmbSync.getFiles();
      return result.files || [];
    } catch (e) {
      console.error("Failed to get files from native cache", e);
      return [];
    }
  }

  async saveFile(
    path: string,
    content: string,
    options?: SaveFileOptions,
  ): Promise<void> {
    try {
      const result = await SmbSync.saveFile({
        path,
        content,
        isBase64: options?.isBase64 ?? false,
      });
      if (result && typeof result.pendingUploadsCount === "number") {
        useAppStore
          .getState()
          .setPendingUploadsCount(result.pendingUploadsCount);
      } else if (result && result.pendingUpload) {
        const currentCount = useAppStore.getState().pendingUploadsCount || 0;
        useAppStore.getState().setPendingUploadsCount(currentCount + 1);
      }
    } catch (e) {
      console.error("Failed to save file to native cache", e);
      throw e;
    }
  }

  async getPendingUploadsCount(): Promise<number> {
    try {
      const result = await SmbSync.getPendingUploadsCount();
      return result.count || 0;
    } catch {
      return 0;
    }
  }

  async createDirectory(path: string): Promise<void> {
    try {
      await SmbSync.createDirectory({ path });
    } catch (e) {
      console.error("Failed to create directory in native storage", e);
      throw e;
    }
  }

  async listRemoteFiles(path: string): Promise<FileInfo[]> {
    const result = await SmbSync.listRemoteFiles({ path });
    return result.files || [];
  }

  async listLocalFiles(path: string): Promise<FileInfo[]> {
    const result = await SmbSync.listLocalFiles({ path });
    return result.files || [];
  }

  async getFileUrl(path: string): Promise<string> {
    const result = await SmbSync.getFileUrl({ path });
    return Capacitor.convertFileSrc(result.url);
  }

  async getNativeFilePath(path: string): Promise<string> {
    const result = await SmbSync.getFileUrl({ path });
    return result.url;
  }

  async readFileText(path: string): Promise<string> {
    const result = await SmbSync.readFileText({ path });
    return result.content;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const result = await SmbSync.checkConnection();
      return Boolean(result && result.connected);
    } catch (e) {
      console.error("Failed to check SMB connection", e);
      return false;
    }
  }
}
