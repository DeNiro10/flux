# 🐳 Guia de Configuração Docker

Este guia explica como configurar e executar o aplicativo usando Docker em qualquer máquina.

## 📋 Pré-requisitos

### macOS
```bash
# Instalar Colima e Docker
brew install colima docker docker-compose

# Iniciar Colima
colima start
```

### Linux
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
# (faça logout e login novamente)

# Iniciar Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### Windows
```bash
# Instalar Docker Desktop
# Baixe de: https://www.docker.com/products/docker-desktop
```

## 🚀 Iniciar o Aplicativo

### Método 1: Script Automático (Recomendado)

```bash
# Dar permissão de execução (apenas primeira vez)
chmod +x docker-start.sh

# Iniciar
./docker-start.sh
```

### Método 2: Comandos Manuais

```bash
# Construir a imagem
docker compose build

# Iniciar os containers
docker compose up
```

### Método 3: Em Background

```bash
# Iniciar em background
docker compose up -d

# Ver logs
docker compose logs -f

# Parar
docker compose down
```

## 🔧 Solução de Problemas

### Erro: "concurrently: not found"

**Causa:** O `concurrently` não foi instalado corretamente.

**Solução:**
1. Verifique se o Dockerfile está usando `npm install --include=dev`
2. Reconstrua a imagem:
   ```bash
   docker compose build --no-cache
   docker compose up
   ```

### Erro: "Porta já em uso"

**Solução:**
```bash
# Verificar processos nas portas
lsof -ti:3000
lsof -ti:5173

# Parar processos
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Ou mudar as portas no docker-compose.yml
```

### Erro: "Permission denied" (Linux)

**Solução:**
```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Fazer logout e login novamente
# Ou executar com sudo (não recomendado)
```

### Erro: "Cannot connect to Docker daemon"

**macOS:**
```bash
# Verificar se Colima está rodando
colima status

# Se não estiver, iniciar
colima start
```

**Linux:**
```bash
# Iniciar serviço Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### Banco de dados não persiste

**Solução:**
```bash
# Criar diretório data se não existir
mkdir -p data

# Verificar permissões
chmod 755 data

# Verificar volume no docker-compose.yml
# Deve ter: ./data:/app/data
```

### Reconstruir do zero

```bash
# Parar e remover tudo
docker compose down -v

# Remover imagem
docker rmi financas-local

# Reconstruir
docker compose build --no-cache

# Iniciar
docker compose up
```

## 📝 Estrutura Docker

### Dockerfile
- Base: `node:24-alpine`
- Instala dependências do sistema (Python, make, g++, SQLite)
- Instala dependências npm (incluindo devDependencies)
- Expõe portas 3000 (backend) e 5173 (frontend)

### docker-compose.yml
- Serviço: `app`
- Portas: 3000:3000, 5173:5173
- Volumes:
  - `./:/app` - Código sincronizado (hot reload)
  - `/app/node_modules` - Node modules isolados
  - `./data:/app/data` - Banco de dados persistente

## 🔍 Verificar Status

```bash
# Ver containers rodando
docker ps

# Ver logs
docker compose logs -f

# Entrar no container
docker compose exec app sh

# Verificar processos dentro do container
docker compose exec app ps aux
```

## 🎯 Acessar o Aplicativo

Após iniciar com sucesso:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api

## 📦 Comandos Úteis

```bash
# Parar containers
docker compose down

# Parar e remover volumes
docker compose down -v

# Ver logs em tempo real
docker compose logs -f app

# Reconstruir sem cache
docker compose build --no-cache

# Limpar tudo (cuidado!)
docker compose down -v
docker system prune -a
```

## ✅ Checklist de Verificação

Antes de reportar problemas, verifique:

- [ ] Docker/Colima está rodando
- [ ] Portas 3000 e 5173 estão livres
- [ ] Diretório `data/` existe e tem permissões
- [ ] Imagem foi construída com sucesso (`docker compose build`)
- [ ] Containers estão rodando (`docker ps`)
- [ ] Logs não mostram erros (`docker compose logs`)

## 🆘 Ainda com Problemas?

1. Verifique os logs: `docker compose logs -f`
2. Reconstrua a imagem: `docker compose build --no-cache`
3. Limpe tudo e comece de novo:
   ```bash
   docker compose down -v
   docker compose build --no-cache
   docker compose up
   ```
