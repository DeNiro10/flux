const { contextBridge, ipcRenderer } = require('electron');

// Debug: verificar se o preload está sendo executado
console.log('[PRELOAD] ========================================');
console.log('[PRELOAD] Preload script carregado');
console.log('[PRELOAD] contextBridge disponível?', typeof contextBridge !== 'undefined');
console.log('[PRELOAD] ipcRenderer disponível?', typeof ipcRenderer !== 'undefined');
console.log('[PRELOAD] ========================================');

try {
  const electronAPI = {
    getDashboard: () => {
      console.log('[PRELOAD] getDashboard chamado');
      return ipcRenderer.invoke('get-dashboard');
    },
    getPluggyToken: () => {
      console.log('[PRELOAD] getPluggyToken chamado');
      return ipcRenderer.invoke('get-pluggy-token');
    },
    syncPluggy: (itemId) => {
      console.log('[PRELOAD] syncPluggy chamado com itemId:', itemId);
      return ipcRenderer.invoke('sync-pluggy', itemId);
    },
    updateCategory: (transactionId, category) => {
      console.log('[PRELOAD] updateCategory chamado');
      return ipcRenderer.invoke('update-category', { transactionId, category });
    },
  };
  
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('[PRELOAD] ✅ electronAPI exposto com sucesso');
  console.log('[PRELOAD] electronAPI keys:', Object.keys(electronAPI));
} catch (error) {
  console.error('[PRELOAD] ❌ Erro ao expor electronAPI:', error);
  console.error('[PRELOAD] Stack:', error.stack);
}

