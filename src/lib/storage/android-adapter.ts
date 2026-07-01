import type { StorageAdapter, FileInfo } from "./adapter";
import { SmbSync } from "./smb-sync-plugin";
import { Capacitor } from "@capacitor/core";

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

  async saveFile(path: string, content: string): Promise<void> {
    try {
      await SmbSync.saveFile({ path, content });
    } catch (e) {
      console.error("Failed to save file to native cache", e);
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

  async readFileText(path: string): Promise<string> {
    const result = await SmbSync.readFileText({ path });
    return result.content;
  }
}
