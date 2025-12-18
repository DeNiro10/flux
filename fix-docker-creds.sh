#!/bin/bash

# Script para corrigir credenciais do Docker com Colima

echo "🔧 Corrigindo credenciais do Docker para Colima..."

# Criar diretório .docker se não existir
mkdir -p ~/.docker

# Backup do config existente
if [ -f ~/.docker/config.json ]; then
  cp ~/.docker/config.json ~/.docker/config.json.bak
  echo "✅ Backup criado: ~/.docker/config.json.bak"
fi

# Criar config.json sem credsStore problemático
cat > ~/.docker/config.json << 'EOF'
{
  "auths": {},
  "experimental": "enabled"
}
EOF

echo "✅ Configuração do Docker atualizada"
echo ""
echo "Agora execute: ./docker-start.sh"

