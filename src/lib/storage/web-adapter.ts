import { get, set } from "idb-keyval";
import type { StorageAdapter, FileInfo } from "./adapter";

const DIRECTORY_HANDLE_KEY = "app_config_directory_handle";

export class WebStorageAdapter implements StorageAdapter {
  id = "web-fs-access";

  isAvailable(): boolean {
    return "showDirectoryPicker" in window;
  }

  async requestPermission(forcePrompt = false): Promise<boolean> {
    try {
      let handle = forcePrompt ? null : await get(DIRECTORY_HANDLE_KEY);
      if (!handle) {
        // @ts-ignore
        handle = await window.showDirectoryPicker({ mode: "readwrite" });
        await set(DIRECTORY_HANDLE_KEY, handle);
      }

      // @ts-ignore
      const permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission === "granted") return true;

      // @ts-ignore
      const request = await handle.requestPermission({ mode: "readwrite" });
      return request === "granted";
    } catch (e) {
      console.error("Failed to request permission for directory", e);
      return false;
    }
  }

  async verifyPermission(): Promise<boolean> {
    try {
      const handle = await get(DIRECTORY_HANDLE_KEY);
      if (!handle) return false;
      // @ts-ignore
      const permission = await handle.queryPermission({ mode: "readwrite" });
      return permission === "granted";
    } catch (e) {
      return false;
    }
  }

  async getFiles(
    _subpath: string = "",
  ): Promise<{ name: string; content: string }[]> {
    const handle = await get(DIRECTORY_HANDLE_KEY);
    if (!handle) throw new Error("No directory handle found");

    const files: { name: string; content: string }[] = [];

    // @ts-ignore
    for await (const entry of handle.values()) {
      if (entry.kind === "file" && entry.name.endsWith(".json")) {
        const file = await entry.getFile();
        const content = await file.text();
        files.push({ name: entry.name, content });
      }
    }

    return files;
  }

  async saveFile(path: string, content: string): Promise<void> {
    const parts = path.split("/").filter(p => p);
    const fileName = parts.pop();
    if (!fileName) throw new Error("Invalid file path");

    const dirPath = parts.join("/");
    const dirHandle = await this.getHandleFromPath(dirPath);

    // @ts-ignore
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private async getHandleFromPath(path: string): Promise<any> {
    const rootHandle = await get(DIRECTORY_HANDLE_KEY);
    if (!rootHandle) throw new Error("No directory handle found");
    
    if (!path || path === "/" || path === "") return rootHandle;

    const parts = path.split("/").filter(p => p);
    let current = rootHandle;
    for (const part of parts) {
      // @ts-ignore
      current = await current.getDirectoryHandle(part, { create: false });
    }
    return current;
  }

  async listRemoteFiles(path: string): Promise<FileInfo[]> {
    return this.listLocalFiles(path);
  }

  async listLocalFiles(path: string): Promise<FileInfo[]> {
    try {
      const handle = await this.getHandleFromPath(path);
      const files: FileInfo[] = [];
      // @ts-ignore
      for await (const entry of handle.values()) {
        files.push({
          name: entry.name,
          path: path ? `${path}/${entry.name}` : entry.name,
          isDirectory: entry.kind === "directory"
        });
      }
      return files;
    } catch (e) {
      console.error("Failed to list local files", e);
      return [];
    }
  }

  async getFileUrl(path: string): Promise<string> {
    try {
      const parts = path.split("/").filter(p => p);
      const fileName = parts.pop();
      if (!fileName) throw new Error("Invalid file path");

      const dirPath = parts.join("/");
      const dirHandle = await this.getHandleFromPath(dirPath);
      
      // @ts-ignore
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (e) {
      console.error("Failed to get file URL", e);
      throw e;
    }
  }

  async readFileText(path: string): Promise<string> {
    try {
      const parts = path.split("/").filter(p => p);
      const fileName = parts.pop();
      if (!fileName) throw new Error("Invalid file path");

      const dirPath = parts.join("/");
      const dirHandle = await this.getHandleFromPath(dirPath);
      
      // @ts-ignore
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      console.error("Failed to read file text", e);
      throw e;
    }
  }
}
