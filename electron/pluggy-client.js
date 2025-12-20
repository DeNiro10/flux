// Cliente Pluggy - Implementação usando fetch para API REST
// Documentação: https://docs.pluggy.ai/

import { Buffer } from 'buffer';

const PLUGGY_API_BASE = 'https://api.pluggy.ai';

export class PluggyClient {
  constructor({ clientId, clientSecret }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiKey = null;
    this.apiKeyExpiry = null; // Timestamp de expiração do token
  }

  async getApiKey() {
    // Verificar se a API key ainda é válida (tokens Pluggy expiram em 2 horas)
    if (this.apiKey && this.apiKeyExpiry && Date.now() < this.apiKeyExpiry) {
      console.log('[PLUGGY] Usando API key em cache');
      return this.apiKey;
    }
    
    // Se expirou ou não existe, limpar e obter nova
    if (this.apiKeyExpiry && Date.now() >= this.apiKeyExpiry) {
      console.log('[PLUGGY] API key expirada, obtendo nova...');
      this.apiKey = null;
    }

    // Validar que clientId e clientSecret são strings
    if (typeof this.clientId !== 'string' || typeof this.clientSecret !== 'string') {
      throw new Error(`Credenciais inválidas: clientId e clientSecret devem ser strings. Recebido: clientId=${typeof this.clientId}, clientSecret=${typeof this.clientSecret}`);
    }

    // Garantir que são strings limpas
    const clientId = String(this.clientId).trim();
    const clientSecret = String(this.clientSecret).trim();

    console.log('[PLUGGY] Autenticando com:', {
      clientIdLength: clientId.length,
      clientSecretLength: clientSecret.length,
      clientIdStart: clientId.substring(0, 8),
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
    });

    // Autenticação na API Pluggy
    // A API Pluggy usa Basic Auth com clientId:clientSecret
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    console.log('[PLUGGY] Tentando autenticação Basic Auth...');
    let response = await fetch(`${PLUGGY_API_BASE}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
    });

    console.log('[PLUGGY] Status da resposta:', response.status, response.statusText);
    
    // Se falhar, tentar diferentes formatos
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[PLUGGY] Erro da primeira tentativa:', errorText);
      
      // Tentar sem Content-Type
      console.log('[PLUGGY] Tentando sem Content-Type...');
      response = await fetch(`${PLUGGY_API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });
      
      console.log('[PLUGGY] Status da segunda tentativa:', response.status);
      
      // Se ainda falhar, tentar com credenciais no body
      if (!response.ok) {
        console.log('[PLUGGY] Tentando com credenciais no body...');
        response = await fetch(`${PLUGGY_API_BASE}/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: clientId,
            clientSecret: clientSecret,
          }),
        });
        
        console.log('[PLUGGY] Status da terceira tentativa:', response.status);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PLUGGY] Erro na autenticação:', errorText);
      let errorMessage = `Erro ao obter API key: ${errorText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = `Erro Pluggy: ${errorJson.message}`;
        }
      } catch (e) {
        // Manter mensagem original
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('[PLUGGY] Resposta da autenticação:', Object.keys(data));
    console.log('[PLUGGY] Dados completos da resposta:', JSON.stringify(data, null, 2));
    
    // A API Pluggy retorna 'apiKey' (não 'accessToken')
    // Verificar todos os campos possíveis
    this.apiKey = data.apiKey || data.accessToken || data.token || data.access_token;
    
    // Se não encontrar, verificar se está em outro formato
    if (!this.apiKey && data.data && typeof data.data === 'string') {
      this.apiKey = data.data;
    }
    
    // Se ainda não encontrar, verificar se a resposta inteira é a API key
    if (!this.apiKey && typeof data === 'string') {
      this.apiKey = data;
    }
    
    if (!this.apiKey) {
      console.error('[PLUGGY] API Key não encontrada na resposta:', data);
      console.error('[PLUGGY] Chaves disponíveis:', Object.keys(data));
      throw new Error('API Key não retornada pela autenticação Pluggy. Resposta: ' + JSON.stringify(data));
    }
    
    // Verificar se a API key é uma string válida
    if (typeof this.apiKey !== 'string' || this.apiKey.trim().length === 0) {
      console.error('[PLUGGY] API Key inválida:', this.apiKey);
      throw new Error('API Key retornada não é uma string válida');
    }
    
    // Limpar a API key (remover espaços, quebras de linha, etc)
    this.apiKey = this.apiKey.trim();
    
    // Tokens Pluggy expiram em 2 horas (7200 segundos)
    // Vamos definir expiração em 1h50min para garantir que não expire durante o uso
    this.apiKeyExpiry = Date.now() + (110 * 60 * 1000); // 110 minutos
    
    console.log('[PLUGGY] API Key obtida com sucesso');
    console.log('[PLUGGY] API Key length:', this.apiKey.length);
    console.log('[PLUGGY] API Key (primeiros 50 chars):', this.apiKey.substring(0, 50) + '...');
    console.log('[PLUGGY] API Key (últimos 20 chars):', '...' + this.apiKey.substring(this.apiKey.length - 20));
    console.log('[PLUGGY] API Key expira em:', new Date(this.apiKeyExpiry).toLocaleString('pt-BR'));
    return this.apiKey;
  }

  async request(endpoint, options = {}) {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error('API Key não obtida. Verifique as credenciais Pluggy.');
    }
    
    console.log('[PluggyClient] ============================================');
    console.log('[PluggyClient] Fazendo requisição para:', endpoint);
    console.log('[PluggyClient] API Key length:', apiKey.length);
    console.log('[PluggyClient] API Key (primeiros 30 chars):', apiKey.substring(0, 30) + '...');
    console.log('[PluggyClient] API Key (últimos 20 chars):', '...' + apiKey.substring(apiKey.length - 20));
    
    // A API Pluggy pode usar X-API-KEY ou Authorization Bearer
    // Vamos tentar X-API-KEY primeiro (mais comum)
    console.log('[PluggyClient] Tentando com header X-API-KEY...');
    let response = await fetch(`${PLUGGY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey.trim(), // Garantir que não há espaços
        ...options.headers,
      },
    });
    
    console.log('[PluggyClient] Status com X-API-KEY:', response.status, response.statusText);
    
    let errorText = null;
    
    // Se der 403 ou 401, tentar com Authorization Bearer
    if (response.status === 403 || response.status === 401) {
      // Clonar a resposta para poder ler o erro depois
      const responseClone = response.clone();
      errorText = await responseClone.text();
      console.log('[PluggyClient] Erro com X-API-KEY:', errorText);
      console.log('[PluggyClient] Tentando com Authorization Bearer...');
      
      response = await fetch(`${PLUGGY_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          ...options.headers,
        },
      });
      
      console.log('[PluggyClient] Status com Bearer:', response.status, response.statusText);
    }
    
