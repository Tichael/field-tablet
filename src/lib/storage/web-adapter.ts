import { get, set } from 'idb-keyval';
import type { StorageAdapter } from './adapter';

const DIRECTORY_HANDLE_KEY = 'app_config_directory_handle';

export class WebStorageAdapter implements StorageAdapter {
  id = 'web-fs-access';

  isAvailable(): boolean {
    return 'showDirectoryPicker' in window;
  }

  async requestPermission(): Promise<boolean> {
    try {
      let handle = await get(DIRECTORY_HANDLE_KEY);
      if (!handle) {
        // @ts-ignore
        handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await set(DIRECTORY_HANDLE_KEY, handle);
      }
      
      // @ts-ignore
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') return true;
      
      // @ts-ignore
      const request = await handle.requestPermission({ mode: 'readwrite' });
      return request === 'granted';
    } catch (e) {
      console.error('Failed to request permission for directory', e);
      return false;
    }
  }

  async getFiles(_subpath: string = ''): Promise<{ name: string; content: string }[]> {
    const handle = await get(DIRECTORY_HANDLE_KEY);
    if (!handle) throw new Error('No directory handle found');

    const files: { name: string; content: string }[] = [];
    
    // @ts-ignore
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
        const file = await entry.getFile();
        const content = await file.text();
        files.push({ name: entry.name, content });
      }
    }
    
    return files;
  }

  async saveFile(path: string, content: string): Promise<void> {
     const handle = await get(DIRECTORY_HANDLE_KEY);
     if (!handle) throw new Error('No directory handle found');
     
     // @ts-ignore
     const fileHandle = await handle.getFileHandle(path, { create: true });
     const writable = await fileHandle.createWritable();
     await writable.write(content);
     await writable.close();
  }
}
