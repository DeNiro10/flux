import { useState, useEffect } from 'react';
import { api } from './api';

/**
 * Componente para criar conexões diretamente via API (sem widget)
 * Útil quando o widget Pluggy Connect não funciona
 */
export function DirectConnection({ credentialId, onSuccess, onError, onClose }) {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnector, setSelectedConnector] = useState(null);
  const [parameters, setParameters] = useState({});
  const [creating, setCreating] = useState(false);
  const [itemStatus, setItemStatus] = useState(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    loadConnectors();
  }, [credentialId]);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      console.log('[DirectConnection] Carregando conectores...');
      const data = await api.getConnectors(credentialId);
      console.log('[DirectConnection] Dados recebidos:', data);
      
      // A API pode retornar diferentes formatos
      let connectorsList = [];
      
      if (Array.isArray(data)) {
        connectorsList = data;
      } else if (data?.results && Array.isArray(data.results)) {
        connectorsList = data.results;
      } else if (data?.data && Array.isArray(data.data)) {
        connectorsList = data.data;
      }
      
      // Filtrar apenas conectores ativos (remover filtro de país por enquanto)
      const activeConnectors = connectorsList.filter(c => 
        c.status === 'ACTIVE' || c.status === 'active' || !c.status
      );
      
      console.log('[DirectConnection] Conectores ativos:', activeConnectors.length);
      setConnectors(activeConnectors);
    } catch (error) {
      console.error('[DirectConnection] Erro ao carregar conectores:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!selectedConnector) {
      alert('Selecione um banco primeiro');
      return;
    }

    try {
      setCreating(true);

      const item = await api.createItem(
        selectedConnector.id,
        parameters,
        credentialId
      );

      console.log('Item criado:', item);
      setItemStatus(item);

      // Verificar se precisa de MFA
      if (item.status === 'MFA_REQUIRED' || item.mfa) {
        setMfaRequired(true);
      } else if (item.status === 'UPDATED' || item.status === 'LOGIN_ERROR') {
        // Aguardar um pouco e verificar novamente
        setTimeout(() => checkItemStatus(item.id), 2000);
      } else if (item.status === 'UPDATED') {
        // Sucesso! Sincronizar
        if (onSuccess) {
          onSuccess(item.id);
        }
      }
    } catch (error) {
      console.error('Erro ao criar item:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      setCreating(false);
    }
  };

  const checkItemStatus = async (itemId) => {
    try {
      const item = await api.getItem(itemId, credentialId);
      setItemStatus(item);

      if (item.status === 'UPDATED') {
        // Sucesso! Sincronizar
        if (onSuccess) {
          onSuccess(itemId);
        }
      } else if (item.status === 'MFA_REQUIRED' || item.mfa) {
        setMfaRequired(true);
      } else if (item.status === 'LOGIN_ERROR') {
        alert('Erro no login. Verifique as credenciais.');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const handleMFA = async () => {
    if (!mfaCode || !itemStatus?.id) {
      alert('Digite o código MFA');
      return;
    }

    try {
      setCreating(true);
      const result = await api.executeMFA(itemStatus.id, mfaCode, credentialId);
      
      if (result.status === 'UPDATED') {
        // Sucesso!
        if (onSuccess) {
          onSuccess(itemStatus.id);
        }
      } else {
        // Continuar verificando
        setTimeout(() => checkItemStatus(itemStatus.id), 2000);
      }
    } catch (error) {
      console.error('Erro ao executar MFA:', error);
      alert('Erro ao validar código MFA: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const connector = connectors.find(c => c.id === selectedConnector);

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Conectar via API Direta</h3>
      <p className="text-sm text-gray-600 mb-4">
        Esta opção permite conectar bancos diretamente via API, sem usar o widget Pluggy Connect.
        Você precisará fornecer suas credenciais bancárias.
      </p>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Carregando bancos disponíveis...</p>
        </div>
      )}

      {!loading && connectors.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <p>Nenhum banco disponível no momento.</p>
        </div>
      )}

      {!loading && connectors.length > 0 && !itemStatus && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o Banco
            </label>
            <select
              value={selectedConnector || ''}
              onChange={(e) => setSelectedConnector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">-- Selecione um banco --</option>
              {connectors.map((connector) => (
                <option key={connector.id} value={connector.id}>
                  {connector.name} {connector.country === 'BR' ? '🇧🇷' : ''}
                </option>
              ))}
            </select>
          </div>

          {connector && connector.parameters && connector.parameters.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credenciais
              </label>
              {connector.parameters.map((param) => (
                <div key={param.name} className="mb-2">
                  <input
                    type={param.type === 'password' ? 'password' : 'text'}
                    placeholder={param.label || param.name}
                    value={parameters[param.name] || ''}
                    onChange={(e) =>
                      setParameters({ ...parameters, [param.name]: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={handleCreateItem}
              disabled={!selectedConnector || creating}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Conectando...' : 'Conectar'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {mfaRequired && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Autenticação em Duas Etapas</h4>
          <p className="text-sm text-blue-800 mb-3">
            Digite o código enviado para você:
          </p>
          <input
            type="text"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder="Código MFA"
            className="w-full px-3 py-2 border border-blue-300 rounded-lg mb-3"
          />
          <div className="flex space-x-2">
            <button
              onClick={handleMFA}
              disabled={!mfaCode || creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Validar
            </button>
            <button
              onClick={() => {
                setMfaRequired(false);
                setItemStatus(null);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {itemStatus && itemStatus.status === 'UPDATED' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <p>✅ Conexão estabelecida com sucesso!</p>
        </div>
      )}
    </div>
  );
}

