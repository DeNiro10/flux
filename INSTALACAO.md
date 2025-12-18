# 📦 Guia de Instalação Completo - Finanças Local (macOS)

Este guia foi feito para pessoas que usam Mac e querem instalar o Finanças Local passo a passo, mesmo sem experiência técnica.

---

## 📋 O que você vai precisar

- Um Mac (qualquer versão recente do macOS)
- Conexão com a internet
- Cerca de 15-20 minutos do seu tempo
- Uma conta na Pluggy (vamos criar isso juntos)

---

## 🎯 Passo 1: Verificar se você tem o Terminal aberto

O Terminal é uma aplicação do Mac que permite executar comandos. Vamos usá-lo bastante.

### Como abrir o Terminal:

1. **Método 1 - Pelo Spotlight:**
   - Pressione `Command + Espaço` (⌘ + Espaço)
   - Digite "Terminal"
   - Pressione Enter

2. **Método 2 - Pelo Finder:**
   - Abra o Finder
   - Vá em "Aplicações" → "Utilitários"
   - Clique duas vezes em "Terminal"

3. **Método 3 - Pelo Launchpad:**
   - Abra o Launchpad (gesto de pinça com 4 dedos ou F4)
   - Digite "Terminal"
   - Clique no ícone

**Você verá uma janela preta com texto. Isso é normal! É o Terminal funcionando.**

---

## 🔍 Passo 2: Verificar se o Node.js está instalado

O Node.js é necessário para rodar o aplicativo. Vamos verificar se você já tem.

### No Terminal, digite exatamente isso e pressione Enter:

```bash
node --version
```

### Possíveis resultados:

**✅ Se aparecer algo como `v18.17.0` ou `v20.10.0`:**
- Ótimo! Você já tem o Node.js instalado.
- **Pule para o Passo 4** (Instalar dependências).

**❌ Se aparecer `command not found` ou `comando não encontrado`:**
- Você precisa instalar o Node.js.
- **Continue no Passo 3** para instalar.

---

## 📥 Passo 3: Instalar o Node.js (se necessário)

Se você não tem o Node.js, vamos instalar agora. Você tem duas opções:

---

### Opção A: Instalação usando nvm (Node Version Manager) ⭐ RECOMENDADO

O **nvm** é uma ferramenta que permite gerenciar múltiplas versões do Node.js facilmente. É a melhor opção para desenvolvedores.

#### 3.1: Baixar e instalar o nvm

No Terminal, digite exatamente este comando e pressione Enter:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

**O que vai acontecer:**
- O comando vai baixar e instalar o nvm automaticamente
- Você verá várias linhas de texto aparecendo
- Isso é normal! Aguarde terminar

#### 3.2: Carregar o nvm no Terminal atual

Depois que a instalação terminar, digite este comando:

```bash
\. "$HOME/.nvm/nvm.sh"
```

**O que isso faz:**
- Carrega o nvm no Terminal atual
- Permite usar o nvm sem precisar fechar e abrir o Terminal novamente

#### 3.3: Instalar o Node.js usando o nvm

Agora vamos instalar a versão mais recente do Node.js (versão 24):

```bash
nvm install 24
```

**O que vai acontecer:**
- O nvm vai baixar e instalar o Node.js versão 24
- Pode demorar alguns minutos
- Você verá mensagens de progresso

#### 3.4: Verificar se funcionou

Digite estes comandos para verificar:

```bash
node -v
```

**Resultado esperado:** Deve exibir `v24.12.0` ou similar (qualquer versão 24.x.x está ok)

```bash
npm -v
```

**Resultado esperado:** Deve imprimir `11.6.2` ou similar (qualquer versão 11.x.x está ok)

**✅ Se ambos os comandos mostraram números de versão, está funcionando!**

#### 3.5: Configurar o nvm para carregar automaticamente (Opcional mas recomendado)

Para que o nvm funcione automaticamente toda vez que você abrir o Terminal, adicione estas linhas ao seu arquivo de configuração:

1. **Digite este comando:**
   ```bash
   echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
   echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.zshrc
   ```

2. **Recarregue o Terminal:**
   ```bash
   source ~/.zshrc
   ```

**Pronto!** Agora o nvm vai funcionar automaticamente toda vez que você abrir o Terminal.

---

### Opção B: Instalação pelo site oficial (Método tradicional)

Se preferir instalar diretamente sem o nvm:

1. **Abra o navegador Safari ou Chrome**
2. **Acesse:** https://nodejs.org/
3. **Você verá dois botões grandes:**
   - Clique no botão **"LTS"** (Long Term Support) - é a versão mais estável
4. **O download começará automaticamente**
5. **Quando terminar, vá para a pasta Downloads:**
   - Abra o Finder
   - Clique em "Downloads" na barra lateral
   - Procure por um arquivo chamado algo como `node-v20.x.x.pkg`
