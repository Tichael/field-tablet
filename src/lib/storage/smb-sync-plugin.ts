import { registerPlugin } from "@capacitor/core";

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
  }): Promise<{ success: boolean }>;

  stopBackgroundSync(): Promise<{ success: boolean }>;

  forceSync(): Promise<{ success: boolean }>;

  getFiles(): Promise<{ files: { name: string; content: string }[] }>;

  saveFile(options: {
    path: string;
    content: string;
  }): Promise<{ success: boolean }>;
}

export const SmbSync = registerPlugin<SmbSyncPlugin>("SmbSync");
