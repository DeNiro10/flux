# 💰 Flux - Controle Financeiro

Gerenciador Financeiro Pessoal Local-First com integração Pluggy (Open Finance). Gerencie suas finanças de forma privada e segura, com todos os dados armazenados localmente.

## ✨ Funcionalidades

- 📊 **Dashboard Completo**: Visão geral das finanças com gráficos e estatísticas
- 💳 **Múltiplas Contas**: Gerencie contas correntes e cartões de crédito de diferentes bancos
- 🔄 **Sincronização Automática**: Integração com Pluggy para sincronizar transações automaticamente
- 📈 **Análises Detalhadas**: Gráficos de gastos por categoria, período e tipo de conta
- 🏷️ **Categorização Inteligente**: Sistema automático de categorização de transações
- 💰 **Empréstimos**: Acompanhamento detalhado de empréstimos com parcelas e valores
- 🔐 **Local-First**: Todos os dados ficam no seu computador, privacidade garantida
- 🎨 **Interface Moderna**: Design dark/light mode com interface responsiva

## 📋 Requisitos

### Opção 1: Docker/Colima (Recomendado)
- Docker ou Colima instalado
- 4GB de RAM disponível

### Opção 2: Instalação Local
- Node.js 24 (recomendado usar nvm)
- npm ou yarn
- Python 3 (para compilar better-sqlite3)
- Build tools (make, g++)

## 🚀 Instalação

### Método 1: Docker/Colima (Mais Fácil)

#### 1. Instalar Colima e Docker

**macOS:**
```bash
brew install colima docker docker-compose
```

**Linux:**
```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose
sudo apt-get install docker-compose-plugin
```

#### 2. Iniciar Colima (macOS) ou Docker (Linux)

**macOS:**
```bash
colima start
```

**Linux:**
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

#### 3. Executar o Aplicativo

```bash
# Usar script automático
./docker-start.sh

# Ou manualmente
docker-compose up
```

**Pronto!** O aplicativo abrirá automaticamente no navegador em `http://localhost:5173`

### Método 2: Instalação Local

#### 1. Clonar/Entrar no Diretório

```bash
cd financas-local
```

#### 2. Instalar Node.js 24 (se usar nvm)

```bash
# Instalar nvm (se ainda não tiver)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Instalar Node.js 24
nvm install 24
nvm use 24
```

#### 3. Instalar Dependências

```bash
npm install
```

#### 4. Recompilar better-sqlite3

```bash
npm rebuild better-sqlite3
```

#### 5. Iniciar o Aplicativo

```bash
npm run dev
```

O aplicativo abrirá automaticamente no navegador.

## 🎯 Como Usar

### Primeira Configuração

1. **Acessar o Sistema**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api

2. **Configurar Credenciais Pluggy**
   - Vá em "Configurações" (ícone de engrenagem)
   - Clique em "Gerenciar Credenciais"
   - Adicione suas credenciais Pluggy (Client ID e Client Secret)
   - Marque uma como ativa

3. **Conectar Contas Bancárias**
   - Vá em "Configurações" → "Gerenciar Conexões"
   - Clique em "Nova Conexão"
   - Selecione o banco e preencha os dados
   - Salve e sincronize

4. **Sincronizar Transações**
   - Após conectar uma conta, clique em "Sincronizar"
   - As transações serão importadas automaticamente
   - O sistema categorizará automaticamente

### Funcionalidades Principais

#### 📊 Dashboard (Visão Geral)
- Visualize saldos, entradas, gastos e movimentações
- Acompanhe faturas de cartões de crédito
- Veja gastos por categoria com gráficos
- Filtre por período, banco, pessoa e tipo de conta

#### 💳 Transações
- Visualize todas as transações
- Edite categorias manualmente
- Filtre por período, banco, pessoa e categoria
- Separação entre Conta Corrente e Cartão de Crédito

#### 💰 Empréstimos
- Acompanhe todos os empréstimos
- Veja parcelas pagas e faltantes
- Calcule valores faltantes
- Filtre por tipo de empréstimo, banco e pessoa

#### 📈 Análises
- Gráficos de gastos por categoria
- Análise de entradas e saídas
- Comparação entre períodos

### Ciclos de Cartão de Crédito

O sistema suporta diferentes ciclos por cartão:

- **Itaú Larissa**: 28 até 27 (ex: 28/nov até 27/dez)
- **Nubank Larissa**: 27 até 26 (ex: 27/nov até 26/dez)
- **Robert (qualquer banco)**: 29 até 28 (ex: 29/nov até 28/dez)
- **Outros**: 29 até 28 (padrão)

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Iniciar servidor + frontend
npm run dev:server       # Apenas servidor backend
npm run dev:vite         # Apenas frontend

