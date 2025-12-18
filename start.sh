#!/bin/bash

# Script para iniciar o aplicativo corretamente
# Garante que o Node.js correto está sendo usado

echo "🚀 Iniciando Finanças Local..."

# Carregar nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Usar Node.js 24
nvm use 24

# Verificar se better-sqlite3 está compilado corretamente
echo "🔍 Verificando better-sqlite3..."
if ! node test-server.js 2>/dev/null; then
  echo "⚠️  better-sqlite3 precisa ser recompilado..."
  echo "🔄 Recompilando..."
  npm rebuild better-sqlite3
fi

# Iniciar aplicativo
echo "✅ Iniciando servidor e frontend..."
npm run dev