6. **Clique duas vezes no arquivo .pkg**
7. **Siga o assistente de instalação:**
   - Clique em "Continuar" várias vezes
   - Quando pedir, digite sua senha do Mac
   - Clique em "Instalar"
8. **Aguarde a instalação terminar**
9. **Feche e abra o Terminal novamente** (importante!)

### Verificar se funcionou (para ambos os métodos):

No Terminal, digite novamente:
```bash
node --version
```

Se aparecer um número de versão (como `v20.10.0` ou `v24.12.0`), está funcionando! ✅

---

## 📂 Passo 4: Navegar até a pasta do projeto

Agora vamos abrir a pasta onde está o projeto.

### No Terminal, digite:

```bash
cd ~/Documents/robert/financas-local
```

**O que isso faz?**
- `cd` significa "change directory" (mudar de pasta)
- `~/Documents/robert/financas-local` é o caminho da pasta do projeto
- O `~` significa sua pasta pessoal (Home)

### Se você colocou o projeto em outro lugar:

1. **Abra o Finder**
2. **Navegue até a pasta `financas-local`**
3. **Clique com o botão direito na pasta**
4. **Selecione "Novos Serviços" → "Copiar Caminho"** (ou arraste a pasta para o Terminal)

**Dica:** Você pode arrastar a pasta diretamente para o Terminal e ele preenche o caminho automaticamente!

### Verificar se está na pasta certa:

Digite no Terminal:
```bash
pwd
```

Você deve ver algo como: `/Users/seu-nome/Documents/robert/financas-local`

---

## 🛠️ Passo 5: Instalar as dependências do projeto

Agora vamos instalar todas as bibliotecas e ferramentas que o projeto precisa.

### No Terminal (certifique-se de estar na pasta do projeto), digite:

```bash
npm install
```

### O que vai acontecer:

1. **Você verá muitas linhas de texto aparecendo**
   - Isso é normal! O npm está baixando e instalando pacotes
   - Pode demorar de 2 a 5 minutos, dependendo da sua internet

2. **Você verá mensagens como:**
   ```
   added 245 packages, and audited 246 packages in 2m
   ```
   - Isso significa que funcionou! ✅

3. **Se aparecer algum erro:**
   - Veja a seção "Solução de Problemas" mais abaixo

### ⚠️ Importante sobre o `better-sqlite3`:

Durante a instalação, você pode ver mensagens sobre compilação do `better-sqlite3`. Isso é normal e pode demorar um pouco mais. Se aparecer um erro, veja a seção de problemas abaixo.

---

## 🔑 Passo 6: Obter credenciais da Pluggy

A Pluggy é o serviço que conecta o aplicativo aos seus bancos. Vamos criar uma conta e obter as credenciais.

### 6.1: Criar conta na Pluggy

1. **Abra o navegador**
2. **Acesse:** https://dashboard.pluggy.ai/
3. **Clique em "Sign Up" ou "Criar Conta"**
4. **Preencha o formulário:**
   - Email
   - Senha
   - Confirme a senha
5. **Verifique seu email** (pode estar na pasta Spam)
6. **Faça login na conta**

### 6.2: Obter as credenciais (Client ID e Secret)

1. **Depois de fazer login, você verá o Dashboard**
2. **Procure por uma seção chamada:**
   - "API Keys"
   - "Credentials"
   - "Chaves de API"
   - Ou algo similar no menu lateral

3. **Se não encontrar:**
   - Procure por "Settings" ou "Configurações"
   - Ou "Developer" ou "Desenvolvedor"

4. **Você verá duas informações importantes:**
   - **Client ID** (ou ClientId) - uma string longa de letras e números
   - **Client Secret** (ou ClientSecret) - outra string longa

5. **Copie ambas as informações:**
   - Selecione o texto e pressione `Command + C` (⌘ + C)
   - Cole em um arquivo de texto temporário para não perder

**⚠️ IMPORTANTE:** Guarde essas informações com segurança! Elas são como senhas.

---

## ✏️ Passo 7: Configurar as credenciais no projeto

Agora vamos colocar suas credenciais da Pluggy no código do projeto.

### 7.1: Abrir o arquivo de configuração

1. **Abra o Finder**
2. **Navegue até a pasta do projeto:** `financas-local`
3. **Entre na pasta `electron`**
4. **Encontre o arquivo `main.js`**
5. **Clique duas vezes para abrir** (abrirá no editor padrão, ou use o Cursor/VS Code)

### 7.2: Encontrar as linhas corretas

No arquivo `main.js`, procure pelas linhas 11 e 12. Elas devem estar assim:

