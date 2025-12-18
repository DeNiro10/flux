// Script rápido para verificar se o servidor pode iniciar
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

console.log('🔍 Verificando ambiente...');
console.log('Node version:', process.version);

const dbPath = path.join(process.cwd(), 'data', 'financas.db');
const dir = path.dirname(dbPath);

console.log('📁 Diretório do banco:', dir);
console.log('💾 Caminho do banco:', dbPath);

try {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('✅ Diretório criado');
  }

  console.log('🔄 Tentando abrir banco de dados...');
  const db = new Database(dbPath);
  console.log('✅ Banco de dados aberto com sucesso!');
  
  db.exec('SELECT 1');
  console.log('✅ Query de teste funcionou!');
  
  db.close();
  console.log('\n✅✅✅ TUDO OK! O servidor deve funcionar. ✅✅✅\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ ERRO:', error.message);
  console.error('\n💡 Execute:');
  console.error('   source ~/.nvm/nvm.sh');
  console.error('   nvm use 24');
  console.error('   npm rebuild better-sqlite3\n');
  process.exit(1);
}

