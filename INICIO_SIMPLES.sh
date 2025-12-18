#!/bin/bash

# Script simples para iniciar o projeto

echo "🚀 Iniciando Finanças Local..."

cd "$(dirname "$0")"

# Carregar nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Usar Node.js 24
echo "📦 Usando Node.js 24..."
nvm use 24 2>/dev/null || {
  echo "⚠️  Node.js 24 não encontrado. Instalando..."
  nvm install 24
  nvm use 24
}

# Verificar se better-sqlite3 precisa ser recompilado
echo "🔍 Verificando dependências..."
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  echo "🔨 Recompilando better-sqlite3..."
  npm rebuild better-sqlite3
fi

# Iniciar
echo "✅ Iniciando servidor e frontend..."
echo ""
npm run dev

