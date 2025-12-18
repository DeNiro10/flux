# 🧪 Guia de Teste Local - Finanças Local

Este documento explica como testar o projeto localmente e verificar se tudo está funcionando.

## ✅ Checklist Pré-Teste

Antes de começar, verifique:

- [ ] Node.js instalado (`node --version` funciona)
- [ ] npm instalado (`npm --version` funciona)
- [ ] Você está na pasta do projeto (`cd financas-local`)
- [ ] Dependências instaladas (`npm install` executado sem erros)
- [ ] Credenciais Pluggy configuradas em `electron/main.js`

## 🚀 Passo 1: Verificar Instalação

### 1.1: Verificar Node.js e npm

Abra o Terminal e execute:

```bash
node --version
npm --version
```

**Resultado esperado:** Versões do Node.js (v18+) e npm devem aparecer.

### 1.2: Verificar se está na pasta correta

```bash
cd ~/Documents/robert/financas-local
pwd
```

**Resultado esperado:** `/Users/seu-nome/Documents/robert/financas-local`

### 1.3: Verificar dependências instaladas

```bash
ls node_modules | head -5
```

**Resultado esperado:** Lista de pastas de dependências (react, electron, etc.)

## 🧪 Passo 2: Testar Compilação

### 2.1: Testar se o Vite compila

```bash
npm run dev:vite
```

**O que deve acontecer:**
- O Vite inicia na porta 5173
- Você verá: `➜  Local:   http://localhost:5173/`
- **NÃO feche este terminal!** Deixe rodando.

### 2.2: Verificar no navegador

Abra o navegador e acesse: `http://localhost:5173`

**Resultado esperado:**
- A página carrega (pode mostrar erros de Electron, isso é normal)
- Você vê a interface do aplicativo

**Para parar:** Pressione `Control + C` no terminal

## 🖥️ Passo 3: Testar Aplicativo Completo

### 3.1: Executar aplicativo Electron

Em um novo terminal (ou pare o Vite com Control+C e execute):

```bash
cd ~/Documents/robert/financas-local
npm run dev
```

**O que deve acontecer:**
1. O Vite inicia na porta 5173
2. Aguarda o Vite estar pronto
3. Abre a janela do Electron automaticamente
4. Você vê o dashboard do aplicativo

### 3.2: Verificar Interface

Na janela do Electron, verifique:

- [ ] **Header aparece** com "Finanças Local" e botão "Conectar Conta"
- [ ] **Cards de resumo** aparecem (mesmo que vazios)
- [ ] **Gráfico de pizza** aparece (pode estar vazio)
- [ ] **Tabela de transações** aparece (pode estar vazia)

**Se aparecer "Carregando dados..." e não sair:**
- Abra o DevTools (View → Toggle Developer Tools ou Cmd+Option+I)
- Verifique a aba Console para erros

## 🔍 Passo 4: Testar Funcionalidades

### 4.1: Testar Banco de Dados

O banco deve ser criado automaticamente. Verifique:

```bash
ls ~/Library/Application\ Support/financas-local/
```

**Resultado esperado:** Arquivo `financas.db` deve existir

### 4.2: Testar Conectar Conta (sem credenciais reais)

1. **Clique em "Conectar Conta"**
2. **Se aparecer erro sobre credenciais:**
   - ✅ Isso é esperado se você não configurou as credenciais
   - O erro deve ser claro: "Pluggy client não configurado"

3. **Se você configurou as credenciais:**
   - Deve abrir o modal de conexão
   - Pode testar a conexão (mas precisa de credenciais válidas)

### 4.3: Testar Categorização (com dados mock)

Se quiser testar sem conectar uma conta real, você pode inserir dados manualmente no banco:

```bash
# Usar sqlite3 (se instalado) ou DB Browser for SQLite
sqlite3 ~/Library/Application\ Support/financas-local/financas.db

# Inserir uma transação de teste
INSERT INTO transactions (provider_id, date, amount, description, category, source, type) 
VALUES ('test-1', '2024-12-16', -50.00, 'Uber Viagem', 'Transporte', 'manual', 'DEBIT');

# Verificar
SELECT * FROM transactions;

# Sair
.quit
```

