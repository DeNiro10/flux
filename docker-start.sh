#!/bin/bash

# Script para iniciar o aplicativo com Docker/Colima

echo "🐳 Iniciando Finanças Local com Docker..."

# Verificar se Colima está rodando
if ! colima status > /dev/null 2>&1; then
  echo "⚠️  Colima não está rodando. Iniciando..."
  colima start
fi

# Verificar se Docker está disponível
if ! docker ps > /dev/null 2>&1; then
  echo "❌ Docker não está disponível. Verifique se o Colima está rodando."
  exit 1
fi

# Configurar credenciais do Docker para Colima
if [ -f ~/.docker/config.json ]; then
  # Remover referência ao docker-credential-desktop se existir
  if grep -q "docker-credential-desktop" ~/.docker/config.json 2>/dev/null; then
    echo "🔧 Configurando credenciais do Docker para Colima..."
    # Criar backup
    cp ~/.docker/config.json ~/.docker/config.json.bak 2>/dev/null || true
    # Remover a referência problemática (manualmente ou via sed)
    echo "⚠️  Se houver erro de credenciais, edite ~/.docker/config.json e remova 'credsStore'"
  fi
fi

# Verificar se buildx está disponível
if ! docker buildx version > /dev/null 2>&1; then
  echo "⚠️  Docker buildx não encontrado. Tentando instalar..."
  docker buildx install || echo "⚠️  Buildx não instalado, mas pode funcionar mesmo assim"
fi

# Construir e iniciar containers
echo "🔨 Construindo imagem..."

# Tentar docker compose (novo) ou docker-compose (antigo)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "❌ docker-compose não encontrado. Instale com:"
  echo "   brew install docker-compose"
  echo "   ou use: docker compose (versão mais recente)"
  exit 1
fi

$DOCKER_COMPOSE build

echo "🚀 Iniciando aplicativo..."
echo ""
echo "✅ Acesse:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000/api"
echo ""
echo "Pressione Ctrl+C para parar"
echo ""
$DOCKER_COMPOSE up

