import { useState, useEffect } from 'react';
import { api } from './api';

export function CredentialsManager({ onClose, onCredentialSelected }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    client_id: '',
    client_secret: '',
    is_active: false,
  });

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const data = await api.getCredentials();
      setCredentials(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      if (editing) {
        await api.updateCredential(editing.id, formData);
      } else {
        await api.createCredential(formData);
      }
      await loadCredentials();
      setShowForm(false);
      setEditing(null);
      setFormData({ name: '', client_id: '', client_secret: '', is_active: false });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja deletar esta credencial?')) return;
    try {
      await api.deleteCredential(id);
      await loadCredentials();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (credential) => {
    setEditing(credential);
    setFormData({
      name: credential.name,
      client_id: credential.client_id,
      client_secret: credential.client_secret,
      is_active: credential.is_active,
    });
    setShowForm(true);
  };

  const handleSelect = (credential) => {
    if (onCredentialSelected) {
      onCredentialSelected(credential);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Gerenciar Credenciais Pluggy</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Configure suas credenciais da Pluggy. Você pode ter múltiplas credenciais e escolher qual usar ao conectar uma conta.
            </p>
            <button
              onClick={() => {
                setShowForm(true);
                setEditing(null);
                setFormData({ name: '', client_id: '', client_secret: '', is_active: false });
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              + Nova Credencial
            </button>
          </div>

          {showForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">
                {editing ? 'Editar Credencial' : 'Nova Credencial'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome (ex: "Conta Pessoal", "Conta Empresa")
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={formData.client_secret}
                    onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Usar como credencial padrão (ativa)
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editing ? 'Atualizar' : 'Criar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditing(null);
                      setFormData({ name: '', client_id: '', client_secret: '', is_active: false });
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Carregando credenciais...</p>
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhuma credencial configurada.</p>
              <p className="text-sm mt-2">Clique em "Nova Credencial" para adicionar uma.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((credential) => (
                <div
                  key={credential.id}
                  className={`p-4 border rounded-lg ${
                    credential.is_active
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{credential.name}</h3>
                        {credential.is_active && (
                          <span className="px-2 py-1 text-xs bg-primary-600 text-white rounded">
                            Ativa
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Client ID: {credential.client_id.substring(0, 20)}...
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {onCredentialSelected && (
                        <button
                          onClick={() => handleSelect(credential)}
                          className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          Usar
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(credential)}
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(credential.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Deletar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

