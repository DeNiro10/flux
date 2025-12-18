// Script de teste rápido para verificar se o servidor pode iniciar
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'financas.db');

console.log('🔄 Testando better-sqlite3...');
console.log('Caminho do banco:', dbPath);

try {
  // Criar diretório se não existir
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  console.log('✅ better-sqlite3 funcionando!');
  
  // Testar uma query simples
  db.exec('SELECT 1');
  console.log('✅ Query de teste funcionou!');
  
  db.close();
  console.log('✅ Tudo OK! O servidor deve funcionar.');
  process.exit(0);
} catch (error) {
  console.error('❌ Erro:', error.message);
  console.error('\n💡 Execute: npm rebuild better-sqlite3');
  process.exit(1);
}