# Docker
npm run docker:start     # Iniciar com Docker
npm run docker:stop      # Parar Docker
npm run docker:build     # Construir imagem Docker
npm run docker:up        # Subir containers
npm run docker:down      # Parar containers

# Utilitários
npm run rebuild:node     # Recompilar better-sqlite3
npm run check            # Verificar se servidor pode iniciar
npm run test:server      # Testar servidor

# Build
npm run build            # Build para produção
npm run preview          # Preview do build
```

## 📁 Estrutura do Projeto

```
financas-local/
├── src/                    # Frontend React
│   ├── App.jsx            # Componente principal
│   ├── api.js             # Cliente API
│   ├── PluggyConnect.jsx  # Conexão Pluggy
│   └── ...
├── electron/              # Código Electron (opcional)
│   ├── main.js           # Processo principal
│   ├── db.js             # Banco de dados
│   └── ...
├── server.js              # Servidor Express (backend)
├── data/                  # Banco de dados SQLite
│   └── financas.db       # Arquivo do banco (criado automaticamente)
├── public/                # Arquivos estáticos
├── docker-compose.yml     # Configuração Docker
├── Dockerfile             # Imagem Docker
└── package.json          # Dependências e scripts
```

## 🔧 Tecnologias

- **Frontend:**
  - React 18
  - Vite
  - TailwindCSS
  - Recharts (gráficos)
  - Luxon (datas)

- **Backend:**
  - Node.js 24
  - Express.js
  - SQLite (better-sqlite3)
  - Pluggy API (Open Finance)

- **DevOps:**
  - Docker/Colima
  - Concurrently (executar múltiplos processos)

## 🐳 Docker

### Comandos Docker

```bash
# Iniciar
docker-compose up

# Iniciar em background
docker-compose up -d

# Parar
docker-compose down

# Ver logs
docker-compose logs -f

# Reconstruir
docker-compose build --no-cache

# Entrar no container
docker-compose exec app sh
```

### Volumes

- `./data:/app/data` - Banco de dados persiste localmente
- `./:/app` - Código sincronizado (hot reload)

## ❌ Troubleshooting

### Erro: "better-sqlite3 não compila"

```bash
# Recompilar
npm rebuild better-sqlite3

# Ou reinstalar
rm -rf node_modules/better-sqlite3
npm install better-sqlite3
npm rebuild better-sqlite3
```

### Erro: "Porta 3000 já em uso"

```bash
# Encontrar processo
lsof -ti:3000

# Matar processo
lsof -ti:3000 | xargs kill -9

# Ou mudar porta no server.js
```

### Erro: "Node.js versão incorreta"

```bash
# Usar nvm
source ~/.nvm/nvm.sh
nvm use 24

# Ou instalar Node 24
nvm install 24
```

### Docker não inicia

**Colima (macOS):**
```bash
colima start --cpu 2 --memory 4
```

**Docker (Linux):**
```bash
sudo systemctl start docker
sudo usermod -aG docker $USER
# (faça logout e login novamente)
```

### Banco de dados não persiste

Verifique se o diretório `data/` existe e tem permissões de escrita:

```bash
mkdir -p data
chmod 755 data
```

## 📖 Documentação Adicional

- [INSTALACAO.md](./INSTALACAO.md) - Guia detalhado de instalação
- [DOCKER.md](./DOCKER.md) - Guia completo de Docker
- [COMO_USAR.md](./COMO_USAR.md) - Guia de uso do sistema
- [INICIO_SIMPLES.md](./INICIO_SIMPLES.md) - Solução rápida de problemas

## 🔐 Segurança e Privacidade

- ✅ Todos os dados ficam no seu computador
- ✅ Banco de dados SQLite local
- ✅ Nenhum dado é enviado para servidores externos (exceto Pluggy para sincronização)
- ✅ Credenciais Pluggy armazenadas localmente e criptografadas

## 🚀 Próximos Passos

Após instalar:

1. Configure suas credenciais Pluggy
2. Conecte suas contas bancárias
3. Sincronize as transações
4. Explore o dashboard e análises
5. Ajuste categorias conforme necessário

## 📝 Licença

MIT

## 🤝 Contribuindo

Este é um projeto pessoal, mas sugestões e melhorias são bem-vindas!

## 📧 Suporte

Para problemas ou dúvidas, verifique:
1. A seção de Troubleshooting acima
2. Os arquivos de documentação na pasta do projeto
3. Os logs do servidor no terminal

---

**Desenvolvido com ❤️ para controle financeiro pessoal**
