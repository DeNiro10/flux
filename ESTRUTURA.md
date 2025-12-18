# 📁 Estrutura do Projeto

```
financas-local/
├── electron/                    # Código do Electron (Backend)
│   ├── main.js                  # Processo principal, handlers IPC
│   ├── preload.js               # ContextBridge seguro
│   └── db.js                    # Gerenciamento SQLite e lógica de negócio
│
├── src/                         # Código React (Frontend)
│   ├── App.jsx                  # Componente principal com dashboard
│   ├── main.jsx                 # Entry point React
│   ├── index.css                # Estilos Tailwind
│   └── electron.d.ts            # Type definitions para Electron API
│
├── index.html                   # HTML base
│
├── package.json                 # Dependências e scripts
├── vite.config.js              # Configuração Vite
├── tailwind.config.js          # Configuração TailwindCSS
├── postcss.config.js           # Configuração PostCSS
├── electron-builder.yml         # Configuração Electron Builder
│
├── README.md                    # Documentação principal
├── INSTALACAO.md               # Guia de instalação
└── .gitignore                  # Arquivos ignorados pelo Git
```

## Descrição dos Arquivos Principais

### `electron/main.js`
- Processo principal do Electron
- Gerencia a janela do aplicativo
- Define handlers IPC para comunicação com o frontend
- Inicializa o cliente Pluggy
- **IMPORTANTE:** Configure `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` aqui

### `electron/preload.js`
- Script de preload seguro
- Expõe API do Electron para o frontend via ContextBridge
- Garante segurança (contextIsolation)

### `electron/db.js`
- Gerencia o banco SQLite local
- Funções de categorização automática
- Sincronização de transações
- Queries para dashboard

### `src/App.jsx`
- Interface principal do usuário
- Dashboard com cards de resumo
- Gráfico de pizza (Recharts)
- Tabela de transações editável
- Integração com PluggyConnect

### `package.json`
- Scripts: `dev`, `build`, `preview`
- Todas as dependências necessárias
- Configuração para Electron

## Fluxo de Dados

```
Frontend (React) 
    ↓ IPC
Preload (ContextBridge)
    ↓ IPC
Main Process (Electron)
    ↓
SQLite (Local) + Pluggy API (Externa)
```

## Banco de Dados

**Localização:** `~/Library/Application Support/financas-local/financas.db`

**Tabelas:**
- `transactions`: Todas as transações sincronizadas
- `rules`: Regras de categorização por palavra-chave

## Handlers IPC

1. `get-dashboard` → Retorna dados do dashboard
2. `get-pluggy-token` → Obtém token de conexão Pluggy
3. `sync-pluggy` → Sincroniza transações do Pluggy
4. `update-category` → Atualiza categoria de transação

