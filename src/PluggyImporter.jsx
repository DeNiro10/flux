import { useState, useEffect } from 'react';
import { api } from './api';

/**
 * Componente para importar dados já conectados no Pluggy
 */
export function PluggyImporter({ credentialId, onSuccess, onError, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState(null);
  const [manualItemId, setManualItemId] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    loadItems();
  }, [credentialId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      console.log('[PluggyImporter] Carregando items do Pluggy...');
      const data = await api.getPluggyItems(credentialId);
      console.log('[PluggyImporter] Items recebidos:', data);
      
      // Filtrar apenas items atualizados (conexões ativas)
      const activeItems = Array.isArray(data) 
        ? data.filter(item => item.status === 'UPDATED' || item.status === 'updated')
        : [];
      
      console.log('[PluggyImporter] Items ativos:', activeItems.length);
      setItems(activeItems);
    } catch (error) {
      console.error('[PluggyImporter] Erro ao carregar items:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (itemId) => {
    try {
      setSyncing(true);
      setSyncingItemId(itemId);

      console.log('[PluggyImporter] Sincronizando item:', itemId);
      await api.syncPluggy(itemId, credentialId);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('[PluggyImporter] Erro ao sincronizar:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      setSyncing(false);
      setSyncingItemId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'UPDATED':
        return 'bg-green-100 text-green-800';
      case 'UPDATING':
        return 'bg-blue-100 text-blue-800';
      case 'LOGIN_ERROR':
        return 'bg-red-100 text-red-800';
      case 'WAITING_USER_INPUT':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'UPDATED':
        return 'Atualizada';
      case 'UPDATING':
        return 'Atualizando';
      case 'LOGIN_ERROR':
        return 'Erro no Login';
      case 'WAITING_USER_INPUT':
        return 'Aguardando';
      default:
        return status || 'Desconhecido';
    }
  };

  const handleManualSync = async () => {
    if (!manualItemId.trim()) {
      if (onError) {
        onError(new Error('Por favor, insira um Item ID válido'));
      }
      return;
    }

    try {
      setSyncing(true);
      setSyncingItemId(manualItemId.trim());
      console.log('[PluggyImporter] Sincronizando item manual:', manualItemId.trim());
      await api.syncPluggy(manualItemId.trim(), credentialId);
      
      if (onSuccess) {
        onSuccess();
      }
      setManualItemId('');
      setShowManualInput(false);
    } catch (error) {
      console.error('[PluggyImporter] Erro ao sincronizar item manual:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      setSyncing(false);
      setSyncingItemId(null);
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Importar do Pluggy</h3>
      <p className="text-sm text-gray-600 mb-4">
        Selecione uma conta já conectada no Pluggy para importar os dados automaticamente.
      </p>

      {/* Input manual para Item ID */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-blue-900">Sincronizar Item ID Manualmente</p>
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showManualInput ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {showManualInput && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={manualItemId}
              onChange={(e) => setManualItemId(e.target.value)}
              placeholder="Cole o Item ID aqui (ex: 934f0461-af14-40cb-80e0-c5ae75d86f18)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={syncing}
            />
            <button
              onClick={handleManualSync}
              disabled={syncing || !manualItemId.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing && syncingItemId === manualItemId.trim() ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Sincronizando...
                </>
              ) : (
                '🔄 Sincronizar'
              )}
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Carregando contas conectadas...</p>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <p className="font-medium mb-2">Nenhuma conta conectada encontrada</p>
          <p className="text-sm">
            Conecte uma conta primeiro usando o botão "Conectar Conta" no menu principal.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    {item.connector?.name || item.connectorName || 'Banco Desconhecido'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    ID: {item.id}
                  </p>
                  {item.lastUpdatedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Última atualização: {new Date(item.lastUpdatedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </span>
                  <button
                    onClick={() => handleSync(item.id)}
                    disabled={syncing && syncingItemId === item.id}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {syncing && syncingItemId === item.id ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⏳</span>
                        Sincronizando...
                      </>
                    ) : (
                      '🔄 Importar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

