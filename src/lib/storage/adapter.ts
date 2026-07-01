export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface StorageAdapter {
  id: string;
  isAvailable(): boolean;
  requestPermission(forcePrompt?: boolean): Promise<boolean>;
  getFiles(subpath?: string): Promise<{ name: string; content: string }[]>;
  saveFile(path: string, content: string): Promise<void>;
  listRemoteFiles(path: string): Promise<FileInfo[]>;
  listLocalFiles(path: string): Promise<FileInfo[]>;
  getFileUrl(path: string): Promise<string>;
  readFileText(path: string): Promise<string>;
  verifyPermission(): Promise<boolean>;
}
