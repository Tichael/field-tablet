import { create } from "zustand";

interface AppState {
  isConfigured: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  setConfigured: (configured: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isConfigured: false,
  isSyncing: false,
  lastSyncTime: null,
  setConfigured: (configured) => set({ isConfigured: configured }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
}));
