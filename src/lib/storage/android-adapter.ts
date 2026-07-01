import type { StorageAdapter } from "./adapter";
import { SmbSync } from "./smb-sync-plugin";

export class AndroidSmbAdapter implements StorageAdapter {
  id = "android-smb-sync";

  isAvailable(): boolean {
    return true;
  }

  async requestPermission(_forcePrompt?: boolean): Promise<boolean> {
    return true; // Config is handled by SetupScreen directly on Android
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
}
