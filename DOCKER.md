# 🐳 Executando com Docker/Colima

Esta é a forma mais fácil de executar o aplicativo, sem se preocupar com versões do Node.js ou problemas de compilação.

## 📋 Pré-requisitos

1. **Instalar Colima** (alternativa leve ao Docker Desktop):
   ```bash
   brew install colima docker
   ```
   
   **Nota:** Versões recentes do Docker incluem `docker compose` (sem hífen). Se precisar do `docker-compose` antigo:
   ```bash
   brew install docker-compose
   ```

2. **Iniciar Colima**:
   ```bash
   colima start
   ```

## 🚀 Como Usar

### Opção 1: Script Automático (Recomendado)

```bash
./docker-start.sh
```

### Opção 2: Manual

```bash
# Construir a imagem
docker-compose build

# Iniciar o aplicativo
docker-compose up
```

## ✅ O que vai acontecer

1. O Docker vai construir uma imagem com Node.js 24
2. Vai instalar todas as dependências
3. Vai compilar o better-sqlite3 corretamente
4. Vai iniciar o servidor na porta 3000
5. Vai iniciar o Vite na porta 5173
6. O navegador vai abrir automaticamente

## 🌐 Acessar o Aplicativo

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api

## 🛑 Parar o Aplicativo

```bash
./docker-stop.sh
```

Ou:

```bash
docker-compose down
```

## 📁 Dados Persistem

O banco de dados SQLite é salvo em `./data/financas.db` e persiste mesmo após parar o container.

## 🔧 Comandos Úteis

```bash
# Ver logs
docker-compose logs -f

# Entrar no container
docker-compose exec app sh

# Reconstruir após mudanças no Dockerfile
docker-compose build --no-cache

# Parar e remover tudo
docker-compose down -v
```

## ❌ Troubleshooting

### Colima não inicia
```bash
colima start --cpu 2 --memory 4
```

### Porta já em uso
Edite `docker-compose.yml` e mude as portas:
```yaml
ports:
  - "3001:3000"  # Backend na porta 3001
  - "5174:5173"  # Frontend na porta 5174
```

### Reconstruir do zero
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

