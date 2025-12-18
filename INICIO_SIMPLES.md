# 🚀 INÍCIO SIMPLES - Execute Agora

## ⚠️ O servidor não está rodando!

O erro `ERR_CONNECTION_REFUSED` significa que o servidor na porta 3000 não está ativo.

## ✅ SOLUÇÃO RÁPIDA

Execute este comando COMPLETO (copie e cole tudo):

```bash
cd financas-local && source ~/.nvm/nvm.sh && nvm use 24 && npm rebuild better-sqlite3 && npm run dev
```

## 📋 Ou passo a passo:

1. Abra um terminal
2. Execute cada comando:

```bash
cd financas-local
source ~/.nvm/nvm.sh
nvm use 24
npm rebuild better-sqlite3
npm run dev
```

## ✅ Como saber se funcionou?

No terminal você deve ver:

```
✅ Banco de dados inicializado
🚀 Servidor rodando em http://localhost:3000
📊 API disponível em http://localhost:3000/api
```

E o navegador deve abrir automaticamente.

## ❌ Se ainda não funcionar

Verifique o terminal onde você executou `npm run dev`. Deve aparecer uma mensagem de erro específica. 

Se aparecer algo sobre `better-sqlite3`, execute:

```bash
rm -rf node_modules/better-sqlite3
npm install better-sqlite3
npm rebuild better-sqlite3
npm run dev
```

