// Type definitions for Electron API exposed via preload
export interface ElectronAPI {
  getDashboard: () => Promise<any>;
  getPluggyToken: () => Promise<string>;
  syncPluggy: (itemId: string) => Promise<{ success: boolean; totalSynced: number }>;
  updateCategory: (transactionId: number, category: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