Depois, recarregue o aplicativo e você deve ver a transação na tabela.

## 🐛 Passo 5: Verificar Erros Comuns

### Erro: "Cannot find module 'electron'"

**Solução:**
```bash
npm install
```

### Erro: "better-sqlite3 não compila" ou "NODE_MODULE_VERSION mismatch"

**Causa:** O `better-sqlite3` é um módulo nativo que precisa ser compilado para a versão do Node.js que o Electron usa internamente.

**Solução:**
```bash
# Instalar Xcode Command Line Tools (se necessário)
xcode-select --install

# Recompilar better-sqlite3 para Electron
npm run rebuild

# Ou manualmente:
npx electron-rebuild -f -w better-sqlite3
```

**Nota:** O script `postinstall` no package.json já faz isso automaticamente após `npm install`, mas se você encontrar o erro, execute `npm run rebuild`.

### Erro: "Pluggy client não configurado"

**Solução:**
1. Abra `electron/main.js`
2. Verifique se as credenciais estão configuradas (não devem ser 'INSIRA_AQUI')
3. Salve o arquivo
4. Reinicie o aplicativo

### Erro: Porta 5173 já em uso

**Solução:**
```bash
# Encontrar processo usando a porta
lsof -ti:5173

# Matar o processo
lsof -ti:5173 | xargs kill -9

# Tentar novamente
npm run dev
```

### Aplicativo não abre

**Verificações:**
1. Veja o terminal onde executou `npm run dev`
2. Procure por mensagens de erro em vermelho
3. Verifique se o Vite está rodando (deve mostrar URL localhost:5173)
4. Verifique se há erros no console do Electron (DevTools)

## 📊 Passo 6: Testar Fluxo Completo

### 6.1: Fluxo de Conexão (com credenciais válidas)

1. **Configure credenciais** em `electron/main.js`
2. **Reinicie o aplicativo**
3. **Clique em "Conectar Conta"**
4. **Selecione um banco** na interface Pluggy
5. **Autorize a conexão**
6. **Aguarde sincronização**
7. **Verifique transações** aparecendo na tabela

### 6.2: Fluxo de Categorização

1. **Clique na categoria** de uma transação
2. **Digite uma nova categoria** (ex: "Teste")
3. **Pressione Enter ou clique em "Salvar"**
4. **Verifique** se a categoria foi atualizada
5. **Verifique** se uma nova regra foi criada no banco

## ✅ Critérios de Sucesso

O projeto está funcionando corretamente se:

- ✅ O aplicativo abre sem erros
- ✅ A interface carrega completamente
- ✅ O banco de dados é criado automaticamente
- ✅ Os cards de resumo aparecem (mesmo que vazios)
- ✅ O gráfico aparece (mesmo que vazio)
- ✅ A tabela aparece (mesmo que vazia)
- ✅ O botão "Conectar Conta" funciona (mesmo que mostre erro se não tiver credenciais)
- ✅ Não há erros no console do DevTools

## 🔧 Debug Avançado

### Ver logs do Electron

No terminal onde executou `npm run dev`, você verá:
- Logs do Vite
- Logs do Electron
- Erros do backend

### Ver logs do Frontend

1. Abra DevTools no Electron (Cmd+Option+I)
2. Vá na aba Console
3. Procure por erros em vermelho

### Ver banco de dados

```bash
# Instalar sqlite3 (se não tiver)
brew install sqlite3

# Abrir banco
sqlite3 ~/Library/Application\ Support/financas-local/financas.db

# Ver tabelas
.tables

# Ver transações
SELECT * FROM transactions;

# Ver regras
SELECT * FROM rules;

# Sair
.quit
```

## 📝 Notas

- O aplicativo funciona mesmo sem credenciais Pluggy (apenas não consegue conectar contas)
- O banco é criado na primeira execução
- Transações só aparecem após conectar uma conta e sincronizar
- Você pode testar a interface mesmo sem dados reais

## 🆘 Precisa de Ajuda?

Se encontrar problemas:

1. **Copie a mensagem de erro completa** do terminal
2. **Tire um print** da tela se possível
3. **Verifique** se seguiu todos os passos do INSTALACAO.md
4. **Verifique** a versão do Node.js (`node --version`)

