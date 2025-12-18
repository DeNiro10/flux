import { useState, useEffect } from 'react';
import { api } from './api';

/**
 * Componente para gerenciar Item IDs do Pluggy
 * Permite adicionar, editar e sincronizar contas conectadas
 */
export function PluggyItemsManager({ onClose, onSyncSuccess }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingItemId, setSyncingItemId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [credentials, setCredentials] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    item_id: '',
    bank_name: '',
    owner_name: '',
    credential_id: null,
  });

  useEffect(() => {
    loadData();
    // Inicializar com os items padrão se não existirem
    initializeDefaultItems();
  }, []);

  const initializeDefaultItems = async () => {
    try {
      const existingItems = await api.getSavedPluggyItems();
      
      // Verificar se já existem items
      if (existingItems.length > 0) {
        return; // Já tem items, não precisa inicializar
      }

      // Items padrão
      const defaultItems = [
        {
          item_id: '934f0461-af14-40cb-80e0-c5ae75d86f18',
          bank_name: 'Nubank',
          owner_name: 'Robert Oliveira',
        },
        {
          item_id: '006744db-3cc7-4f05-8d4b-a175ad58bab7',
          bank_name: 'Itaú',
          owner_name: 'Robert Oliveira',
        },
      ];

      // Adicionar cada item
      for (const item of defaultItems) {
        try {
          await api.createSavedPluggyItem(item);
        } catch (error) {
          // Ignorar erros de duplicata
          if (!error.message.includes('já está cadastrado')) {
            console.error('Erro ao adicionar item padrão:', error);
          }
        }
      }

      // Recarregar dados
      await loadData();
    } catch (error) {
      console.error('Erro ao inicializar items padrão:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsData, credentialsData] = await Promise.all([
        api.getSavedPluggyItems(),
        api.getCredentials(),
      ]);
      setItems(itemsData);
      setCredentials(credentialsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.item_id.trim() || !formData.bank_name.trim() || !formData.owner_name.trim()) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      if (editingItem) {
        await api.updateSavedPluggyItem(editingItem.id, formData);
      } else {
        await api.createSavedPluggyItem(formData);
      }
      
      await loadData();
      setShowAddForm(false);
      setEditingItem(null);
      setFormData({
        item_id: '',
        bank_name: '',
        owner_name: '',
        credential_id: null,
      });
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      alert('Erro ao salvar: ' + error.message);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      item_id: item.item_id,
      bank_name: item.bank_name,
      owner_name: item.owner_name,
      credential_id: item.credential_id || null,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja remover este item?')) {
      return;
    }

    try {
      await api.deleteSavedPluggyItem(id);
      await loadData();
    } catch (error) {
      console.error('Erro ao deletar item:', error);
      alert('Erro ao deletar: ' + error.message);
    }
  };

  const handleSync = async (item) => {
    try {
      setSyncingItemId(item.id);
      await api.syncPluggy(item.item_id, item.credential_id);
      
      if (onSyncSuccess) {
        onSyncSuccess();
      }
      
      alert(`✅ Sincronização concluída para ${item.bank_name} - ${item.owner_name}`);
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      alert('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleSyncAll = async () => {
    if (items.length === 0) {
      alert('Nenhuma conta cadastrada para sincronizar');
      return;
    }

    if (!confirm(`Deseja sincronizar todas as ${items.length} conta(s)?`)) {
      return;
    }

    try {
      setSyncingItemId('all');
      let successCount = 0;
      let errorCount = 0;

      for (const item of items) {
        try {
          await api.syncPluggy(item.item_id, item.credential_id);
          successCount++;
        } catch (error) {
          console.error(`Erro ao sincronizar ${item.bank_name}:`, error);
          errorCount++;
        }
      }

      if (onSyncSuccess) {
        onSyncSuccess();
      }

      if (errorCount === 0) {
        alert(`✅ Todas as ${successCount} conta(s) sincronizadas com sucesso!`);
      } else {
        alert(`⚠️ ${successCount} conta(s) sincronizadas, ${errorCount} erro(s).`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar todas:', error);
      alert('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Gerenciar Contas Conectadas</h3>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={syncingItemId === 'all' || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncingItemId === 'all' ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Sincronizando Todas...
                </>
              ) : (
                '🔄 Sincronizar Todas'
              )}
            </button>
          )}
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingItem(null);
              setFormData({
                item_id: '',
                bank_name: '',
                owner_name: '',
                credential_id: null,
              });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAddForm ? 'Cancelar' : '+ Adicionar Conta'}
          </button>
        </div>
      </div>

      {/* Formulário de Adicionar/Editar */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-semibold mb-4">
            {editingItem ? 'Editar Conta' : 'Adicionar Nova Conta'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item ID do Pluggy *
              </label>
              <input
                type="text"
                value={formData.item_id}
                onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                placeholder="ex: 934f0461-af14-40cb-80e0-c5ae75d86f18"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!editingItem}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Banco *
                </label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="ex: Nubank, Itaú, Bradesco"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Proprietário *
                </label>
                <input
                  type="text"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder="ex: Robert Oliveira"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credencial Pluggy (opcional)
              </label>
              <select
                value={formData.credential_id || ''}
                onChange={(e) => setFormData({ ...formData, credential_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma credencial (opcional)</option>
                {credentials.map((cred) => (
                  <option key={cred.id} value={cred.id}>
                    {cred.name} {cred.is_active && '(Ativa)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingItem ? 'Salvar Alterações' : 'Adicionar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingItem(null);
                  setFormData({
                    item_id: '',
                    bank_name: '',
                    owner_name: '',
                    credential_id: null,
                  });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Items */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Carregando contas...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <p className="font-medium mb-2">Nenhuma conta cadastrada</p>
          <p className="text-sm">Clique em "Adicionar Conta" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{item.bank_name}</h4>
                    <span className="text-sm text-gray-500">-</span>
                    <span className="text-sm text-gray-700">{item.owner_name}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">
                    ID: {item.item_id}
                  </p>
                  {item.credential_name && (
                    <p className="text-xs text-gray-500 mt-1">
                      Credencial: {item.credential_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(item)}
                    disabled={syncingItemId === item.id || syncingItemId === 'all'}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {syncingItemId === item.id ? (
                      <>
                        <span className="inline-block animate-spin mr-1">⏳</span>
                        Sincronizando...
                      </>
                    ) : (
                      '🔄 Sincronizar'
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

