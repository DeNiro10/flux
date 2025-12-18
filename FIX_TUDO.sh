#!/bin/bash

# Script para corrigir tudo e fazer funcionar

echo "🔧 Corrigindo tudo..."

cd "$(dirname "$0")"

# Carregar nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Usar Node.js 24
echo "📦 Usando Node.js 24..."
nvm use 24

# Recompilar better-sqlite3
echo "🔨 Recompilando better-sqlite3..."
npm rebuild better-sqlite3

# Verificar se funcionou
echo "✅ Verificando..."
if node check-server.js; then
  echo ""
  echo "✅✅✅ TUDO PRONTO! ✅✅✅"
  echo ""
  echo "🚀 Iniciando aplicativo..."
  echo ""
  npm run dev
else
  echo ""
  echo "❌ Ainda há problemas. Tente:"
  echo "   rm -rf node_modules/better-sqlite3"
  echo "   npm install better-sqlite3"
  echo "   npm rebuild better-sqlite3"
fi

