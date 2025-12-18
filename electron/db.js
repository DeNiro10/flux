import Database from 'better-sqlite3';
import electron from 'electron';
const { app } = electron;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export function initDB() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'financas.db');
  
  db = new Database(dbPath);
  
  // Criar tabelas
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

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_id);
  `);

  // Inserir regras padrão
  const insertRule = db.prepare('INSERT OR IGNORE INTO rules (keyword, category) VALUES (?, ?)');
  const defaultRules = [
    ['Uber', 'Transporte'],
    ['99', 'Transporte'],
    ['iFood', 'Refeição'],
    ['Rappi', 'Refeição'],
    ['Amazon', 'Compras'],
    ['Mercado', 'Mercado'],
    ['Supermercado', 'Mercado'],
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

  console.log('Banco de dados inicializado em:', dbPath);
}

function categorize(description) {
  if (!db) {
    return 'Outros';
  }

  const descriptionLower = description.toLowerCase();
  
  // Buscar regras que correspondem à descrição
  const rules = db.prepare('SELECT keyword, category FROM rules').all();
  
  for (const rule of rules) {
    if (descriptionLower.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }

  return 'Outros';
}

export { categorize };

export async function syncTransactions(transactions, accountId) {
  if (!db) {
    throw new Error('Banco de dados não inicializado');
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions 
    (provider_id, date, amount, description, category, source, type, account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((transactions) => {
    let count = 0;
    for (const tx of transactions) {
      const providerId = tx.id || `${accountId}-${tx.date}-${tx.amount}-${tx.description}`;
      
      // Normalizar valor: se for DEBIT e positivo, converter para negativo
      let amount = parseFloat(tx.amount) || 0;
      if (tx.type === 'DEBIT' && amount > 0) {
        amount = -Math.abs(amount);
      } else if (tx.type === 'CREDIT' && amount < 0) {
        amount = Math.abs(amount);
      }

      const category = categorize(tx.description || '');
      
      try {
        insert.run(
          providerId,
          tx.date || new Date().toISOString(),
          amount,
          tx.description || 'Sem descrição',
          category,
          'pluggy',
          tx.type || 'DEBIT',
          accountId
        );
        count++;
      } catch (error) {
        // Ignorar erros de duplicata (UNIQUE constraint)
        if (!error.message.includes('UNIQUE constraint')) {
          console.error('Erro ao inserir transação:', error);
        }
      }
    }
    return count;
  });

  return insertMany(transactions);
}

export async function updateTransactionCategory(transactionId, category) {
  if (!db) {
    throw new Error('Banco de dados não inicializado');
  }

  // Atualizar a transação
  const update = db.prepare('UPDATE transactions SET category = ? WHERE id = ?');
  update.run(category, transactionId);

  // Buscar a descrição da transação para criar regra
  const transaction = db.prepare('SELECT description FROM transactions WHERE id = ?').get(transactionId);
  
  if (transaction && transaction.description) {
    // Extrair primeira palavra da descrição como keyword
    const firstWord = transaction.description.split(/\s+/)[0].toLowerCase();
    
    // Inserir ou atualizar regra
    const insertRule = db.prepare('INSERT OR REPLACE INTO rules (keyword, category) VALUES (?, ?)');
    insertRule.run(firstWord, category);
  }
}

export function getDashboardData() {
  if (!db) {
    throw new Error('Banco de dados não inicializado');
  }

  // Buscar todas as transações
  const transactions = db.prepare(`
    SELECT * FROM transactions 
    ORDER BY date DESC 
    LIMIT 100
  `).all();

  // Calcular total por categoria
  const categoryTotals = db.prepare(`
    SELECT 
      category,
      SUM(amount) as total
    FROM transactions
    WHERE amount < 0
    GROUP BY category
    ORDER BY total ASC
  `).all();

  // Calcular saldo total
  const balanceResult = db.prepare('SELECT SUM(amount) as total FROM transactions').get();
  const totalBalance = balanceResult?.total || 0;

  // Calcular gastos do mês atual
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  
  const monthExpensesResult = db.prepare(`
    SELECT SUM(amount) as total 
    FROM transactions 
    WHERE amount < 0 AND date >= ? AND date <= ?
  `).get(monthStart, monthEnd);
  
  const monthExpenses = Math.abs(monthExpensesResult?.total || 0);

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
    monthExpenses: parseFloat(monthExpenses),
  };
}

