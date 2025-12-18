#!/bin/bash
# Script para rodar o projeto localmente sem Docker

# Carregar nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Usar Node 24
nvm use 24

# Instalar dependências (se necessário)
if [ ! -d "node_modules" ]; then
  echo "Instalando dependências..."
  npm install
  npm rebuild better-sqlite3
fi

# Rodar
npm run dev

