# ⚡ Solução Rápida - Servidor Não Inicia

## Problema
O servidor não está iniciando porque o `better-sqlite3` precisa ser recompilado para Node.js.

## Solução em 3 Passos

### 1. Recompilar better-sqlite3
```bash
cd financas-local
source ~/.nvm/nvm.sh
nvm use 24
npm rebuild better-sqlite3
```

### 2. Verificar se funcionou
```bash
node server.js
```

Você deve ver:
```
🔄 Inicializando banco de dados...
✅ Banco de dados inicializado
🚀 Servidor rodando em http://localhost:3000
```

### 3. Se funcionou, execute o app completo
```bash
npm run dev
```

## Se ainda não funcionar

### Opção A: Reinstalar better-sqlite3
```bash
rm -rf node_modules/better-sqlite3
npm install better-sqlite3
npm rebuild better-sqlite3
```

### Opção B: Verificar versão do Node.js
```bash
node --version  # Deve ser v24.x.x
```

Se não for v24, execute:
```bash
source ~/.nvm/nvm.sh
nvm use 24
```

## Verificar se o servidor está rodando

Em outro terminal:
```bash
curl http://localhost:3000/api/dashboard
```

Se retornar JSON, está funcionando! ✅