```javascript
const PLUGGY_CLIENT_ID = 'INSIRA_AQUI';
const PLUGGY_CLIENT_SECRET = 'INSIRA_AQUI';
```

### 7.3: Substituir as credenciais

1. **Substitua `INSIRA_AQUI` na linha 11 pelo seu Client ID:**
   ```javascript
   const PLUGGY_CLIENT_ID = 'seu-client-id-aqui';
   ```
   - Mantenha as aspas simples `'`
   - Cole seu Client ID entre as aspas

2. **Substitua `INSIRA_AQUI` na linha 12 pelo seu Client Secret:**
   ```javascript
   const PLUGGY_CLIENT_SECRET = 'seu-client-secret-aqui';
   ```
   - Mantenha as aspas simples `'`
   - Cole seu Client Secret entre as aspas

### 7.4: Salvar o arquivo

- Pressione `Command + S` (⌘ + S) para salvar
- Ou vá em Arquivo → Salvar

**Exemplo de como deve ficar:**
```javascript
const PLUGGY_CLIENT_ID = 'seu-client-id-aqui';
const PLUGGY_CLIENT_SECRET = 'seu-client-secret-aqui';
```

---

## 🚀 Passo 8: Executar o aplicativo

Agora é a hora de ver o aplicativo funcionando!

### 8.1: Voltar para o Terminal

Certifique-se de que você está na pasta do projeto:
```bash
cd ~/Documents/robert/financas-local
```

### 8.2: Iniciar o aplicativo

Digite no Terminal:
```bash
npm run dev
```

### 8.3: O que vai acontecer:

1. **Você verá várias mensagens no Terminal:**
   ```
   VITE v5.x.x  ready in xxx ms
   ➜  Local:   http://localhost:5173/
   ```
   - Isso significa que o servidor está rodando ✅

2. **Uma janela do aplicativo vai abrir automaticamente:**
   - É a janela do Finanças Local!
   - Você verá o dashboard com cards e gráficos

3. **Se aparecer uma janela de DevTools (ferramentas de desenvolvedor):**
   - Isso é normal em modo de desenvolvimento
   - Você pode fechar essa janela se quiser (não é obrigatório)

### 8.4: Se o aplicativo não abrir automaticamente:

1. **Verifique se há erros no Terminal**
2. **Aguarde alguns segundos** (pode demorar um pouco na primeira vez)
3. **Procure por uma janela do Electron na barra de aplicativos**

---

## 🎉 Passo 9: Usar o aplicativo pela primeira vez

Agora que o aplicativo está rodando, vamos testá-lo!

### 9.1: Conectar uma conta bancária

1. **Na janela do aplicativo, clique no botão "Conectar Conta"** (canto superior direito)
2. **Uma janela modal vai abrir** com a interface da Pluggy
3. **Selecione seu banco** na lista
4. **Siga as instruções** para autorizar a conexão
5. **Aguarde a sincronização** das transações

### 9.2: Explorar o dashboard

- **Cards de Resumo:** Veja seu saldo total e gastos do mês
- **Gráfico de Pizza:** Visualize seus gastos por categoria
- **Tabela de Transações:** Veja todas as suas transações recentes

### 9.3: Categorizar transações

1. **Na tabela de transações, clique na categoria** de qualquer transação
2. **Digite uma nova categoria** (ex: "Alimentação", "Transporte")
3. **Pressione Enter ou clique em "Salvar"**
4. **O sistema vai aprender** e aplicar essa categoria automaticamente no futuro!

---

## 🛑 Como parar o aplicativo

Quando quiser fechar o aplicativo:

1. **No Terminal, pressione:** `Control + C` (Ctrl + C)
   - Isso vai parar o servidor
   - A janela do aplicativo vai fechar automaticamente

2. **Ou simplesmente feche a janela do aplicativo**
   - O Terminal ainda vai mostrar o servidor rodando
   - Pressione `Control + C` no Terminal para parar completamente

---

## 🔧 Solução de Problemas Comuns

### ❌ Problema: "command not found: node"

**Causa:** Node.js não está instalado ou não está no PATH.

**Solução:**
1. Instale o Node.js seguindo o Passo 3
2. Feche e abra o Terminal novamente
3. Tente novamente: `node --version`

---

### ❌ Problema: "better-sqlite3 não compila" ou "NODE_MODULE_VERSION mismatch"

**Causa:** O `better-sqlite3` é um módulo nativo que precisa ser compilado para a versão do Node.js que o Electron usa. Pode também faltar o Xcode Command Line Tools.

**Solução:**
1. **Instale o Xcode Command Line Tools (se necessário):**
   ```bash
   xcode-select --install
   ```
   - Uma janela vai aparecer perguntando se você quer instalar
   - Clique em "Instalar"
   - Aguarde a instalação (pode demorar 10-15 minutos)