    console.log('[PluggyClient] ============================================');

    // Se a resposta não foi OK, ler o erro apenas uma vez
    if (!response.ok) {
      if (!errorText) {
        errorText = await response.text();
      }
      console.error('[PluggyClient] ============================================');
      console.error('[PluggyClient] Erro na resposta:', response.status, response.statusText);
      console.error('[PluggyClient] Erro completo:', errorText);
      console.error('[PluggyClient] ============================================');
      
      let errorMessage = `Erro na requisição (${response.status}): ${errorText}`;
      
      // Se for 401 ou 403, tentar reautenticar e usar formato correto
      if (response.status === 401 || response.status === 403) {
        console.log(`[PluggyClient] ${response.status} - Limpando API key e tentando reautenticar...`);
        this.apiKey = null;
        this.apiKeyExpiry = null;
        const newApiKey = await this.getApiKey();
        
        // Tentar novamente com X-API-KEY primeiro
        let retryResponse = await fetch(`${PLUGGY_API_BASE}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': newApiKey,
            ...options.headers,
          },
        });
        
        // Se ainda der 403, tentar Bearer
        if (retryResponse.status === 403) {
          console.log('[PluggyClient] Ainda 403, tentando Authorization Bearer...');
          retryResponse = await fetch(`${PLUGGY_API_BASE}${endpoint}`, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newApiKey}`,
              ...options.headers,
            },
          });
        }
        
        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          try {
            const retryErrorJson = JSON.parse(retryErrorText);
            errorMessage = retryErrorJson.message || retryErrorJson.error || `Erro ${retryResponse.status}: ${retryErrorText}`;
          } catch (e) {
            errorMessage = `Erro ${retryResponse.status}: ${retryErrorText}`;
          }
          throw new Error(errorMessage);
        }
        
        return retryResponse.json();
      }
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch (e) {
        // Mantém a mensagem original se não for JSON
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async createConnectToken() {
    const response = await this.request('/connect_token', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    
    console.log('[PluggyClient] Resposta createConnectToken:', response);
    
    // A resposta pode ter diferentes formatos
    const token = response.accessToken || response.token || response.connectToken || response;
    
    console.log('[PluggyClient] Token extraído:', token ? token.substring(0, 30) + '...' : 'NENHUM TOKEN');
    
    return {
      accessToken: token,
    };
  }

  async fetchAccounts(itemId) {
    const response = await this.request(`/accounts?itemId=${itemId}`);
    // A API pode retornar { results: [...] } ou array direto
    return response.results || response.data || response;
  }

  async fetchSecurities(itemId) {
    try {
      console.log(`[PluggyClient] Buscando securities para itemId: ${itemId}`);
      const response = await this.request(`/securities?itemId=${itemId}`);
      console.log(`[PluggyClient] Resposta de securities:`, JSON.stringify(response, null, 2));
      // A API pode retornar { results: [...] } ou array direto
      const securities = response.results || response.data || response || [];
      console.log(`[PluggyClient] Total de securities encontradas: ${Array.isArray(securities) ? securities.length : 0}`);
      return securities;
    } catch (error) {
      console.error('[PluggyClient] Erro ao buscar securities:', error.message);
      console.error('[PluggyClient] Stack:', error.stack);
      // Se o endpoint não existir (404), retornar array vazio
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.log('[PluggyClient] Endpoint /securities não encontrado (pode não estar disponível)');
      }
      return [];
    }
  }

  async fetchTransactions(accountId, options = {}) {
    let allTransactions = [];
    let page = 1;
    let hasMore = true;
    const pageSize = options.pageSize || 500; // Tamanho máximo de página da API Pluggy
    
    console.log(`[PluggyClient] Iniciando busca de transações para accountId: ${accountId}`);
    console.log(`[PluggyClient] Tamanho da página: ${pageSize}`);
    console.log(`[PluggyClient] Buscando TODAS as transações (sem filtro de data)`);
    
    while (hasMore) {
      const params = new URLSearchParams({
        accountId,
        page: String(page),
        pageSize: String(pageSize),
        ...Object.fromEntries(
          Object.entries(options)
            .filter(([key]) => key !== 'pageSize' && key !== 'fromDate') // Remover pageSize e fromDate das opções
            .map(([key, value]) => [key, String(value)])
        ),
      });
      
      console.log(`[PluggyClient] Buscando página ${page}...`);
      const response = await this.request(`/transactions?${params.toString()}`);
      
      // A API Pluggy retorna { results: [...], page: X, totalPages: Y, total: Z }
      let transactions = [];
      let currentPage = page;
      let totalPages = 1;
      let total = 0;
      
      if (Array.isArray(response)) {
        // Se for array direto (raro, mas possível)
        transactions = response;
        hasMore = transactions.length === pageSize;
      } else if (response && typeof response === 'object') {
        // Se for objeto com results
        transactions = response.results || response.data || [];
        currentPage = response.page || page;
        totalPages = response.totalPages || 1;
        total = response.total || 0;
        
        console.log(`[PluggyClient] Página ${currentPage}/${totalPages} (total: ${total}): ${transactions.length} transações`);
        
        // Verificar se há mais páginas
        // IMPORTANTE: Verificar tanto pelo número de páginas quanto pelo total de resultados
        if (totalPages > 1) {
          hasMore = currentPage < totalPages;
        } else if (total > 0) {
          // Se temos o total, verificar se já buscamos todas
          hasMore = allTransactions.length < total;
        } else {
          // Se não temos informações de paginação, continuar enquanto houver transações
          hasMore = transactions.length === pageSize;
        }
        
        // Se temos o total e já buscamos todas, parar
        if (total > 0 && allTransactions.length + transactions.length >= total) {
          console.log(`[PluggyClient] Todas as transações serão buscadas nesta página (${allTransactions.length + transactions.length}/${total})`);
        }
      } else {
        hasMore = false;
      }
      
      if (transactions.length > 0) {
        allTransactions = allTransactions.concat(transactions);
        console.log(`[PluggyClient] Total acumulado: ${allTransactions.length} transações`);
        
        // Log da primeira e última transação para debug
        if (page === 1 && transactions.length > 0) {
          const first = transactions[0];
          const last = transactions[transactions.length - 1];
          console.log(`[PluggyClient] Primeira transação: ${first.date} - ${first.description} - ${first.amount}`);
          console.log(`[PluggyClient] Última transação da página: ${last.date} - ${last.description} - ${last.amount}`);
        }
      }
      
      page++;
      
      // Limite de segurança para evitar loop infinito
      if (page > 100) {
        console.warn('[PluggyClient] Limite de páginas atingido (100)');
        break;
      }
      
      // Se não há mais transações, parar
      if (transactions.length === 0) {
        hasMore = false;
      }
    }
    
    console.log(`[PluggyClient] ✅ Total de transações buscadas: ${allTransactions.length} (${page - 1} páginas)`);
    
    // Ordenar por data DESC (mais recentes primeiro) para garantir ordem correta
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA; // DESC
    });
    
    return allTransactions;
  }

  // Buscar faturas de cartão de crédito
  async fetchBills(accountId) {
    console.log('[PluggyClient] Buscando faturas para account:', accountId);
    const response = await this.request(`/bills?accountId=${accountId}`);
    return response.results || response.data || response;
  }

  // Criar item (conexão) diretamente via API sem widget
  // Isso permite criar conexões programaticamente
  async createItem(connectorId, parameters = {}) {
    const response = await this.request('/items', {
      method: 'POST',
      body: JSON.stringify({
        connectorId,
        parameters,
      }),
    });
    
    console.log('[PluggyClient] Item criado:', response);
    return response;
  }

  // Buscar item por ID
  async getItem(itemId) {
    const response = await this.request(`/items/${itemId}`);
    return response;
  }

  // Listar conectores disponíveis
  async getConnectors() {
    console.log('[PluggyClient] Buscando conectores...');
    const response = await this.request('/connectors');
    console.log('[PluggyClient] Resposta getConnectors:', {
      type: typeof response,
      isArray: Array.isArray(response),
      hasResults: !!response?.results,
      hasData: !!response?.data,
      keys: response && typeof response === 'object' ? Object.keys(response) : 'N/A'
    });
    
    // A API pode retornar { results: [...] } ou array direto
    if (Array.isArray(response)) {
      return response;
    } else if (response?.results && Array.isArray(response.results)) {
      return response.results;
    } else if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    // Se não for nenhum formato conhecido, retornar como está
    return response;
  }

  // Executar MFA (Multi-Factor Authentication) se necessário
  async executeMFA(itemId, mfa) {
    const response = await this.request(`/items/${itemId}/mfa`, {
      method: 'POST',
      body: JSON.stringify({ mfa }),
    });
    return response;
  }

  // Atualizar item (para quando precisa de credenciais adicionais)
  async updateItem(itemId, parameters) {
    const response = await this.request(`/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ parameters }),
    });
    return response;
  }

  // Listar todos os items (conexões) existentes
  async listItems() {
    const response = await this.request('/items');
    return response.results || response.data || response;
  }
}

