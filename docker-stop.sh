#!/bin/bash

# Tentar docker compose (novo) ou docker-compose (antigo)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "❌ docker-compose não encontrado"
  exit 1
fi

echo "🛑 Parando containers..."
$DOCKER_COMPOSE down

