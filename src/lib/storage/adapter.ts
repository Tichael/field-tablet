export interface StorageAdapter {
  id: string;
  isAvailable(): boolean;
  requestPermission(): Promise<boolean>;
  getFiles(subpath?: string): Promise<{ name: string; content: string }[]>;
  saveFile(path: string, content: string): Promise<void>;
}
