import { create } from "zustand";

interface AppState {
  isConfigured: boolean;
  isSyncing: boolean;
  isEditingConfig: boolean;
  isSettingsOpen: boolean;
  lastSyncTime: number | null;
  setConfigured: (configured: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setEditingConfig: (editing: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setLastSyncTime: (time: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isConfigured: false,
  isSyncing: false,
  isEditingConfig: false,
  isSettingsOpen: false,
  lastSyncTime: null,
  setConfigured: (configured) => set({ isConfigured: configured }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setEditingConfig: (editing) => set({ isEditingConfig: editing }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
}));
