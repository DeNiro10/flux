#!/bin/bash

# Script para fazer push para GitHub usando Personal Access Token

echo "🚀 Fazendo push para GitHub..."
echo ""
echo "📝 Você precisará de um Personal Access Token do GitHub"
echo "   Se ainda não tem, crie em: https://github.com/settings/tokens"
echo "   Escopo necessário: 'repo'"
echo ""

# Verificar se já está configurado
git remote -v | grep -q "DeNiro10" && echo "✅ Remote configurado para DeNiro10" || echo "⚠️  Remote não configurado"

echo ""
echo "🔐 Quando pedir a senha, use seu Personal Access Token (não sua senha do GitHub)"
echo ""

# Tentar fazer push
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Push realizado com sucesso!"
    echo "🌐 Acesse: https://github.com/DeNiro10/flux"
else
    echo ""
    echo "❌ Erro ao fazer push"
    echo ""
    echo "💡 Soluções:"
    echo "   1. Certifique-se de ter um Personal Access Token"
    echo "   2. Use o token como senha quando pedir"
    echo "   3. Ou configure SSH (mais seguro)"
    echo ""
    echo "📖 Veja GITHUB.md para mais detalhes"
fi



