# 🚀 Como Subir o Código para o GitHub

Guia passo a passo para fazer upload do projeto para seu repositório GitHub pessoal.

## 📋 Pré-requisitos

1. **Conta no GitHub** (se não tiver, crie em https://github.com)
2. **Git instalado** (geralmente já vem no Mac/Linux)

Verificar se Git está instalado:
```bash
git --version
```

## 🎯 Passo a Passo

### 1. Criar Repositório no GitHub

1. Acesse https://github.com e faça login
2. Clique no botão **"+"** no canto superior direito
3. Selecione **"New repository"**
4. Preencha:
   - **Repository name**: `financas-local` (ou o nome que preferir)
   - **Description**: "Gerenciador Financeiro Pessoal Local-First"
   - **Visibility**: Escolha **Private** (recomendado) ou **Public**
   - **NÃO marque** "Initialize with README" (já temos um)
5. Clique em **"Create repository"**

### 2. Copiar a URL do Repositório

Após criar, o GitHub mostrará uma página com instruções. Você verá uma URL como:
```
https://github.com/seu-usuario/financas-local.git
```

**Copie essa URL** - você vai precisar dela!

### 3. Inicializar Git no Projeto

Abra o terminal na pasta do projeto e execute:

```bash
cd ~/Documents/robert/financas-local

# Inicializar git
git init

# Adicionar todos os arquivos
git add .

# Fazer primeiro commit
git commit -m "Initial commit: Flux - Controle Financeiro"
```

### 4. Conectar com o GitHub

```bash
# Adicionar o repositório remoto (substitua pela SUA URL)
git remote add origin https://github.com/SEU-USUARIO/financas-local.git

# Verificar se foi adicionado corretamente
git remote -v
```

### 5. Fazer Upload (Push)

```bash
# Renomear branch principal para main (se necessário)
git branch -M main

# Fazer upload para o GitHub
git push -u origin main
```

**Nota:** Se for a primeira vez usando Git no seu computador, pode pedir suas credenciais do GitHub. Use:
- **Username**: seu usuário do GitHub
- **Password**: use um **Personal Access Token** (não sua senha normal)

### 6. Criar Personal Access Token (se necessário)

Se o Git pedir senha e não aceitar sua senha normal:

1. Acesse: https://github.com/settings/tokens
2. Clique em **"Generate new token"** → **"Generate new token (classic)"**
3. Dê um nome: `financas-local`
4. Selecione escopo: **`repo`** (marcar a caixa)
5. Clique em **"Generate token"**
6. **COPIE O TOKEN** (você só verá uma vez!)
7. Use esse token como senha quando o Git pedir

## ✅ Verificar se Funcionou

1. Acesse seu repositório no GitHub: `https://github.com/SEU-USUARIO/financas-local`
2. Você deve ver todos os arquivos do projeto lá!

## 🔄 Atualizações Futuras

Sempre que fizer mudanças no código e quiser atualizar no GitHub:

```bash
# Ver o que mudou
git status

# Adicionar mudanças
git add .

# Fazer commit
git commit -m "Descrição das mudanças"

# Enviar para o GitHub
git push
```

## 🔐 Arquivos Sensíveis

⚠️ **IMPORTANTE:** O `.gitignore` já está configurado para NÃO enviar:
- `node_modules/` (dependências)
- `*.db` (banco de dados com seus dados)
- `dist/` (arquivos compilados)
- `.DS_Store` (arquivos do macOS)

**Nunca commite:**
- Credenciais da Pluggy
- Banco de dados com dados pessoais
- Arquivos `.env` com senhas

## 🛠️ Comandos Úteis

```bash
# Ver status das mudanças
git status

# Ver histórico de commits
git log

# Ver diferenças
git diff

# Desfazer mudanças não commitadas
git checkout -- arquivo.js

# Ver branches
git branch

# Criar nova branch
git checkout -b nome-da-branch
```

## ❌ Problemas Comuns

### Erro: "remote origin already exists"

```bash
# Remover o remote existente
git remote remove origin

# Adicionar novamente
git remote add origin https://github.com/SEU-USUARIO/financas-local.git
```

### Erro: "Authentication failed"

- Use Personal Access Token ao invés de senha
- Ou configure SSH keys (mais seguro)

### Erro: "Updates were rejected"

```bash
# Fazer pull primeiro (se houver mudanças no GitHub)
git pull origin main --allow-unrelated-histories

# Depois fazer push
git push -u origin main
```

## 🔐 Configurar Git (Primeira Vez)

Se for a primeira vez usando Git no seu computador:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

## 📝 Exemplo Completo

```bash
# 1. Ir para a pasta do projeto
cd ~/Documents/robert/financas-local

# 2. Inicializar git
git init

# 3. Adicionar arquivos
git add .

# 4. Primeiro commit
git commit -m "Initial commit: Flux - Controle Financeiro"

# 5. Adicionar remote (SUBSTITUA pela sua URL)
git remote add origin https://github.com/seu-usuario/financas-local.git

# 6. Renomear branch
git branch -M main

# 7. Fazer upload
git push -u origin main
```

---

**Pronto!** Seu código está no GitHub! 🎉

