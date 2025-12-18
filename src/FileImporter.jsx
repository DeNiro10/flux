import { useState, useRef } from 'react';
import { api } from './api';

/**
 * Componente para importar transações de arquivos CSV/OFX
 * Alternativa simples que não depende de APIs externas
 */
export function FileImporter({ onSuccess, onError, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Fazer preview do arquivo
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setPreview({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        firstLines: content.split('\n').slice(0, 5).join('\n'),
      });
    };
    reader.readAsText(selectedFile);
  };

  const parseCSV = (content) => {
    const lines = content.split('\n').filter(line => line.trim());
    const transactions = [];

    // Tentar detectar o formato do CSV
    // Formato comum: Data,Descrição,Valor
    // Ou: Data;Descrição;Valor
    const delimiter = content.includes(';') ? ';' : ',';
    
    // Pular cabeçalho se existir
    const startLine = lines[0].toLowerCase().includes('data') ? 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
      
      if (parts.length < 3) continue;

      // Tentar diferentes formatos de data
      let date = null;
      const dateStr = parts[0];
      
      // Formato DD/MM/YYYY ou DD-MM-YYYY
      if (dateStr.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
        const [day, month, year] = dateStr.split(/[\/\-]/);
        date = `${year}-${month}-${day}`;
      }
      // Formato YYYY-MM-DD
      else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = dateStr;
      }
      // Formato DD/MM/YY
      else if (dateStr.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{2}$/)) {
        const [day, month, year] = dateStr.split(/[\/\-]/);
        date = `20${year}-${month}-${day}`;
      }

      if (!date) continue;

      // Descrição (geralmente segunda coluna)
      const description = parts[1] || parts[2] || 'Sem descrição';

      // Valor (geralmente última coluna ou terceira)
      let amount = 0;
      const valueStr = parts[parts.length - 1] || parts[2];
      
      // Remover formatação de moeda
      const cleanValue = valueStr
        .replace(/R\$\s?/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim();

      amount = parseFloat(cleanValue) || 0;

      // Se o valor for positivo mas deveria ser negativo (débito)
      // Isso depende do formato do banco
      if (amount > 0 && description.toLowerCase().includes('débito')) {
        amount = -Math.abs(amount);
      }

      transactions.push({
        date,
        description,
        amount,
        source: 'csv_import',
        type: amount < 0 ? 'DEBIT' : 'CREDIT',
      });
    }

    return transactions;
  };

  const handleImport = async () => {
    if (!file) {
      alert('Selecione um arquivo primeiro');
      return;
    }

    try {
      setLoading(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;
        let transactions = [];

        if (file.name.toLowerCase().endsWith('.csv')) {
          transactions = parseCSV(content);
        } else if (file.name.toLowerCase().endsWith('.ofx')) {
          // OFX é mais complexo, vamos fazer parsing básico
          alert('Importação OFX ainda não implementada. Use CSV por enquanto.');
          setLoading(false);
          return;
        } else {
          alert('Formato não suportado. Use CSV (.csv)');
          setLoading(false);
          return;
        }

        if (transactions.length === 0) {
          alert('Nenhuma transação encontrada no arquivo. Verifique o formato.');
          setLoading(false);
          return;
        }

        // Enviar para o servidor
        const response = await fetch('http://localhost:3000/api/transactions/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao importar transações');
        }

        const result = await response.json();
        alert(`✅ ${result.count} transações importadas com sucesso!`);
        
        if (onSuccess) {
          onSuccess();
        }
        
        setLoading(false);
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Erro ao importar:', error);
      if (onError) {
        onError(error);
      } else {
        alert('Erro ao importar: ' + error.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Importar Transações</h3>
      <p className="text-sm text-gray-600 mb-4">
        Importe suas transações de um arquivo CSV. O formato esperado é:
        <br />
        <code className="text-xs bg-gray-100 p-1 rounded">Data,Descrição,Valor</code>
        <br />
        <span className="text-xs text-gray-500">
          Exemplo: 01/01/2024,Compra no mercado,-150.50
        </span>
      </p>

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.ofx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          {file ? `Arquivo: ${file.name}` : 'Selecionar Arquivo CSV'}
        </button>
      </div>

      {preview && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium mb-2">Preview:</p>
          <pre className="text-xs overflow-auto max-h-32 bg-white p-2 rounded border">
            {preview.firstLines}
          </pre>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Importando...' : 'Importar'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Cancelar
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Dica:</strong> A maioria dos bancos permite exportar extratos em CSV.
          Procure a opção "Exportar" ou "Download" no seu internet banking.
        </p>
      </div>
    </div>
  );
}

