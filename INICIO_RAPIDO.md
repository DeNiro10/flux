# 🚀 Início Rápido

## Problema: Servidor não está rodando

Se você está vendo erros `ERR_CONNECTION_REFUSED` ou `500 Internal Server Error`, o servidor backend não está rodando.

## Solução

### 1. Instalar dependências (se ainda não instalou)

```bash
cd financas-local
npm install
```

### 2. Executar o aplicativo

```bash
npm run dev
```

Isso vai iniciar:
- ✅ Servidor backend na porta 3000
- ✅ Vite dev server na porta 5173
- ✅ Abrir navegador automaticamente

### 3. Verificar se está funcionando

No terminal, você deve ver:
```
🚀 Servidor rodando em http://localhost:3000
📊 API disponível em http://localhost:3000/api
💾 Banco de dados em: /caminho/para/data/financas.db
✅ Banco de dados inicializado
```

### 4. Se a porta 3000 estiver ocupada

Você pode mudar a porta editando `server.js`:
```javascript
const PORT = 3001; // ou outra porta
```

E atualizar `src/api.js`:
```javascript
const API_BASE = 'http://localhost:3001/api';
```

## Estrutura

- **Frontend:** http://localhost:5173 (Vite)
- **Backend API:** http://localhost:3000/api (Express)
- **Banco de dados:** `data/financas.db` (na pasta do projeto)

## Primeiros Passos

1. **Configure uma credencial Pluggy:**
   - Clique em "Gerenciar Credenciais"
   - Adicione seu Client ID e Client Secret
   - Marque como ativa

2. **Conecte uma conta:**
   - Clique em "Conectar Conta"
   - Selecione seu banco
   - Autorize a conexão

3. **Visualize suas transações:**
   - As transações aparecerão automaticamente no dashboard

## Troubleshooting

### Erro: "Porta já está em uso"
```bash
# Encontrar processo usando a porta
lsof -ti:3000

# Matar o processo
lsof -ti:3000 | xargs kill -9
```

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Banco de dados não encontrado"
O banco é criado automaticamente na primeira execução em `data/financas.db`

