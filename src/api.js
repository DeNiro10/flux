// API client para comunicação com o servidor backend
const API_BASE = 'http://localhost:3000/api';

export const api = {
  // Dashboard
  getDashboard: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.period && filters.period !== 'all') params.append('period', filters.period);
    if (filters.accountType && filters.accountType !== 'all') params.append('accountType', filters.accountType);
    if (filters.bankName && filters.bankName !== 'all') params.append('bankName', filters.bankName);
    if (filters.ownerName && filters.ownerName !== 'all') params.append('ownerName', filters.ownerName);
    
    const url = `${API_BASE}/dashboard${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Erro ao carregar dashboard');
    return response.json();
  },

  // Credenciais Pluggy
  getCredentials: async () => {
    const response = await fetch(`${API_BASE}/credentials`);
    if (!response.ok) throw new Error('Erro ao listar credenciais');
    return response.json();
  },

  createCredential: async (credential) => {
    const response = await fetch(`${API_BASE}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar credencial');
    }
    return response.json();
  },

  updateCredential: async (id, credential) => {
    const response = await fetch(`${API_BASE}/credentials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar credencial');
    }
    return response.json();
  },

  deleteCredential: async (id) => {
    const response = await fetch(`${API_BASE}/credentials/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar credencial');
    }
    return response.json();
  },

  getActiveCredential: async () => {
    const response = await fetch(`${API_BASE}/credentials/active`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Erro ao obter credencial ativa');
    }
    return response.json();
  },

  // Pluggy
  getPluggyToken: async (credentialId) => {
    const response = await fetch(`${API_BASE}/pluggy/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential_id: credentialId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao obter token Pluggy');
    }
    return response.json();
  },

  // Alternativa: API direta (sem widget)
  getConnectors: async (credentialId) => {
    const url = `${API_BASE}/pluggy/connectors${credentialId ? `?credential_id=${credentialId}` : ''}`;
    console.log('[API] Buscando conectores em:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('[API] Status da resposta:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Erro na resposta:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { error: errorText || `Erro ${response.status}: ${response.statusText}` };
      }
      throw new Error(error.error || 'Erro ao listar conectores');
    }
    const data = await response.json();
    console.log('[API] Conectores recebidos:', Array.isArray(data) ? data.length : 'formato diferente');
    return data;
  },

  createItem: async (connectorId, parameters, credentialId) => {
    const response = await fetch(`${API_BASE}/pluggy/create-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectorId, parameters, credential_id: credentialId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar conexão');
    }
    return response.json();
  },

  getItem: async (itemId, credentialId) => {
    const response = await fetch(`${API_BASE}/pluggy/item/${itemId}?credential_id=${credentialId || ''}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar item');
    }
    return response.json();
  },

  executeMFA: async (itemId, mfa, credentialId) => {
    const response = await fetch(`${API_BASE}/pluggy/item/${itemId}/mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfa, credential_id: credentialId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao executar MFA');
    }
    return response.json();
  },

  syncPluggy: async (itemId, credentialId) => {
    console.log('[API] Sincronizando Pluggy');
    console.log('[API] itemId:', itemId);
    console.log('[API] credentialId:', credentialId);
    
    const response = await fetch(`${API_BASE}/pluggy/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, credential_id: credentialId }),
    });
    
    console.log('[API] Status da resposta:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Erro na resposta:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { error: errorText || `Erro ${response.status}` };
      }
      throw new Error(error.error || 'Erro ao sincronizar');
    }
    
    const data = await response.json();
    console.log('[API] Sincronização bem-sucedida:', data);
    return data;
  },

  // Transações
  updateCategory: async (transactionId, category) => {
    const response = await fetch(`${API_BASE}/transactions/${transactionId}/category`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar categoria');
    }
    return response.json();
  },

  deleteTransaction: async (transactionId) => {
    const response = await fetch(`${API_BASE}/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar transação');
    }
    return response.json();
  },

  deleteTransactionsBySource: async (source) => {
    const response = await fetch(`${API_BASE}/transactions/by-source/${source}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar transações');
    }
    return response.json();
  },

  // Listar items (conexões) existentes no Pluggy
  getPluggyItems: async (credentialId) => {
    const url = `${API_BASE}/pluggy/items${credentialId ? `?credential_id=${credentialId}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar conexões');
    }
    return response.json();
  },

  // Gerenciar Items Salvos (Contas Conectadas)
  getSavedPluggyItems: async () => {
    const response = await fetch(`${API_BASE}/pluggy-items`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar items salvos');
    }
    return response.json();
  },

  createSavedPluggyItem: async (item) => {
    const response = await fetch(`${API_BASE}/pluggy-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar item');
    }
    return response.json();
  },

  updateSavedPluggyItem: async (id, item) => {
    const response = await fetch(`${API_BASE}/pluggy-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar item');
    }
    return response.json();
  },

  deleteSavedPluggyItem: async (id) => {
    const response = await fetch(`${API_BASE}/pluggy-items/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar item');
    }
    return response.json();
  },

  clearAllTransactions: async () => {
    const response = await fetch(`${API_BASE}/transactions/clear-all`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao limpar transações');
    }
    return response.json();
  },

  // Buscar saldos reais das contas e faturas do período
  getRealBalances: async (period = null) => {
    const params = period ? `?period=${period}` : '';
    const response = await fetch(`${API_BASE}/pluggy/real-balances${params}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar saldos reais');
    }
    return response.json();
  },

  // Empréstimos
  getLoans: async () => {
    const response = await fetch(`${API_BASE}/loans`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar empréstimos');
    }
    return response.json();
  },

  createLoan: async (loan) => {
    const response = await fetch(`${API_BASE}/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loan),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar empréstimo');
    }
    return response.json();
  },

  updateLoan: async (id, loan) => {
    const response = await fetch(`${API_BASE}/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loan),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar empréstimo');
    }
    return response.json();
  },

  deleteLoan: async (id) => {
    const response = await fetch(`${API_BASE}/loans/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar empréstimo');
    }
    return response.json();
  },

  addLoanTransaction: async (loanId, transaction) => {
    const response = await fetch(`${API_BASE}/loans/${loanId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao adicionar transação');
    }
    return response.json();
  },

  deleteLoanTransaction: async (loanId, transactionId) => {
    const response = await fetch(`${API_BASE}/loans/${loanId}/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar transação');
    }
    return response.json();
  },

  // Metas
  getGoals: async (period = '') => {
    const response = await fetch(`${API_BASE}/goals${period}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar metas');
    }
    return response.json();
  },

  createGoal: async (goal) => {
    const response = await fetch(`${API_BASE}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar meta');
    }
    return response.json();
  },

  updateGoal: async (id, goal) => {
    const response = await fetch(`${API_BASE}/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar meta');
    }
    return response.json();
  },

  deleteGoal: async (id) => {
    const response = await fetch(`${API_BASE}/goals/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar meta');
    }
    return response.json();
  },

  // Corrigir transações com legumes de Refeição para Feira
  fixLegumesCategory: async () => {
    const response = await fetch(`${API_BASE}/transactions/fix-legumes`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao corrigir categorias de legumes');
    }
    return response.json();
  },

  // Corrigir transações relacionadas a mercado para Mercado
  fixMercadoCategory: async () => {
    const response = await fetch(`${API_BASE}/transactions/fix-mercado`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao corrigir categorias de mercado');
    }
    return response.json();
  },

  // Corrigir transações de Mercado Livre que foram incorretamente categorizadas como Mercado
  fixMercadoLivreCategory: async () => {
    const response = await fetch(`${API_BASE}/transactions/fix-mercado-livre`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao corrigir Mercado Livre');
    }
    return response.json();
  },
};

