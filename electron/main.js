import electron from 'electron';
const { app, BrowserWindow, ipcMain } = electron;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initDB, categorize, syncTransactions, updateTransactionCategory, getDashboardData } from './db.js';
import { PluggyClient } from './pluggy-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANTE: Substitua pelos seus valores reais da API Pluggy
const PLUGGY_CLIENT_ID = 'INSIRA_AQUI';
const PLUGGY_CLIENT_SECRET = 'INSIRA_AQUI';

let mainWindow;
let pluggyClient;

function createWindow() {
  // Usar caminho absoluto para garantir que funcione
  let preloadPath = path.resolve(__dirname, 'preload.cjs');
  console.log('[MAIN] ========================================');
  console.log('[MAIN] Preload path (absoluto):', preloadPath);
  console.log('[MAIN] __dirname:', __dirname);
  console.log('[MAIN] Preload file exists:', fs.existsSync(preloadPath));
  console.log('[MAIN] ========================================');
  
  if (!fs.existsSync(preloadPath)) {
    console.error('[MAIN] ❌ ERRO: Arquivo preload.js não encontrado em:', preloadPath);
    // Tentar caminho alternativo
    const altPath = path.join(process.cwd(), 'electron', 'preload.js');
    console.log('[MAIN] Tentando caminho alternativo:', altPath);
    if (fs.existsSync(altPath)) {
      console.log('[MAIN] ✅ Arquivo encontrado no caminho alternativo');
      preloadPath = altPath;
    }
  } else {
    console.log('[MAIN] ✅ Arquivo preload.js encontrado');
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false, // Desabilitar sandbox para garantir que o preload funcione
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8fafc',
  });
  
  // Verificar se o preload foi carregado
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Página carregada');
    // Aguardar um pouco para garantir que o preload foi executado
    setTimeout(() => {
      mainWindow.webContents.executeJavaScript(`
        console.log('[RENDERER] window.electronAPI disponível?', typeof window.electronAPI !== 'undefined');
        console.log('[RENDERER] window.electronAPI:', window.electronAPI);
        if (typeof window.electronAPI === 'undefined') {
          console.error('[RENDERER] ERRO: window.electronAPI não está disponível!');
          console.log('[RENDERER] window keys:', Object.keys(window).filter(k => k.includes('electron') || k.includes('Electron')));
        }
      `).catch(err => console.error('[MAIN] Erro ao executar script:', err));
    }, 500);
  });
  
  // Listener para erros do preload
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('[MAIN] Erro ao carregar preload:', preloadPath, error);
    console.error('[MAIN] Stack trace:', error.stack);
  });
  
  // Listener para quando o preload terminar de carregar
  mainWindow.webContents.on('dom-ready', () => {
    console.log('[MAIN] DOM pronto');
  });

  // Inicializar banco de dados
  initDB();

  // Inicializar cliente Pluggy
  if (PLUGGY_CLIENT_ID !== 'INSIRA_AQUI' && PLUGGY_CLIENT_SECRET !== 'INSIRA_AQUI') {
    try {
      pluggyClient = new PluggyClient({
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET,
      });
    } catch (error) {
      console.error('Erro ao inicializar Pluggy client:', error);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Retorna dados do dashboard
ipcMain.handle('get-dashboard', async () => {
  try {
    return getDashboardData();
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    throw error;
  }
});

// Obtém token de conexão Pluggy
ipcMain.handle('get-pluggy-token', async () => {
  try {
    if (!pluggyClient) {
      const errorMsg = `Pluggy client não configurado. 
      
Por favor, configure as credenciais da Pluggy:
1. Abra o arquivo: electron/main.js
2. Localize as linhas 12-13
3. Substitua 'INSIRA_AQUI' pelos seus valores reais:
   - PLUGGY_CLIENT_ID
   - PLUGGY_CLIENT_SECRET
4. Salve o arquivo e reinicie o aplicativo

Para obter as credenciais, acesse: https://dashboard.pluggy.ai/`;
      throw new Error(errorMsg);
    }
    // A API do Pluggy pode variar, ajuste conforme necessário
    const response = await pluggyClient.createConnectToken();
    // Retorna o accessToken ou o token completo dependendo da resposta
    return response.accessToken || response.token || response;
  } catch (error) {
    console.error('Erro ao obter token Pluggy:', error);
    throw error;
  }
});

// Sincroniza transações do Pluggy
ipcMain.handle('sync-pluggy', async (event, itemId) => {
  try {
    if (!pluggyClient) {
      throw new Error('Pluggy client não configurado. Verifique as credenciais.');
    }

    // Buscar contas do item
    // A API pode retornar { results: [...] } ou array direto
    const accountsResponse = await pluggyClient.fetchAccounts(itemId);
    const accounts = accountsResponse?.results || accountsResponse || [];
    
    if (!accounts || accounts.length === 0) {
      throw new Error('Nenhuma conta encontrada para este item.');
    }

    let totalSynced = 0;

    // Para cada conta, buscar transações
    for (const account of accounts) {
      try {
        // fetchTransactions já retorna um array diretamente
        const transactions = await pluggyClient.fetchTransactions(account.id);
        const transactionsArray = Array.isArray(transactions) ? transactions : [];
        
        if (transactionsArray && transactionsArray.length > 0) {
          const synced = await syncTransactions(transactionsArray, account.id);
          totalSynced += synced;
        }
      } catch (error) {
        console.error(`Erro ao sincronizar conta ${account.id}:`, error);
      }
    }

    return { success: true, totalSynced };
  } catch (error) {
    console.error('Erro ao sincronizar Pluggy:', error);
    throw error;
  }
});

// Atualiza categoria de uma transação
ipcMain.handle('update-category', async (event, { transactionId, category }) => {
  try {
    await updateTransactionCategory(transactionId, category);
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    throw error;
  }
});

