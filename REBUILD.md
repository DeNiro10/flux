# 🔧 Recompilar better-sqlite3

O `better-sqlite3` precisa ser compilado para a versão do Node.js que você está usando.

## Problema

O módulo foi compilado para Electron (NODE_MODULE_VERSION 125), mas o servidor usa Node.js v24 (NODE_MODULE_VERSION 137).

## Solução

Execute este comando para recompilar para Node.js:

```bash
cd financas-local
npm rebuild better-sqlite3
```

Ou use o script:

```bash
npm run rebuild:node
```

Depois disso, execute novamente:

```bash
npm run dev
```

## Nota

O `postinstall` agora recompila para ambas as versões (Node.js e Electron), então após `npm install` você não precisará fazer isso manualmente.