2. **Recompile o better-sqlite3 para Electron:**
   ```bash
   npm run rebuild
   ```
   
   Ou manualmente:
   ```bash
   npx electron-rebuild -f -w better-sqlite3
   ```

**Nota:** O script `postinstall` no package.json já faz isso automaticamente após `npm install`, mas se você encontrar o erro, execute `npm run rebuild`.

---

### ❌ Problema: "Pluggy client não configurado"

**Causa:** As credenciais não foram configuradas corretamente.

**Solução:**
1. Abra o arquivo `electron/main.js`
2. Verifique se as linhas 11-12 têm suas credenciais reais
3. Certifique-se de que as aspas simples `'` estão presentes
4. Certifique-se de que não há espaços extras
5. Salve o arquivo
6. Reinicie o aplicativo (`Control + C` no Terminal e depois `npm run dev` novamente)

---

### ❌ Problema: "Cannot find module" ou "Module not found"

**Causa:** As dependências não foram instaladas corretamente.

**Solução:**
1. No Terminal, certifique-se de estar na pasta do projeto:
   ```bash
   cd ~/Documents/robert/financas-local
   ```
2. Delete a pasta `node_modules` (se existir):
   ```bash
   rm -rf node_modules
   ```
3. Instale novamente:
   ```bash
   npm install
   ```

---

### ❌ Problema: Porta 5173 já está em uso

**Causa:** Outro aplicativo está usando a porta 5173.

**Solução:**
1. Feche outros aplicativos que possam estar usando a porta
2. Ou mate o processo:
   ```bash
   lsof -ti:5173 | xargs kill -9
   ```
3. Tente rodar `npm run dev` novamente

---

### ❌ Problema: O aplicativo não abre

**Solução:**
1. Verifique se há erros no Terminal (mensagens em vermelho)
2. Certifique-se de que o Node.js está instalado: `node --version`
3. Certifique-se de que está na pasta correta: `pwd`
4. Tente reinstalar as dependências: `npm install`
5. Verifique se as credenciais Pluggy estão configuradas

---

### ❌ Problema: "Permission denied" ao instalar

**Causa:** Problemas de permissão.

**Solução:**
1. Tente usar `sudo` (não recomendado, mas funciona):
   ```bash
   sudo npm install
   ```
2. Ou melhor: configure o npm para não precisar de sudo:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   ```
   Depois adicione ao seu `~/.zshrc`:
   ```bash
   export PATH=~/.npm-global/bin:$PATH
   ```

---

## 📍 Onde os dados são salvos?

O banco de dados SQLite é criado automaticamente em:

**Caminho completo:**
```
~/Library/Application Support/financas-local/financas.db
```

**Como acessar:**
1. Abra o Finder
2. Pressione `Command + Shift + G` (⌘ + Shift + G)
3. Cole este caminho: `~/Library/Application Support/financas-local/`
4. Pressione Enter
5. Você verá o arquivo `financas.db`

**Visualizar o banco:**
- Use o [DB Browser for SQLite](https://sqlitebrowser.org/) (grátis)
- Ou o [TablePlus](https://tableplus.com/) (tem versão grátis)

---

## ✅ Checklist Final

Antes de começar a usar, verifique:

- [ ] Node.js está instalado (`node --version` funciona)
- [ ] Está na pasta do projeto (`pwd` mostra o caminho correto)
- [ ] Dependências instaladas (`npm install` rodou sem erros)
- [ ] Credenciais Pluggy configuradas em `electron/main.js`
- [ ] Aplicativo abre sem erros (`npm run dev` funciona)
- [ ] Consegue ver o dashboard na janela do aplicativo

---

## 🆘 Ainda com problemas?

Se você seguiu todos os passos e ainda está com problemas:

1. **Copie a mensagem de erro completa** do Terminal
2. **Tire um print da tela** se possível
3. **Verifique:**
   - Versão do macOS (Apple menu → Sobre este Mac)
   - Versão do Node.js (`node --version`)
   - Se está na pasta correta (`pwd`)

**Dicas finais:**
- Sempre leia as mensagens de erro no Terminal - elas geralmente dizem o que está errado
- Certifique-se de salvar o arquivo `main.js` depois de editar
- Reinicie o Terminal se algo não funcionar
- Feche e abra o aplicativo novamente se algo estiver estranho

---

## 🎊 Pronto!

Agora você tem o Finanças Local rodando no seu Mac! 

**Lembre-se:**
- Para rodar o app: `npm run dev` (na pasta do projeto)
- Para parar: `Control + C` no Terminal
- Seus dados estão seguros no seu computador
- O sistema aprende com suas categorizações

**Boa sorte organizando suas finanças! 💰**
