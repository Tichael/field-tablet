import { create } from "zustand";

interface AppState {
  isConfigured: boolean;
  isSyncing: boolean;
  isEditingConfig: boolean;
  isSettingsOpen: boolean;
  lastSyncTime: number | null;
  error: string | null;
  needsPermission: boolean;
  pendingUploadsCount: number;
  setConfigured: (configured: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setEditingConfig: (editing: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setLastSyncTime: (time: number) => void;
  setError: (error: string | null) => void;
  setNeedsPermission: (needs: boolean) => void;
  setPendingUploadsCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isConfigured:
    typeof localStorage !== "undefined"
      ? localStorage.getItem("isConfigured") === "true"
      : false,
  isSyncing: false,
  isEditingConfig: false,
  isSettingsOpen: false,
  lastSyncTime: null,
  error: null,
  needsPermission: false,
  pendingUploadsCount: 0,
  setConfigured: (configured) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("isConfigured", String(configured));
    }
    set({ isConfigured: configured });
  },
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setEditingConfig: (editing) => set({ isEditingConfig: editing }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setError: (error) => set({ error }),
  setNeedsPermission: (needs) => set({ needsPermission: needs }),
  setPendingUploadsCount: (count) => set({ pendingUploadsCount: count }),
}));
