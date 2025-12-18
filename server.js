import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PluggyClient } from './electron/pluggy-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Função para obter o caminho do banco
function getDbPath() {
  const userDataPath = process.env.USER_DATA_PATH || path.join(process.cwd(), 'data');
  
  // Criar diretório se não existir
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  return path.join(userDataPath, 'financas.db');
}

let db;

function getDB() {
  if (!db) {
    try {
      const dbPath = getDbPath();
      console.log('[DB] Tentando abrir banco em:', dbPath);
      
      // Criar diretório se não existir
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('[DB] Diretório criado:', dir);
      }
      
      db = new Database(dbPath);
      console.log('[DB] Banco aberto com sucesso');
    
      // Criar todas as tabelas necessárias
      db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Outros',
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        account_id TEXT,
        account_type TEXT DEFAULT 'BANK',
        bank_name TEXT,
        owner_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rules (
        keyword TEXT PRIMARY KEY,
        category TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pluggy_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pluggy_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT UNIQUE NOT NULL,
        bank_name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        credential_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (credential_id) REFERENCES pluggy_credentials(id)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
      CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_id);
      CREATE INDEX IF NOT EXISTS idx_pluggy_items_item_id ON pluggy_items(item_id);
    `);
    } catch (dbError) {
      console.error('[DB] Erro ao criar banco:', dbError);
      throw dbError;
    }

    // Inserir regras padrão
    const insertRule = db.prepare('INSERT OR IGNORE INTO rules (keyword, category) VALUES (?, ?)');
    const defaultRules = [
      ['Uber', 'Transporte'],
      ['99', 'Transporte'],
      ['iFood', 'Alimentação'],
      ['Rappi', 'Alimentação'],
      ['Amazon', 'Compras'],
      ['Mercado', 'Alimentação'],
      ['Supermercado', 'Alimentação'],
      ['Posto', 'Transporte'],
      ['Combustível', 'Transporte'],
      ['Netflix', 'Entretenimento'],
      ['Spotify', 'Entretenimento'],
      ['Salário', 'Renda'],
      ['Pagamento', 'Renda'],
    ];

    for (const [keyword, category] of defaultRules) {
      insertRule.run(keyword, category);
    }
    console.log('[DB] Regras padrão inseridas');
  }
  return db;
}

// Regras de categorização inteligentes
const CATEGORY_RULES = {
  // RENDA - apenas para ENTRADAS (amount > 0)
  renda: {
    keywords: ['salário', 'salario', 'tef credito salario', 'prolabore', 'pro labore', 'freelance', 'comissão', 'comissao', 'dividendos', 'rendimento', 'rend pago', 'cashback', 'restituição', 'restituicao'],
    onlyPositive: true
  },
  
  // ALIMENTAÇÃO
  alimentacao: {
    keywords: ['ifood', 'ifd*', 'food', 'rappi', 'zé delivery', 'ze delivery', 'uber eats', 'burguer', 'burger', 'pizza', 'restaurante', 'lanchonete', 'padaria', 'açougue', 'acougue', 'mercado', 'supermercado', 'atacadão', 'atacadao', 'carrefour', 'pão de açúcar', 'pao de acucar', 'assaí', 'assai', 'hortifruti', 'legumes', 'frutas', 'verduras', 'esfiha', 'doces', 'caldo de cana', 'arcos dourados', 'mcdonald', 'subway', 'habib', 'china in box', 'sushi', 'yakisoba', 'açaí', 'acai', 'sorvete', 'cafeteria', 'café', 'cafe', 'starbucks', 'cacau show', 'chocolate', 'coxinha', 'gelato', 'sorveteria', 'confeitaria', 'doceria', 'lancheria', 'lanches', 'pastel', 'empada', 'pao de queijo']
  },
  
  // TRANSPORTE
  transporte: {
    keywords: ['uber', '99', '99app', 'cabify', 'taxi', 'táxi', 'combustível', 'combustivel', 'gasolina', 'etanol', 'diesel', 'posto', 'shell', 'ipiranga', 'br distribuidora', 'petrobras', 'estacionamento', 'parking', 'pedágio', 'pedagio', 'sem parar', 'veloe', 'conectcar', 'carro', 'oficina', 'mecânico', 'mecanico', 'pneu', 'autopeças', 'autopecas', 'lavagem', 'lava jato', 'detran', 'dpvat', 'ipva', 'multa trânsito', 'bilhete único', 'metro', 'ônibus', 'onibus', 'transporte']
  },
  
  // MORADIA
  moradia: {
    keywords: ['aluguel', 'condomínio', 'condominio', 'iptu', 'água', 'agua', 'sabesp', 'copasa', 'esgoto', 'luz', 'energia', 'enel', 'cemig', 'cpfl', 'celpe', 'coelba', 'gás', 'gas', 'comgás', 'comgas', 'internet', 'vivo', 'claro', 'tim', 'oi', 'net', 'sky', 'imobiliária', 'imobiliaria', 'seguro residencial', 'mobiliada', 'reforma', 'manutenção casa', 'manutencao casa', 'k2 network', 'k2network']
  },
  
  // FEIRA (compras de domingo / feirantes)
  feira: {
    keywords: ['legumes', 'feira', 'feirante', 'hortifrutigranjeiro', 'horta', 'orgânico', 'organico', 'verdura', 'fruta', 'produtor', 'agricultor']
  },
  
  // SAÚDE
  saude: {
    keywords: ['farmácia', 'farmacia', 'drogaria', 'raia', 'droga raia', 'drogasil', 'pague menos', 'ultrafarma', 'panvel', 'hospital', 'clínica', 'clinica', 'médico', 'medico', 'dentista', 'odonto', 'consulta', 'exame', 'laboratório', 'laboratorio', 'plano de saúde', 'plano de saude', 'unimed', 'amil', 'bradesco saúde', 'sulamérica', 'sulamerica', 'hapvida', 'notredame', 'psicólogo', 'psicologo', 'terapia', 'fisioterapia', 'nu seguro vida', 'seguro vida', 'rdsaude', 'rd saude', 'academia', 'smartfit', 'smart fit', 'gympass', 'totalpass']
  },
  
  // COMPRAS
  compras: {
    keywords: ['amazon', 'mercado livre', 'melimais', 'mp *melimais', 'magalu', 'magazine luiza', 'americanas', 'submarino', 'shopee', 'aliexpress', 'shein', 'casas bahia', 'ponto frio', 'kalunga', 'saraiva', 'livraria', 'papelaria', 'shopping', 'loja', 'natura', 'boticário', 'boticario', 'avon', 'mary kay', 'apple.com/bill', 'apple store', 'renner', 'riachuelo', 'c&a', 'marisa', 'hering', 'zara', 'forever 21', 'netshoes', 'centauro', 'decathlon', 'daiso', 'china', 'bazar', 'utilidades', 'eletro', 'móveis', 'moveis']
  },
  
  // FATURA - pagamentos de fatura de cartão (DEVE VIR ANTES de entretenimento por causa de "pagamento" conter "game")
  fatura: {
    keywords: ['pagamento recebido', 'pagamento de fatura', 'pagto fatura', 'pag fatura', 'int unclass vs', 'int uniclass vs']
  },
  
  // EMPRÉSTIMO
  emprestimo: {
    keywords: ['emprestimo consignado', 'empréstimo consignado', 'emprestimo', 'empréstimo', 'consignado', 'financiamento', 'parcela emprestimo', 'parcela empréstimo']
  },
  
  // ENTRETENIMENTO
  entretenimento: {
    keywords: ['netflix', 'spotify', 'youtube', 'youtube premium', 'amazon prime', 'disney', 'hbo', 'globoplay', 'paramount', 'apple tv', 'twitch', 'steam', 'playstation', 'xbox', 'nintendo', 'cinema', 'teatro', 'show', 'ingresso', 'evento', 'parque', 'museu', 'jogos', 'game', 'bar', 'balada', 'boate', 'festa', 'cerveja', 'bebida']
  },
  
  // EDUCAÇÃO
  educacao: {
    keywords: ['escola', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'coursera', 'duolingo', 'livro', 'apostila', 'material escolar', 'mensalidade', 'matrícula', 'matricula', 'cultura inglesa', 'ingles', 'inglês', 'idioma', 'wizard', 'fisk', 'ccaa', 'wise up']
  },
  
  // SERVIÇOS
  servicos: {
    keywords: ['seguro cartao', 'seg transacao', 'anuidade', 'taxa', 'tarifa', 'iof', 'juros', 'multa', 'serasa', 'spc', 'cpf', 'certidão', 'certidao', 'cartório', 'cartorio', 'despachante', 'advocacia', 'advogado', 'contador', 'contabilidade', 'desconto antecipação', 'desconto antecipacao']
  },
  
  // PET
  pet: {
    keywords: ['petlove', 'petz', 'cobasi', 'pet shop', 'veterinário', 'veterinario', 'vet', 'ração', 'racao', 'pet', 'banho e tosa']
  },
  
  // TRANSFERÊNCIAS (categoria neutra)
  transferencia: {
    keywords: ['transferência enviada', 'transferencia enviada', 'transferência recebida', 'transferencia recebida', 'pix transf', 'ted', 'doc', 'sispag pix']
  },
  
  // INVESTIMENTOS
  investimentos: {
    keywords: ['aplicação', 'aplicacao', 'resgate', 'rdb', 'cdb', 'tesouro', 'ações', 'acoes', 'fundo', 'investimento', 'poupança', 'poupanca', 'previdência', 'previdencia']
  }
};

// Função de categorização inteligente
function categorize(description, amount = 0, date = null) {
  const database = getDB();
  const descriptionLower = (description || '').toLowerCase();
  const isPositive = amount > 0;
  
  // 1. Primeiro, verificar regras estáticas inteligentes
  for (const [category, config] of Object.entries(CATEGORY_RULES)) {
    // Se a regra só se aplica a valores positivos, verificar
    if (config.onlyPositive && !isPositive) continue;
    
    for (const keyword of config.keywords) {
      if (descriptionLower.includes(keyword.toLowerCase())) {
        // Formatar nome da categoria
        const categoryName = {
          renda: 'Renda',
          alimentacao: 'Alimentação',
          transporte: 'Transporte',
          moradia: 'Moradia',
          saude: 'Saúde',
          compras: 'Compras',
          entretenimento: 'Entretenimento',
          educacao: 'Educação',
          servicos: 'Serviços',
          transferencia: 'Transferência',
          investimentos: 'Investimentos',
          pet: 'Pet',
          feira: 'Feira',
          fatura: 'Fatura',
          emprestimo: 'Empréstimo'
        }[category] || category;
        
        return categoryName;
      }
    }
  }
  
  // 2. Verificar regras personalizadas do banco de dados
  const rules = database.prepare('SELECT keyword, category FROM rules').all();
  for (const rule of rules) {
    if (descriptionLower.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }
  
  // 3. Se é domingo e parece ser nome de pessoa (saída sem categoria), é Feira
  if (date && amount < 0) {
    const txDate = new Date(date);
    const dayOfWeek = txDate.getDay(); // 0 = Domingo
    
    if (dayOfWeek === 0) {
      // Verificar se parece nome de pessoa (sem espaços, começa com maiúscula, etc)
      const desc = description || '';
      const looksLikePersonName = 
        !desc.includes(' ') && // Sem espaços (nome junto tipo "Josefapereirada")
        desc.length > 5 && 
        desc.length < 30 &&
        /^[A-Z][a-z]/.test(desc); // Começa com maiúscula seguida de minúscula
      
      if (looksLikePersonName) {
        return 'Feira';
      }
    }
  }
  
  return 'Outros';
}

// Função para sincronizar transações
async function syncTransactions(transactions, accountId, accountInfo = {}) {
  const database = getDB();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO transactions 
    (provider_id, date, amount, description, category, source, type, account_id, account_type, bank_name, owner_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Verificar se já existe transação duplicada (mesma data, valor, descrição, banco e pessoa)
  const checkDuplicate = database.prepare(`
    SELECT id FROM transactions 
    WHERE date = ? 
      AND amount = ? 
      AND description = ? 
      AND bank_name = ? 
      AND owner_name = ?
      AND source = 'pluggy'
    LIMIT 1
  `);

  const { accountType = 'BANK', bankName = null, ownerName = null } = accountInfo;

  const insertMany = database.transaction((transactions) => {
    let count = 0;
    let skipped = 0;
    for (const tx of transactions) {
      const providerId = tx.id || `${accountId}-${tx.date}-${tx.amount}-${tx.description}`;
      
      let amount = parseFloat(tx.amount) || 0;
      if (tx.type === 'DEBIT' && amount > 0) {
        amount = -Math.abs(amount);
      } else if (tx.type === 'CREDIT' && amount < 0) {
        amount = Math.abs(amount);
      }

      const category = categorize(tx.description || '', amount, tx.date);
      const txDate = tx.date || new Date().toISOString();
      const txDescription = tx.description || 'Sem descrição';
      
      // Verificar duplicata antes de inserir (mesma data, valor, descrição, banco e pessoa)
      const duplicate = checkDuplicate.get(txDate, amount, txDescription, bankName, ownerName);
      
      if (duplicate) {
        // Transação já existe, pular
        skipped++;
        continue;
      }
      
      try {
        insert.run(
          providerId,
          txDate,
          amount,
          txDescription,
          category,
          'pluggy',
          tx.type || 'DEBIT',
          accountId,
          accountType,
          bankName,
          ownerName
        );
        count++;
      } catch (error) {
        if (!error.message.includes('UNIQUE constraint')) {
          console.error('Erro ao inserir transação:', error);
        } else {
          skipped++;
        }
      }
    }
    if (skipped > 0) {
      console.log(`[SYNC] ${skipped} transações duplicadas ignoradas`);
    }
    return count;
  });

  return insertMany(transactions);
}

// Função para atualizar categoria
async function updateTransactionCategory(transactionId, category) {
  const database = getDB();
  const update = database.prepare('UPDATE transactions SET category = ? WHERE id = ?');
  update.run(category, transactionId);

  const transaction = database.prepare('SELECT description FROM transactions WHERE id = ?').get(transactionId);
  
  if (transaction && transaction.description) {
    const firstWord = transaction.description.split(/\s+/)[0].toLowerCase();
    const insertRule = database.prepare('INSERT OR REPLACE INTO rules (keyword, category) VALUES (?, ?)');
    insertRule.run(firstWord, category);
  }
}

// Função para calcular período do ciclo específico de um cartão
// month é 1-indexed (1 = Janeiro, 12 = Dezembro)
function getCardCyclePeriod(year, month, bankName, ownerName) {
  // Determinar ciclo específico de cada cartão:
  // - Itaú Larissa: começa dia 28, termina dia 27
  // - Nubank Larissa: começa dia 27, termina dia 26
  // - Robert (qualquer banco): começa dia 29, termina dia 28
  let cycleStartDay, cycleEndDay;
  
  if (bankName === 'Itaú' && ownerName === 'Larissa Purkot') {
    // Itaú Larissa: 28 até 27
    cycleStartDay = 28;
    cycleEndDay = 27;
  } else if (bankName === 'Nubank' && ownerName === 'Larissa Purkot') {
    // Nubank Larissa: 27 até 26
    cycleStartDay = 27;
    cycleEndDay = 26;
  } else if (ownerName === 'Robert Oliveira' || ownerName === 'Robert') {
    // Robert: 29 até 28
    cycleStartDay = 29;
    cycleEndDay = 28;
  } else {
    // Padrão: 29 até 28
    cycleStartDay = 29;
    cycleEndDay = 28;
  }
  
  // Converter para 0-indexed para usar com Date()
  const monthIndex = month - 1; // 0-indexed (0 = Jan, 11 = Dez)
  
  // Data de início: cycleStartDay do mês anterior
  const startDate = new Date(year, monthIndex - 1, cycleStartDay);
  
  // Data de fim: cycleEndDay do mês atual (incluindo o dia completo até 23:59:59)
  const endDate = new Date(year, monthIndex, cycleEndDay, 23, 59, 59);
  
  return {
    start: startDate.toISOString().split('T')[0] + 'T00:00:00',
    end: endDate.toISOString().split('T')[0] + 'T23:59:59',
  };
}

// Função para calcular período do ciclo (dia 29 ao dia 28) - genérico
// month é 1-indexed (1 = Janeiro, 12 = Dezembro)
function getCyclePeriod(year, month) {
  // O ciclo do mês X começa no dia 29 do mês X-1 e vai até o dia 28 do mês X
  // Exemplo: ciclo de Dezembro (month=12) = 29/Nov até 28/Dez (incluindo o dia 28 completo)
  // Exemplo: ciclo de Janeiro (month=1) = 29/Dez do ano anterior até 28/Jan (incluindo o dia 28 completo)
  
  // Converter para 0-indexed para usar com Date()
  const monthIndex = month - 1; // 0-indexed (0 = Jan, 11 = Dez)
  
  // Data de início: dia 29 do mês anterior
  const startDate = new Date(year, monthIndex - 1, 29);
  
  // Data de fim: dia 28 do mês atual (incluindo o dia completo até 23:59:59)
  const endDate = new Date(year, monthIndex, 28, 23, 59, 59);
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0] + 'T23:59:59', // Incluir horário completo para garantir que o dia 28 seja incluído
  };
}

// Gerar lista de períodos disponíveis
function getAvailablePeriods() {
  const periods = [{ label: 'Tudo', value: 'all' }];
  const now = new Date();
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  // Gerar últimos 12 meses
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const monthIndex = date.getMonth(); // 0-indexed
    const monthNumber = monthIndex + 1; // 1-indexed para o value e getCyclePeriod
    const cycle = getCyclePeriod(year, monthNumber);
    
    periods.push({
      label: `${months[monthIndex]}/${year}`,
      value: `${year}-${String(monthNumber).padStart(2, '0')}`,
      start: cycle.start,
      end: cycle.end,
    });
  }
  
  return periods;
}

// Função para obter dados do dashboard
function getDashboardData(filters = {}) {
  try {
    const database = getDB();
    const { period, accountType, bankName, ownerName } = filters;
    
    let whereConditions = [];
    let params = [];
    
    // Filtro de período (ciclo específico por cartão ou genérico)
    if (period && period !== 'all') {
      const [year, month] = period.split('-').map(Number);
      
      // Para cartão de crédito, sempre incluir o dia 28 do mês atual
      const monthIndex = month - 1;
      
      if (accountType === 'CREDIT') {
        if (bankName && bankName !== 'all' && ownerName && ownerName !== 'all') {
          // Com filtros específicos: usar ciclo específico mas sempre estender até dia 28
          let cycleStartDay;
          if (bankName === 'Itaú' && ownerName === 'Larissa Purkot') {
            cycleStartDay = 28; // Itaú Larissa: começa dia 28
          } else if (bankName === 'Nubank' && ownerName === 'Larissa Purkot') {
            cycleStartDay = 27; // Nubank Larissa: começa dia 27
          } else if (ownerName === 'Robert Oliveira' || ownerName === 'Robert') {
            cycleStartDay = 29; // Robert: começa dia 29
          } else {
            cycleStartDay = 29; // Padrão: começa dia 29
          }
          
          const startDate = new Date(year, monthIndex - 1, cycleStartDay);
          const endDate = new Date(year, monthIndex, 28, 23, 59, 59);
          const startDateStr = startDate.toISOString().split('T')[0] + 'T00:00:00';
          const endDateStr = endDate.toISOString().split('T')[0] + 'T23:59:59';
          
          whereConditions.push('date >= ? AND date <= ?');
          params.push(startDateStr, endDateStr);
        } else {
          // Sem filtros específicos: usar condições específicas por cartão para garantir períodos corretos
          const itauLarissaStart = new Date(year, monthIndex - 1, 28).toISOString().split('T')[0] + 'T00:00:00';
          const nubankLarissaStart = new Date(year, monthIndex - 1, 27).toISOString().split('T')[0] + 'T00:00:00';
          const robertStart = new Date(year, monthIndex - 1, 29).toISOString().split('T')[0] + 'T00:00:00';
          const defaultStart = new Date(year, monthIndex - 1, 29).toISOString().split('T')[0] + 'T00:00:00';
          const creditEndStr = new Date(year, monthIndex, 28, 23, 59, 59).toISOString().split('T')[0] + 'T23:59:59';
          
          whereConditions.push(`(
            (bank_name = 'Itaú' AND owner_name = 'Larissa Purkot' AND date >= ? AND date <= ?) OR
            (bank_name = 'Nubank' AND owner_name = 'Larissa Purkot' AND date >= ? AND date <= ?) OR
            ((owner_name = 'Robert Oliveira' OR owner_name = 'Robert') AND date >= ? AND date <= ?) OR
            (NOT (bank_name = 'Itaú' AND owner_name = 'Larissa Purkot') AND NOT (bank_name = 'Nubank' AND owner_name = 'Larissa Purkot') AND NOT (owner_name = 'Robert Oliveira' OR owner_name = 'Robert') AND date >= ? AND date <= ?)
          )`);
          params.push(
            itauLarissaStart, creditEndStr,  // Itaú Larissa: 28 até 28
            nubankLarissaStart, creditEndStr,  // Nubank Larissa: 27 até 28
            robertStart, creditEndStr,  // Robert: 29 até 28
            defaultStart, creditEndStr  // Outros: 29 até 28
          );
        }
      } else if (accountType === 'all' || !accountType) {
        // Quando não há filtro de tipo ou é 'all', usar OR para incluir cartões de crédito até dia 28
        // e outras contas com período normal
        // Para cartões de crédito: usar período que começa no dia 27 (para cobrir Nubank Larissa que começa dia 27)
        // mas garantir que Itaú Larissa (que começa dia 28) também seja incluído corretamente
        // Usar dia 27 como início mínimo para cobrir todos os ciclos, mas a query vai filtrar corretamente
        const creditStartDate = new Date(year, monthIndex - 1, 27); // Dia 27 para cobrir Nubank Larissa
        const creditEndDate = new Date(year, monthIndex, 28, 23, 59, 59);
        const creditStartStr = creditStartDate.toISOString().split('T')[0] + 'T00:00:00';
        const creditEndStr = creditEndDate.toISOString().split('T')[0] + 'T23:59:59';
        
        const normalCycle = getCyclePeriod(year, month);
        
        // Para cartões de crédito, usar uma condição mais específica:
        // - Itaú Larissa: >= 28 do mês anterior (EXATAMENTE dia 28, não antes)
        // - Nubank Larissa: >= 27 do mês anterior  
        // - Robert: >= 29 do mês anterior
        // - Outros cartões: >= 29 do mês anterior
        // Todos até dia 28 do mês atual
        const itauLarissaStart = new Date(year, monthIndex - 1, 28).toISOString().split('T')[0] + 'T00:00:00';
        const nubankLarissaStart = new Date(year, monthIndex - 1, 27).toISOString().split('T')[0] + 'T00:00:00';
        const robertStart = new Date(year, monthIndex - 1, 29).toISOString().split('T')[0] + 'T00:00:00';
        const defaultStart = new Date(year, monthIndex - 1, 29).toISOString().split('T')[0] + 'T00:00:00';
        
        whereConditions.push(`(
          (account_type = 'CREDIT' AND (
            (bank_name = 'Itaú' AND owner_name = 'Larissa Purkot' AND date >= ? AND date <= ?) OR
            (bank_name = 'Nubank' AND owner_name = 'Larissa Purkot' AND date >= ? AND date <= ?) OR
            ((owner_name = 'Robert Oliveira' OR owner_name = 'Robert') AND date >= ? AND date <= ?) OR
            (account_type = 'CREDIT' AND NOT (bank_name = 'Itaú' AND owner_name = 'Larissa Purkot') AND NOT (bank_name = 'Nubank' AND owner_name = 'Larissa Purkot') AND NOT (owner_name = 'Robert Oliveira' OR owner_name = 'Robert') AND date >= ? AND date <= ?)
          )) OR
          (account_type != 'CREDIT' AND date >= ? AND date <= ?)
        )`);
        params.push(
          itauLarissaStart, creditEndStr,  // Itaú Larissa: 28 até 28 (EXATAMENTE dia 28)
          nubankLarissaStart, creditEndStr,  // Nubank Larissa: 27 até 28
          robertStart, creditEndStr,  // Robert: 29 até 28
          defaultStart, creditEndStr,  // Outros cartões (não Itaú Larissa): 29 até 28
          normalCycle.start, normalCycle.end  // Conta corrente: período normal
        );
      } else {
        // Para conta corrente, usar período genérico
        const cycle = getCyclePeriod(year, month);
        whereConditions.push('date >= ? AND date <= ?');
        params.push(cycle.start, cycle.end);
      }
    }
    
    // Filtro de tipo de conta
    if (accountType && accountType !== 'all') {
      whereConditions.push('account_type = ?');
      params.push(accountType);
    }
    
    // Filtro de banco
    if (bankName && bankName !== 'all') {
      whereConditions.push('bank_name = ?');
      params.push(bankName);
    }
    
    // Filtro de proprietário
    if (ownerName && ownerName !== 'all') {
      whereConditions.push('owner_name = ?');
      params.push(ownerName);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const transactions = database.prepare(`
      SELECT * FROM transactions 
      ${whereClause}
      ORDER BY date DESC 
      LIMIT 500
    `).all(...params);

    // Totais por categoria com filtros
    // Incluir gastos (amount < 0) E pagamentos de fatura (category = 'Fatura' mesmo com amount > 0)
    // Ordenar por valor absoluto DESC para que as maiores categorias apareçam primeiro
    const categoryTotalsQuery = whereClause 
      ? `SELECT 
          category,
          SUM(CASE WHEN category = 'Fatura' THEN ABS(amount) ELSE amount END) as total
        FROM transactions
        ${whereClause} AND (amount < 0 OR category = 'Fatura')
        GROUP BY category
        ORDER BY ABS(total) DESC`
      : `SELECT 
          category,
          SUM(CASE WHEN category = 'Fatura' THEN ABS(amount) ELSE amount END) as total
        FROM transactions
        WHERE amount < 0 OR category = 'Fatura'
        GROUP BY category
        ORDER BY ABS(total) DESC`;
    
    const categoryTotals = database.prepare(categoryTotalsQuery).all(...params);

    // Saldo total (apenas conta corrente - entradas e saídas, sem cartão de crédito)
    const balanceQuery = whereClause 
      ? `SELECT SUM(amount) as total FROM transactions ${whereClause} AND (account_type != 'CREDIT' OR account_type IS NULL)`
      : `SELECT SUM(amount) as total FROM transactions WHERE account_type != 'CREDIT' OR account_type IS NULL`;
    const balanceResult = database.prepare(balanceQuery).get(...params);
    const totalBalance = balanceResult?.total || 0;

    // Gastos do período (apenas conta corrente - para bater com saldo em conta)
    let periodExpenses = 0;
    if (period && period !== 'all') {
      // Se há filtro de período, usar os mesmos filtros já aplicados + apenas conta corrente
      const expensesResult = database.prepare(`
        SELECT SUM(amount) as total FROM transactions 
        ${whereClause ? whereClause + " AND amount < 0 AND (account_type = 'BANK' OR account_type IS NULL)" : "WHERE amount < 0 AND (account_type = 'BANK' OR account_type IS NULL)"}
      `).get(...params);
      periodExpenses = Math.abs(expensesResult?.total || 0);
    } else {
      // Se período é "Tudo", somar TODOS os gastos de conta corrente
      let expensesQuery = "SELECT SUM(amount) as total FROM transactions WHERE amount < 0 AND (account_type = 'BANK' OR account_type IS NULL)";
      let expensesParams = [];
      
      // Aplicar outros filtros (bankName, ownerName) se existirem
      if (bankName && bankName !== 'all') {
        expensesQuery += ' AND bank_name = ?';
        expensesParams.push(bankName);
      }
      if (ownerName && ownerName !== 'all') {
        expensesQuery += ' AND owner_name = ?';
        expensesParams.push(ownerName);
      }
      
      const expensesResult = database.prepare(expensesQuery).get(...expensesParams);
      periodExpenses = Math.abs(expensesResult?.total || 0);
    }

    // Entradas do período (apenas conta corrente, valores positivos)
    let periodIncome = 0;
    if (period && period !== 'all') {
      // Se há filtro de período, usar os mesmos filtros já aplicados + amount > 0 + apenas conta corrente
      const incomeResult = database.prepare(`
        SELECT SUM(amount) as total FROM transactions 
        ${whereClause ? whereClause + ' AND amount > 0 AND (account_type = \'BANK\' OR account_type IS NULL)' : 'WHERE amount > 0 AND (account_type = \'BANK\' OR account_type IS NULL)'}
      `).get(...params);
      periodIncome = incomeResult?.total || 0;
    } else {
      // Se período é "Tudo", somar TODAS as entradas (respeitando outros filtros)
      let incomeQuery = 'SELECT SUM(amount) as total FROM transactions WHERE amount > 0 AND (account_type = \'BANK\' OR account_type IS NULL)';
      let incomeParams = [];
      
      // Aplicar outros filtros (bankName, ownerName) se existirem
      if (bankName && bankName !== 'all') {
        incomeQuery += ' AND bank_name = ?';
        incomeParams.push(bankName);
      }
      if (ownerName && ownerName !== 'all') {
        incomeQuery += ' AND owner_name = ?';
        incomeParams.push(ownerName);
      }
      
      const incomeResult = database.prepare(incomeQuery).get(...incomeParams);
      periodIncome = incomeResult?.total || 0;
    }

    // Obter lista de bancos e proprietários únicos
    const banks = database.prepare('SELECT DISTINCT bank_name FROM transactions WHERE bank_name IS NOT NULL ORDER BY bank_name').all();
    const owners = database.prepare('SELECT DISTINCT owner_name FROM transactions WHERE owner_name IS NOT NULL ORDER BY owner_name').all();
    const accountTypes = database.prepare('SELECT DISTINCT account_type FROM transactions WHERE account_type IS NOT NULL ORDER BY account_type').all();

    // Saldo total da conta corrente (TODAS as transações = saldo atual)
    const bankBalanceResult = database.prepare(`
      SELECT SUM(amount) as total FROM transactions 
      WHERE account_type != 'CREDIT' OR account_type IS NULL
    `).get();
    const currentBankBalance = bankBalanceResult?.total || 0;

    // Movimentação do período (Entradas - Gastos)
    const periodMovement = periodIncome - periodExpenses;
    
    // Para calcular o saldo no FINAL do período selecionado, precisamos subtrair
    // a movimentação de todos os períodos POSTERIORES ao selecionado
    let endOfPeriodBalance = currentBankBalance; // Para o mês atual, é o saldo atual
    let movementAfterPeriod = 0;
    
    if (period && period !== 'all') {
      const [year, month] = period.split('-').map(Number);
      const cycle = getCyclePeriod(year, month);
      
      // Calcular movimentação APÓS o período selecionado (transações depois do fim do ciclo)
      // Usar final do dia para comparação correta
      const afterPeriodResult = database.prepare(`
        SELECT SUM(amount) as total FROM transactions 
        WHERE (account_type = 'BANK' OR account_type IS NULL)
          AND date > ?
      `).get(cycle.end + 'T23:59:59');
      movementAfterPeriod = afterPeriodResult?.total || 0;
      
      // Saldo no final do período = Saldo Atual - Movimentação posterior
      endOfPeriodBalance = currentBankBalance - movementAfterPeriod;
    }
    
    // Saldo inicial do período = Saldo no final - Movimentação do período
    const initialBalance = endOfPeriodBalance - periodMovement;

    // Fatura do cartão de crédito do período atual
    let creditCardBill = 0;
    if (period && period !== 'all') {
      const [year, month] = period.split('-').map(Number);
      const cycle = getCyclePeriod(year, month);
      const creditBillResult = database.prepare(`
        SELECT SUM(amount) as total FROM transactions 
        WHERE account_type = 'CREDIT' AND amount < 0 AND date >= ? AND date <= ?
      `).get(cycle.start, cycle.end);
      creditCardBill = Math.abs(creditBillResult?.total || 0);
    } else {
      // Período atual
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentCycle = getCyclePeriod(now.getFullYear(), currentMonth);
      const creditBillResult = database.prepare(`
        SELECT SUM(amount) as total FROM transactions 
        WHERE account_type = 'CREDIT' AND amount < 0 AND date >= ? AND date <= ?
      `).get(currentCycle.start, currentCycle.end);
      creditCardBill = Math.abs(creditBillResult?.total || 0);
    }

    return {
      transactions: transactions.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount),
      })),
      categoryTotals: categoryTotals.map(ct => ({
        category: ct.category,
        total: Math.abs(parseFloat(ct.total)),
      })),
      totalBalance: parseFloat(totalBalance),
      periodExpenses: parseFloat(periodExpenses),
      periodIncome: parseFloat(periodIncome), // Entradas do período (conta corrente)
      periodMovement: parseFloat(periodMovement), // Movimentação do período (Entradas - Gastos)
      initialBalance: parseFloat(initialBalance), // Saldo no início do período
      endOfPeriodBalance: parseFloat(endOfPeriodBalance), // Saldo no final do período
      currentBankBalance: parseFloat(currentBankBalance), // Saldo atual da conta (hoje)
      creditCardBill: parseFloat(creditCardBill), // Fatura do cartão no período
      // Metadados para filtros
      filters: {
        periods: getAvailablePeriods(),
        banks: [{ label: 'Todos', value: 'all' }, ...banks.map(b => ({ label: b.bank_name, value: b.bank_name }))],
        owners: [{ label: 'Todos', value: 'all' }, ...owners.map(o => ({ label: o.owner_name, value: o.owner_name }))],
        accountTypes: [
          { label: 'Todos', value: 'all' },
          { label: 'Conta Corrente', value: 'BANK' },
          { label: 'Cartão de Crédito', value: 'CREDIT' },
        ],
      },
      // Filtros aplicados
      appliedFilters: filters,
    };
  } catch (error) {
    console.error('Erro em getDashboardData:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// ========== CREDENCIAIS PLUGGY ==========

app.get('/api/credentials', (req, res) => {
  try {
    const database = getDB();
    const credentials = database.prepare('SELECT * FROM pluggy_credentials ORDER BY created_at DESC').all();
    res.json(credentials.map(c => ({
      ...c,
      is_active: Boolean(c.is_active),
    })));
  } catch (error) {
    console.error('Erro ao listar credenciais:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/credentials', (req, res) => {
  try {
    const { name, client_id, client_secret, is_active } = req.body;
    
    if (!name || !client_id || !client_secret) {
      return res.status(400).json({ error: 'Nome, Client ID e Client Secret são obrigatórios' });
    }

    // Limpar credenciais (remover espaços)
    const cleanClientId = String(client_id).trim();
    const cleanClientSecret = String(client_secret).trim();
    
    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanClientId)) {
      return res.status(400).json({ 
        error: 'Client ID inválido. Deve ser um UUID válido (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
        hint: 'Verifique se copiou o Client ID completo do dashboard Pluggy'
      });
    }

    const database = getDB();
    
    if (is_active) {
      database.prepare('UPDATE pluggy_credentials SET is_active = 0').run();
    }

    const result = database.prepare(`
      INSERT INTO pluggy_credentials (name, client_id, client_secret, is_active)
      VALUES (?, ?, ?, ?)
    `).run(name, cleanClientId, cleanClientSecret, is_active ? 1 : 0);

    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    console.error('Erro ao criar credencial:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/credentials/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, client_id, client_secret, is_active } = req.body;

    const database = getDB();
    
    if (is_active) {
      database.prepare('UPDATE pluggy_credentials SET is_active = 0 WHERE id != ?').run(id);
    }

    database.prepare(`
      UPDATE pluggy_credentials 
      SET name = ?, client_id = ?, client_secret = ?, is_active = ?
      WHERE id = ?
    `).run(name, client_id, client_secret, is_active ? 1 : 0, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar credencial:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/credentials/:id', (req, res) => {
  try {
    const { id } = req.params;
    const database = getDB();
    database.prepare('DELETE FROM pluggy_credentials WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar credencial:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credentials/active', (req, res) => {
  try {
    const database = getDB();
    const credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    
    if (!credential) {
      return res.status(404).json({ error: 'Nenhuma credencial ativa encontrada' });
    }

    res.json({
      ...credential,
      is_active: Boolean(credential.is_active),
    });
  } catch (error) {
    console.error('Erro ao obter credencial ativa:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== DASHBOARD ==========

app.get('/api/dashboard', (req, res) => {
  try {
    const { period, accountType, bankName, ownerName } = req.query;
    const filters = {
      period: period || 'all',
      accountType: accountType || 'all',
      bankName: bankName || 'all',
      ownerName: ownerName || 'all',
    };
    const data = getDashboardData(filters);
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== PLUGGY ==========

app.post('/api/pluggy/token', async (req, res) => {
  try {
    const { credential_id } = req.body;
    
    const database = getDB();
    let credential;
    
    if (credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(credential_id);
    } else {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    }

    if (!credential) {
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada. Configure uma credencial primeiro.' });
    }

    // Limpar e validar credenciais
    const clientId = String(credential.client_id || '').trim();
    const clientSecret = String(credential.client_secret || '').trim();
    
    if (!clientId || !clientSecret) {
      return res.status(400).json({ 
        error: 'Credenciais vazias. Verifique se as credenciais foram salvas corretamente.',
        hint: 'Delete e adicione novamente as credenciais'
      });
    }
    
    // Validar formato do clientId (deve ser UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return res.status(400).json({ 
        error: 'Client ID inválido. Deve ser um UUID válido (ex: 123e4567-e89b-12d3-a456-426614174000)',
        hint: 'Obtenha suas credenciais válidas em https://dashboard.pluggy.ai',
        received: clientId.substring(0, 20) + '...' // Mostrar início para debug
      });
    }
    
    console.log('[PLUGGY] Usando credenciais:', {
      clientId: clientId.substring(0, 8) + '...',
      clientSecretLength: clientSecret.length
    });
    
    // Garantir que são strings antes de passar para PluggyClient
    const pluggyClient = new PluggyClient({
      clientId: String(clientId),
      clientSecret: String(clientSecret),
    });
    
    const response = await pluggyClient.createConnectToken();
    console.log('[SERVER] Resposta Pluggy createConnectToken:', response);
    
    const accessToken = response.accessToken || response.token || response;
    
    if (!accessToken) {
      console.error('[SERVER] Token não encontrado na resposta:', response);
      return res.status(500).json({ 
        error: 'Token não retornado pela API Pluggy',
        details: response 
      });
    }
    
    console.log('[SERVER] Token sendo retornado:', accessToken.substring(0, 30) + '...');
    
    res.json({ 
      accessToken: accessToken,
      credential_id: credential.id,
    });
  } catch (error) {
    console.error('Erro ao obter token Pluggy:', error);
    let errorMessage = error.message;
    
    if (error.message.includes('clientId must be a UUID') || error.message.includes('400')) {
      errorMessage = 'Credenciais Pluggy inválidas. O Client ID deve ser um UUID válido e o Client Secret deve estar correto. Obtenha suas credenciais em https://dashboard.pluggy.ai';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/pluggy/sync', async (req, res) => {
  try {
    const { itemId, credential_id } = req.body;

    console.log('[SERVER] ============================================');
    console.log('[SERVER] Sincronização Pluggy iniciada');
    console.log('[SERVER] itemId recebido:', itemId);
    console.log('[SERVER] credential_id recebido:', credential_id);
    console.log('[SERVER] ============================================');

    if (!itemId) {
      console.error('[SERVER] ❌ itemId não fornecido');
      return res.status(400).json({ error: 'itemId é obrigatório' });
    }

    const database = getDB();
    
    // Buscar informações do item salvo (bank_name, owner_name)
    const savedItem = database.prepare('SELECT * FROM pluggy_items WHERE item_id = ?').get(itemId);
    const bankName = savedItem?.bank_name || 'Desconhecido';
    const ownerName = savedItem?.owner_name || 'Desconhecido';
    
    console.log('[SERVER] Item salvo encontrado:', savedItem ? `${bankName} - ${ownerName}` : 'Não encontrado');
    
    let credential;
    
    if (credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(credential_id);
    } else if (savedItem?.credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(savedItem.credential_id);
    } else {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    }

    if (!credential) {
      console.error('[SERVER] ❌ Credencial não encontrada');
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada' });
    }

    console.log('[SERVER] ✅ Credencial encontrada:', credential.id);

    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    console.log('[SERVER] Buscando contas para itemId:', itemId);
    const accountsResponse = await pluggyClient.fetchAccounts(itemId);
    const accounts = accountsResponse?.results || accountsResponse || [];

    console.log('[SERVER] Contas encontradas:', accounts.length);
    if (accounts.length > 0) {
      console.log('[SERVER] Primeira conta:', accounts[0].name || accounts[0].type);
    }

    if (accounts.length === 0) {
      console.warn('[SERVER] ⚠️ Nenhuma conta encontrada para este item');
      return res.status(404).json({ error: 'Nenhuma conta encontrada para este item. Aguarde alguns minutos e tente novamente.' });
    }

    let totalSynced = 0;
    let errors = [];

    for (const account of accounts) {
      try {
        console.log(`[SERVER] Sincronizando conta: ${account.name || account.type} (${account.id})`);
        console.log(`[SERVER] Tipo da conta: ${account.type}`);
        
        const transactionsResponse = await pluggyClient.fetchTransactions(account.id);
        const transactions = transactionsResponse?.results || transactionsResponse || [];

        console.log(`[SERVER] Transações encontradas: ${transactions.length}`);
        
        if (transactions.length > 0) {
          // Determinar o tipo de conta (BANK = conta corrente, CREDIT = cartão de crédito)
          const accountType = account.type || 'BANK';
          
          const synced = await syncTransactions(transactions, account.id, {
            accountType: accountType,
            bankName: bankName,
            ownerName: ownerName,
          });
          totalSynced += synced;
          console.log(`[SERVER] ✅ ${synced} transações sincronizadas da conta ${account.name || account.type}`);
        } else {
          console.log(`[SERVER] ℹ️ Nenhuma transação para sincronizar na conta ${account.name || account.type}`);
        }
      } catch (error) {
        console.error(`[SERVER] ❌ Erro ao sincronizar conta ${account.id}:`, error.message);
        errors.push({ account: account.name || account.type, error: error.message });
      }
    }

    console.log('[SERVER] ============================================');
    console.log('[SERVER] ✅ Sincronização concluída');
    console.log('[SERVER] Total sincronizado:', totalSynced);
    console.log('[SERVER] Erros:', errors.length);
    console.log('[SERVER] ============================================');

    res.json({ 
      success: true, 
      totalSynced,
      accountsProcessed: accounts.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[SERVER] ❌ Erro ao sincronizar Pluggy:', error);
    console.error('[SERVER] Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota: Listar conectores disponíveis
app.get('/api/pluggy/connectors', async (req, res) => {
  console.log('[SERVER] Rota /api/pluggy/connectors chamada');
  try {
    const { credential_id } = req.query;
    console.log('[SERVER] credential_id recebido:', credential_id);
    
    const database = getDB();
    let credential;
    
    if (credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(credential_id);
    } else {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    }

    if (!credential) {
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada' });
    }

    console.log('[SERVER] Buscando conectores com credencial:', credential.id);
    
    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    const connectors = await pluggyClient.getConnectors();
    console.log('[SERVER] Conectores recebidos:', Array.isArray(connectors) ? connectors.length : 'formato diferente');
    console.log('[SERVER] Tipo:', typeof connectors);
    
    // Garantir que retornamos um array
    let connectorsArray = [];
    if (Array.isArray(connectors)) {
      connectorsArray = connectors;
    } else if (connectors?.results && Array.isArray(connectors.results)) {
      connectorsArray = connectors.results;
    } else if (connectors?.data && Array.isArray(connectors.data)) {
      connectorsArray = connectors.data;
    }
    
    console.log('[SERVER] Retornando', connectorsArray.length, 'conectores');
    res.json(connectorsArray);
  } catch (error) {
    console.error('[SERVER] Erro ao listar conectores:', error);
    console.error('[SERVER] Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota: Criar item (conexão) diretamente via API
app.post('/api/pluggy/create-item', async (req, res) => {
  try {
    const { connectorId, parameters, credential_id } = req.body;

    if (!connectorId) {
      return res.status(400).json({ error: 'connectorId é obrigatório' });
    }

    const database = getDB();
    let credential;
    
    if (credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(credential_id);
    } else {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    }

    if (!credential) {
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada' });
    }

    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    const item = await pluggyClient.createItem(connectorId, parameters || {});
    res.json(item);
  } catch (error) {
    console.error('Erro ao criar item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota: Buscar status de um item
app.get('/api/pluggy/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { credential_id } = req.query;
    
    const database = getDB();
    let credential;
    
    if (credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(credential_id);
    } else {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    }

    if (!credential) {
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada' });
    }

    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    const item = await pluggyClient.getItem(itemId);
    res.json(item);
  } catch (error) {
    console.error('Erro ao buscar item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota: Listar items (conexões) existentes
app.get('/api/pluggy/items', async (req, res) => {
  try {
    const { credential_id } = req.query;
    
    const database = getDB();
    let credential;
    
    if (credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(credential_id);
    } else {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    }

    if (!credential) {
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada' });
    }

    console.log('[SERVER] Listando items do Pluggy...');
    
    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    const items = await pluggyClient.listItems();
    const itemsArray = Array.isArray(items) ? items : (items?.results || items?.data || []);
    
    console.log('[SERVER] Items encontrados:', itemsArray.length);
    
    res.json(itemsArray);
  } catch (error) {
    console.error('[SERVER] Erro ao listar items:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota: Executar MFA
app.post('/api/pluggy/item/:itemId/mfa', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { mfa, credential_id } = req.body;

    if (!mfa) {
      return res.status(400).json({ error: 'mfa é obrigatório' });
    }

    const database = getDB();
    let credential;
    
    if (credential_id) {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE id = ?').get(credential_id);
    } else {
      credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    }

    if (!credential) {
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada' });
    }

    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    const result = await pluggyClient.executeMFA(itemId, mfa);
    res.json(result);
  } catch (error) {
    console.error('Erro ao executar MFA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota: Buscar saldos reais das contas diretamente do Pluggy
app.get('/api/account-balances', async (req, res) => {
  try {
    const database = getDB();
    
    // Buscar todos os items salvos
    const savedItems = database.prepare('SELECT * FROM pluggy_items').all();
    
    if (savedItems.length === 0) {
      return res.json({
        bankBalance: 0,
        creditCardBill: 0,
        accounts: [],
        message: 'Nenhuma conta cadastrada'
      });
    }

    // Buscar credencial ativa
    const credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    
    if (!credential) {
      return res.status(404).json({ error: 'Credencial Pluggy não encontrada' });
    }

    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });

    let totalBankBalance = 0;
    let totalCreditCardBill = 0;
    const allAccounts = [];

    // Para cada item salvo, buscar as contas e saldos
    for (const item of savedItems) {
      try {
        console.log(`[SERVER] Buscando saldos para ${item.bank_name} (${item.item_id})`);
        
        const accountsResponse = await pluggyClient.fetchAccounts(item.item_id);
        const accounts = accountsResponse?.results || accountsResponse || [];

        for (const account of accounts) {
          const accountInfo = {
            id: account.id,
            name: account.name || account.type,
            type: account.type,
            subtype: account.subtype,
            balance: account.balance || 0,
            bankName: item.bank_name,
            ownerName: item.owner_name,
            currencyCode: account.currencyCode || 'BRL',
          };

          allAccounts.push(accountInfo);

          // Separar por tipo de conta
          if (account.type === 'CREDIT') {
            // Cartão de crédito: o balance geralmente é negativo (dívida)
            // Alguns bancos retornam positivo, então pegamos o valor absoluto
            totalCreditCardBill += Math.abs(account.balance || 0);
          } else {
            // Conta corrente/poupança: saldo disponível
            totalBankBalance += (account.balance || 0);
          }

          console.log(`[SERVER]   - ${account.name || account.type}: R$ ${account.balance} (${account.type})`);
        }
      } catch (error) {
        console.error(`[SERVER] Erro ao buscar saldos de ${item.bank_name}:`, error.message);
      }
    }

    console.log(`[SERVER] Saldo total conta corrente: R$ ${totalBankBalance}`);
    console.log(`[SERVER] Fatura total cartão: R$ ${totalCreditCardBill}`);

    res.json({
      bankBalance: totalBankBalance,
      creditCardBill: totalCreditCardBill,
      accounts: allAccounts,
    });
  } catch (error) {
    console.error('[SERVER] Erro ao buscar saldos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PLUGGY ITEMS (Contas Conectadas) ==========

// Listar todos os items salvos
app.get('/api/pluggy-items', (req, res) => {
  try {
    const database = getDB();
    const items = database.prepare(`
      SELECT pi.*, pc.name as credential_name 
      FROM pluggy_items pi
      LEFT JOIN pluggy_credentials pc ON pi.credential_id = pc.id
      ORDER BY pi.created_at DESC
    `).all();
    res.json(items);
  } catch (error) {
    console.error('Erro ao listar items:', error);
    res.status(500).json({ error: error.message });
  }
});

// Adicionar novo item
app.post('/api/pluggy-items', (req, res) => {
  try {
    const { item_id, bank_name, owner_name, credential_id } = req.body;

    if (!item_id || !bank_name || !owner_name) {
      return res.status(400).json({ error: 'item_id, bank_name e owner_name são obrigatórios' });
    }

    const database = getDB();
    
    // Verificar se já existe
    const existing = database.prepare('SELECT * FROM pluggy_items WHERE item_id = ?').get(item_id);
    if (existing) {
      return res.status(400).json({ error: 'Este Item ID já está cadastrado' });
    }

    const result = database.prepare(`
      INSERT INTO pluggy_items (item_id, bank_name, owner_name, credential_id)
      VALUES (?, ?, ?, ?)
    `).run(item_id, bank_name, owner_name, credential_id || null);

    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar item
app.put('/api/pluggy-items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, bank_name, owner_name, credential_id } = req.body;

    if (!bank_name || !owner_name) {
      return res.status(400).json({ error: 'bank_name e owner_name são obrigatórios' });
    }

    const database = getDB();
    
    // Se está tentando atualizar o item_id, verificar se não conflita com outro item
    if (item_id) {
      const currentItem = database.prepare('SELECT item_id FROM pluggy_items WHERE id = ?').get(id);
      const newItemIdExists = database.prepare('SELECT id FROM pluggy_items WHERE item_id = ? AND id != ?').get(item_id, id);
      
      if (newItemIdExists) {
        return res.status(400).json({ error: 'Este Item ID já está cadastrado em outro item' });
      }
      
      // Atualizar incluindo o item_id
      database.prepare(`
        UPDATE pluggy_items 
        SET item_id = ?, bank_name = ?, owner_name = ?, credential_id = ?
        WHERE id = ?
      `).run(item_id, bank_name, owner_name, credential_id || null, id);
      
      console.log(`[PLUGGY-ITEMS] Item ${id} atualizado: item_id mudou de ${currentItem?.item_id} para ${item_id}`);
    } else {
      // Atualizar sem mudar o item_id
      database.prepare(`
        UPDATE pluggy_items 
        SET bank_name = ?, owner_name = ?, credential_id = ?
        WHERE id = ?
      `).run(bank_name, owner_name, credential_id || null, id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar item
app.delete('/api/pluggy-items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const database = getDB();
    database.prepare('DELETE FROM pluggy_items WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar item:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== TRANSAÇÕES ==========

// Importar transações de arquivo CSV
app.post('/api/transactions/import', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Lista de transações é obrigatória' });
    }

    const database = getDB();
    let imported = 0;
    let skipped = 0;

    for (const tx of transactions) {
      try {
        // Criar provider_id único
        const providerId = `import_${tx.date}_${tx.amount}_${tx.description}`.replace(/[^a-zA-Z0-9_]/g, '_');
        
        const amount = parseFloat(tx.amount) || 0;
        const category = categorize(tx.description || '', amount, tx.date);
        
        const insert = database.prepare(`
          INSERT OR IGNORE INTO transactions 
          (provider_id, date, amount, description, category, source, type, account_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insert.run(
          providerId,
          tx.date || new Date().toISOString().split('T')[0],
          parseFloat(tx.amount) || 0,
          tx.description || 'Sem descrição',
          category,
          tx.source || 'csv_import',
          tx.type || (tx.amount < 0 ? 'DEBIT' : 'CREDIT'),
          null
        );

        imported++;
      } catch (error) {
        if (!error.message.includes('UNIQUE constraint')) {
          console.error('Erro ao importar transação:', error);
        }
        skipped++;
      }
    }

    res.json({ 
      success: true, 
      count: imported,
      skipped 
    });
  } catch (error) {
    console.error('Erro ao importar transações:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar transações por origem (source)
app.delete('/api/transactions/by-source/:source', (req, res) => {
  try {
    const { source } = req.params;
    const database = getDB();
    
    // Contar quantas transações serão deletadas
    const countResult = database.prepare('SELECT COUNT(*) as count FROM transactions WHERE source = ?').get(source);
    const count = countResult?.count || 0;
    
    if (count === 0) {
      return res.json({ 
        success: true, 
        deleted: 0,
        message: `Nenhuma transação encontrada com origem '${source}'`
      });
    }
    
    // Deletar transações
    const deleteStmt = database.prepare('DELETE FROM transactions WHERE source = ?');
    deleteStmt.run(source);
    
    console.log(`[SERVER] Deletadas ${count} transações com source='${source}'`);
    
    res.json({ 
      success: true, 
      deleted: count,
      message: `${count} transação(ões) deletada(s) com sucesso`
    });
  } catch (error) {
    console.error('Erro ao deletar transações:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar transação individual por ID
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const database = getDB();
    
    const deleteStmt = database.prepare('DELETE FROM transactions WHERE id = ?');
    const result = deleteStmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }
    
    res.json({ success: true, message: 'Transação deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar transação:', error);
    res.status(500).json({ error: error.message });
  }
});

// Limpar todas as transações (mantém credenciais e items salvos)
app.delete('/api/transactions/clear-all', (req, res) => {
  try {
    const database = getDB();
    
    // Contar quantas transações serão deletadas
    const countResult = database.prepare('SELECT COUNT(*) as count FROM transactions').get();
    const count = countResult?.count || 0;
    
    // Deletar apenas as transações (NÃO apaga credenciais nem items salvos)
    database.prepare('DELETE FROM transactions').run();
    
    console.log(`[SERVER] Todas as ${count} transações foram deletadas (credenciais e items mantidos)`);
    
    res.json({ 
      success: true, 
      deleted: count,
      message: `${count} transação(ões) deletada(s) com sucesso. Credenciais e contas mantidas.`
    });
  } catch (error) {
    console.error('Erro ao limpar transações:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/transactions/:id/category', (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Categoria é obrigatória' });
    }

    updateTransactionCategory(parseInt(id), category);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para recategorizar TODAS as transações
app.post('/api/transactions/recategorize', (req, res) => {
  try {
    const database = getDB();
    
    // Buscar todas as transações (incluindo data para verificar domingo)
    const transactions = database.prepare('SELECT id, description, amount, date FROM transactions').all();
    
    let updated = 0;
    const updateStmt = database.prepare('UPDATE transactions SET category = ? WHERE id = ?');
    
    for (const tx of transactions) {
      const newCategory = categorize(tx.description || '', tx.amount, tx.date);
      updateStmt.run(newCategory, tx.id);
      updated++;
    }
    
    // Estatísticas por categoria
    const stats = database.prepare(`
      SELECT category, COUNT(*) as count 
      FROM transactions 
      GROUP BY category 
      ORDER BY count DESC
    `).all();
    
    console.log('[RECATEGORIZE] Recategorizadas', updated, 'transações');
    console.log('[RECATEGORIZE] Estatísticas:', stats);
    
    res.json({ 
      success: true, 
      updated,
      stats 
    });
  } catch (error) {
    console.error('Erro ao recategorizar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Inicializar banco de dados antes de iniciar o servidor
console.log('🔄 Inicializando banco de dados...');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

try {
  getDB(); // Isso cria o banco e as tabelas se não existirem
  console.log('✅ Banco de dados inicializado');
} catch (error) {
  console.error('\n❌❌❌ ERRO AO INICIALIZAR BANCO DE DADOS ❌❌❌');
  console.error('Mensagem:', error.message);
  console.error('\nStack:', error.stack);
  console.error('\n═══════════════════════════════════════════════════════');
  console.error('💡 SOLUÇÃO:');
  console.error('═══════════════════════════════════════════════════════');
  console.error('Execute estes comandos:');
  console.error('');
  console.error('  cd financas-local');
  console.error('  source ~/.nvm/nvm.sh');
  console.error('  nvm use 24');
  console.error('  npm rebuild better-sqlite3');
  console.error('  npm run dev');
  console.error('');
  console.error('═══════════════════════════════════════════════════════\n');
  process.exit(1);
}

// Endpoint para buscar saldos REAIS das contas do Pluggy
app.get('/api/pluggy/real-balances', async (req, res) => {
  try {
    const database = getDB();
    
    // Buscar todos os items salvos
    const savedItems = database.prepare('SELECT * FROM pluggy_items').all();
    
    if (savedItems.length === 0) {
      return res.json({ bankBalance: 0, creditCardBalance: 0, creditCardBillsDetailed: [], accounts: [] });
    }
    
    // Buscar credencial ativa
    const credential = database.prepare('SELECT * FROM pluggy_credentials WHERE is_active = 1 LIMIT 1').get();
    
    if (!credential) {
      return res.status(404).json({ error: 'Nenhuma credencial Pluggy ativa encontrada' });
    }
    
    const pluggyClient = new PluggyClient({
      clientId: credential.client_id,
      clientSecret: credential.client_secret,
    });
    
    let totalBankBalance = 0;
    const accountDetails = [];
    
    for (const item of savedItems) {
      try {
        console.log(`[REAL-BALANCES] Buscando saldos para item ${item.item_id} (${item.bank_name})`);
        
        const accounts = await pluggyClient.fetchAccounts(item.item_id);
        const accountsArray = accounts?.results || accounts || [];
        
        for (const account of accountsArray) {
          if (account.type === 'BANK') {
            totalBankBalance += account.balance || 0;
          }
          
          const detail = {
            itemId: item.item_id,
            accountId: account.id, // ID da conta no Pluggy (necessário para buscar faturas)
            bankName: item.bank_name,
            ownerName: item.owner_name,
            accountName: account.name,
            accountType: account.type,
            balance: account.balance || 0,
            // Dados específicos de cartão de crédito
            creditLimit: account.creditData?.creditLimit || 0,
            availableLimit: account.creditData?.availableCreditLimit || 0,
            dueDate: account.creditData?.balanceDueDate || null,
          };
          accountDetails.push(detail);
        }
      } catch (error) {
        console.error(`[REAL-BALANCES] Erro ao buscar saldos do item ${item.item_id}:`, error.message);
      }
    }
    
    // Buscar FATURAS REAIS de cada cartão de crédito usando o endpoint /bills do Pluggy
    const creditCardBillsDetailed = [];
    let totalCreditCardBalance = 0;
    
    // Determinar qual mês de fatura queremos
    const { period } = req.query;
    let targetYear, targetMonth;
    if (period && period !== 'all') {
      [targetYear, targetMonth] = period.split('-').map(Number);
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }
    
    // Para cada conta de cartão de crédito, buscar as faturas
    for (const acc of accountDetails) {
      if (acc.accountType === 'CREDIT' && acc.accountId) {
        try {
          console.log(`[REAL-BALANCES] Buscando faturas para ${acc.ownerName} ${acc.bankName} (${acc.accountId})`);
          const bills = await pluggyClient.fetchBills(acc.accountId);
          
          // Encontrar a fatura do mês desejado
          // IMPORTANTE: A fatura de um mês X VENCE no mês X+1
          // Ex: fatura de Dezembro/2025 vence em Janeiro/2026
          // Então se o usuário quer ver "Dezembro", buscamos a fatura que vence em JANEIRO
          let currentBill = null;
          
          // Calcular o mês de vencimento esperado (mês seguinte ao selecionado)
          let expectedDueMonth = targetMonth + 1;
          let expectedDueYear = targetYear;
          if (expectedDueMonth > 12) {
            expectedDueMonth = 1;
            expectedDueYear = targetYear + 1;
          }
          
          console.log(`[REAL-BALANCES] Buscando fatura de ${targetMonth}/${targetYear} (vence em ${expectedDueMonth}/${expectedDueYear})`);
          
          // Ordenar faturas por data de vencimento (mais recente primeiro)
          const sortedBills = [...bills].sort((a, b) => 
            new Date(b.dueDate) - new Date(a.dueDate)
          );
          
          // Buscar fatura que vence no mês SEGUINTE ao selecionado
          for (const bill of sortedBills) {
            const dueDate = new Date(bill.dueDate);
            const billDueYear = dueDate.getFullYear();
            const billDueMonth = dueDate.getMonth() + 1;
            
            // A fatura do mês X vence no mês X+1
            if (billDueYear === expectedDueYear && billDueMonth === expectedDueMonth) {
              currentBill = bill;
              console.log(`[REAL-BALANCES] Fatura encontrada: vence ${bill.dueDate}, valor ${bill.totalAmount}`);
              break;
            }
          }
          
          // Se não encontrou no mês esperado, a fatura desse mês ainda não fechou
          // NÃO usar a fatura do mês anterior, calcular dos gastos
          
          // Se não encontrou a fatura (mês ainda não fechou), calcular das transações
          if (!currentBill) {
            // Determinar ciclo específico de cada cartão:
            // - Itaú Larissa: começa dia 28, termina dia 27
            // - Nubank Larissa: começa dia 27, termina dia 26
            // - Robert (qualquer banco): começa dia 29, termina dia 28
            let cycleStartDay, cycleEndDay;
            
            if (acc.bankName === 'Itaú' && acc.ownerName === 'Larissa Purkot') {
              // Itaú Larissa: 28 até 27
              cycleStartDay = 28;
              cycleEndDay = 27;
            } else if (acc.bankName === 'Nubank' && acc.ownerName === 'Larissa Purkot') {
              // Nubank Larissa: 27 até 26
              cycleStartDay = 27;
              cycleEndDay = 26;
            } else if (acc.ownerName === 'Robert Oliveira' || acc.ownerName === 'Robert') {
              // Robert: 29 até 28
              cycleStartDay = 29;
              cycleEndDay = 28;
            } else {
              // Padrão: 29 até 28
              cycleStartDay = 29;
              cycleEndDay = 28;
            }
            
            // Calcular período do ciclo do cartão
            // Data de início: cycleStartDay do mês ANTERIOR
            const startDate = new Date(targetYear, targetMonth - 2, cycleStartDay);
            
            // Data de fim: cycleEndDay do mês atual
            const today = new Date();
            const targetEndDate = new Date(targetYear, targetMonth - 1, cycleEndDay);
            
            // Sempre usar o dia de término do ciclo, mesmo que hoje seja antes
            // (para garantir que o ciclo completo seja calculado)
            const endDate = targetEndDate;
            
            // Formatar datas com horário completo
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            // Incluir horário completo: início às 00:00:00 e fim às 23:59:59
            const startDateStrWithTime = startDateStr + 'T00:00:00';
            const endDateStrWithTime = endDateStr + 'T23:59:59';
            
            console.log(`[REAL-BALANCES] Fatura de ${targetMonth}/${targetYear} não encontrada`);
            console.log(`[REAL-BALANCES] ${acc.ownerName} ${acc.bankName}: ciclo ${cycleStartDay}/${targetMonth-1} até ${cycleEndDay}/${targetMonth}`);
            console.log(`[REAL-BALANCES] Período: ${startDateStrWithTime} até ${endDateStrWithTime}`);
            
            // Buscar gastos do cartão no período
            // IMPORTANTE: Excluir "Pagamento recebido" da fatura anterior:
            // - Pagamentos ATÉ o dia de vencimento da fatura (são da fatura anterior)
            // - Pagamentos DEPOIS do vencimento são antecipados (devem ser contados)
            // Vencimentos típicos: Robert dia 8, Larissa Nubank dia 4, Larissa Itaú dia 5
            
            // Determinar dia de vencimento baseado no cartão
            let dueDay = 6; // Robert: vence dia 6
            if (acc.ownerName === 'Larissa Purkot') {
              dueDay = 5; // Larissa: vence dia 5 (Nubank e Itaú)
            }
            
            // Data limite: vencimento da fatura (pagamentos até essa data são da fatura anterior)
            const dueDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
            
            console.log(`[REAL-BALANCES] ${acc.ownerName} ${acc.bankName}: excluindo pagamentos até ${dueDateStr}`);
            
            const result = database.prepare(`
              SELECT 
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as gastos,
                SUM(CASE 
                  WHEN amount > 0 
                    AND NOT (
                      description LIKE '%Pagamento recebido%' 
                      AND date <= ?
                    )
                  THEN amount 
                  ELSE 0 
                END) as creditos
              FROM transactions 
              WHERE account_type = 'CREDIT' 
                AND bank_name = ?
                AND owner_name = ?
                AND date >= ?
                AND date <= ?
            `).get(dueDateStr + 'T23:59:59', acc.bankName, acc.ownerName, startDateStrWithTime, endDateStrWithTime);
            
            const gastos = result?.gastos || 0;
            const creditos = result?.creditos || 0;
            const calculatedBill = gastos - creditos;
            
            // Para Itaú Larissa, sempre mostrar ciclo até dia 28, mesmo que hoje seja antes
            const cicloEndDate = (acc.bankName === 'Itaú' && acc.ownerName === 'Larissa Purkot')
              ? targetEndDate.toISOString().split('T')[0]
              : endDateStr;
            
            creditCardBillsDetailed.push({
              ownerName: acc.ownerName,
              bankName: acc.bankName,
              accountName: acc.accountName,
              total: calculatedBill,
              isOpen: true, // Fatura em aberto (calculada)
              gastos: gastos,
              creditos: creditos,
              ciclo: `${startDateStr.slice(8,10)}/${startDateStr.slice(5,7)} - ${endDateStr.slice(8,10)}/${endDateStr.slice(5,7)}`,
            });
            totalCreditCardBalance += calculatedBill;
            console.log(`[REAL-BALANCES] Fatura em aberto calculada: R$ ${calculatedBill.toFixed(2)} (gastos: ${gastos.toFixed(2)}, créditos: ${creditos.toFixed(2)})`);
          } else {
            const billAmount = currentBill.totalAmount || 0;
            creditCardBillsDetailed.push({
              ownerName: acc.ownerName,
              bankName: acc.bankName,
              accountName: acc.accountName,
              total: billAmount,
              dueDate: currentBill.dueDate,
              minimumPayment: currentBill.minimumPaymentAmount || 0,
              isOpen: false, // Fatura fechada (do Pluggy)
            });
            totalCreditCardBalance += billAmount;
            console.log(`[REAL-BALANCES] Fatura fechada: R$ ${billAmount.toFixed(2)} (vence ${currentBill.dueDate})`);
          }
        } catch (error) {
          console.error(`[REAL-BALANCES] Erro ao buscar faturas para ${acc.accountId}:`, error.message);
          // Fallback: usar o saldo devedor
          creditCardBillsDetailed.push({
            ownerName: acc.ownerName,
            bankName: acc.bankName,
            accountName: acc.accountName,
            total: acc.balance || 0,
            dueDate: acc.dueDate,
            fallback: true,
          });
          totalCreditCardBalance += acc.balance || 0;
        }
      }
    }
    
    // Ordenar por pessoa e banco
    creditCardBillsDetailed.sort((a, b) => {
      if (a.ownerName !== b.ownerName) return a.ownerName.localeCompare(b.ownerName);
      return a.bankName.localeCompare(b.bankName);
    });
    
    console.log(`[REAL-BALANCES] Faturas calculadas:`, creditCardBillsDetailed);
    console.log(`[REAL-BALANCES] Total Cartões: R$ ${totalCreditCardBalance.toFixed(2)}`);
    console.log(`[REAL-BALANCES] Total Conta Corrente: R$ ${totalBankBalance.toFixed(2)}`);
    
    res.json({
      bankBalance: totalBankBalance,
      creditCardBalance: totalCreditCardBalance, // Saldo real total dos cartões
      creditCardBillsDetailed: creditCardBillsDetailed, // Saldos reais por pessoa/banco
      accounts: accountDetails,
    });
  } catch (error) {
    console.error('[REAL-BALANCES] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== EMPRÉSTIMOS ==========
app.get('/api/loans', (req, res) => {
  try {
    const database = getDB();
    // Buscar todas as transações de empréstimo
    const loans = database.prepare(`
      SELECT 
        id,
        date,
        description,
        amount,
        bank_name,
        owner_name,
        account_type
      FROM transactions
      WHERE category = 'Empréstimo'
      ORDER BY date DESC
    `).all();

    // Agrupar empréstimos por descrição (normalizada)
    const loansByDescription = {};
    
    loans.forEach(loan => {
      // Normalizar descrição para agrupar (remover números de parcela, etc)
      const normalizedDesc = loan.description
        .replace(/\d+\/\d+/g, '') // Remove padrões como "150/150"
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      
      if (!loansByDescription[normalizedDesc]) {
        loansByDescription[normalizedDesc] = {
          description: loan.description,
          normalizedDescription: normalizedDesc,
          bankName: loan.bank_name,
          ownerName: loan.owner_name,
          accountType: loan.account_type,
          transactions: [],
          totalAmount: 0,
          totalPaid: 0,
          installments: []
        };
      }
      
      loansByDescription[normalizedDesc].transactions.push(loan);
      loansByDescription[normalizedDesc].totalAmount += Math.abs(loan.amount);
      
      // Detectar número de parcelas da descrição
      const installmentMatch = loan.description.match(/(\d+)\/(\d+)/);
      if (installmentMatch) {
        const currentInstallment = parseInt(installmentMatch[1]);
        const totalInstallments = parseInt(installmentMatch[2]);
        loansByDescription[normalizedDesc].installments.push({
          current: currentInstallment,
          total: totalInstallments,
          amount: Math.abs(loan.amount),
          date: loan.date
        });
        loansByDescription[normalizedDesc].totalPaid += Math.abs(loan.amount);
      } else {
        // Se não tem padrão de parcela, assumir que é uma parcela única
        loansByDescription[normalizedDesc].totalPaid += Math.abs(loan.amount);
      }
    });

    // Processar cada empréstimo para calcular estatísticas
    const loansList = Object.values(loansByDescription).map(loan => {
      // Determinar tipo de empréstimo
      let loanType = 'Outro';
      if (loan.normalizedDescription.includes('CONSIGNADO')) {
        loanType = 'Consignado';
      } else if (loan.normalizedDescription.includes('PESSOAL')) {
        loanType = 'Pessoal';
      } else if (loan.normalizedDescription.includes('IMOBILIARIO') || loan.normalizedDescription.includes('IMOBILIÁRIO')) {
        loanType = 'Imobiliário';
      } else if (loan.normalizedDescription.includes('VEICULO') || loan.normalizedDescription.includes('VEÍCULO')) {
        loanType = 'Veículo';
      }

      // Calcular parcelas pagas e faltantes
      let paidInstallments = 0;
      let totalInstallments = 0;
      let remainingAmount = 0;

      if (loan.installments.length > 0) {
        // Pegar o maior número de parcelas totais
        totalInstallments = Math.max(...loan.installments.map(i => i.total));
        paidInstallments = loan.installments.length;
        
        // Calcular valor faltante (assumindo parcelas iguais)
        const avgInstallment = loan.totalPaid / paidInstallments;
        remainingAmount = (totalInstallments - paidInstallments) * avgInstallment;
      } else {
        // Se não tem padrão de parcelas, usar número de transações como parcelas pagas
        paidInstallments = loan.transactions.length;
        // Tentar inferir total de parcelas do número na descrição (ex: "150" em "CREDITO CONSIGNADO 150")
        const numberMatch = loan.description.match(/\b(\d+)\b/);
        if (numberMatch) {
          const possibleTotal = parseInt(numberMatch[1]);
          // Se o número parece ser um total de parcelas (entre 1 e 500)
          if (possibleTotal >= paidInstallments && possibleTotal <= 500) {
            totalInstallments = possibleTotal;
          } else {
            // Se não, assumir que o número de transações é o total (empréstimo já pago)
            totalInstallments = paidInstallments;
          }
        } else {
          // Se não conseguiu inferir, assumir que todas as parcelas foram pagas
          totalInstallments = paidInstallments;
        }
        remainingAmount = 0; // Se não tem padrão, assumir que está pago
      }

      return {
        id: loan.normalizedDescription,
        type: loanType,
        description: loan.description,
        bankName: loan.bankName || 'Não informado',
        ownerName: loan.ownerName || 'Não informado',
        accountType: loan.accountType,
        totalAmount: loan.totalAmount,
        totalPaid: loan.totalPaid,
        remainingAmount: Math.max(0, remainingAmount),
        paidInstallments,
        totalInstallments,
        progress: totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 100,
        transactions: loan.transactions.map(t => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: t.amount
        }))
      };
    });

    // Ordenar por dono e banco
    loansList.sort((a, b) => {
      if (a.ownerName !== b.ownerName) return a.ownerName.localeCompare(b.ownerName);
      if (a.bankName !== b.bankName) return a.bankName.localeCompare(b.bankName);
      return b.totalAmount - a.totalAmount;
    });

    res.json({
      loans: loansList,
      summary: {
        total: loansList.length,
        totalAmount: loansList.reduce((sum, loan) => sum + loan.totalAmount, 0),
        totalPaid: loansList.reduce((sum, loan) => sum + loan.totalPaid, 0),
        totalRemaining: loansList.reduce((sum, loan) => sum + loan.remainingAmount, 0)
      }
    });
  } catch (error) {
    console.error('[LOANS] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Registrar todas as rotas antes de iniciar o servidor
console.log('📋 Rotas registradas:');
console.log('  GET  /api/pluggy/connectors');
console.log('  GET  /api/pluggy/items');
console.log('  GET  /api/pluggy/real-balances');
console.log('  GET  /api/loans');
console.log('  POST /api/pluggy/token');
console.log('  POST /api/pluggy/sync');
console.log('  POST /api/pluggy/create-item');
console.log('  GET  /api/pluggy/item/:itemId');
console.log('  POST /api/pluggy/item/:itemId/mfa');

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 API disponível em http://localhost:${PORT}/api`);
  console.log(`💾 Banco de dados em: ${getDbPath()}`);
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso. Tente usar outra porta ou feche o processo que está usando.`);
  } else {
    console.error('❌ Erro ao iniciar servidor:', error);
  }
  process.exit(1);
});
