# 🔑 Adicionar Chave SSH no GitHub

## Passo 1: Copiar a Chave SSH

A chave SSH já foi gerada. Copie esta chave:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBRDfP5fWfIjm3jOV19w04LMCWITvFeu+0vgrMjJwW/8 robertdanilo63@gmail.com
```

## Passo 2: Adicionar no GitHub

1. Acesse: https://github.com/settings/keys
2. Clique em **"New SSH key"** (botão verde)
3. Preencha:
   - **Title**: `Mac - Flux Project` (ou qualquer nome)
   - **Key**: Cole a chave SSH acima
   - **Key type**: Authentication Key (deixe padrão)
4. Clique em **"Add SSH key"**
5. Digite sua senha do GitHub se pedir

## Passo 3: Testar Conexão

Depois de adicionar, execute:

```bash
ssh -T git@github.com-personal
```

Você deve ver uma mensagem como:
```
Hi DeNiro10! You've successfully authenticated...
```

## Passo 4: Fazer Push

Depois que a chave estiver adicionada:

```bash
cd ~/Documents/robert/financas-local
git push -u origin main
```

---

**Pronto!** Seu código será enviado para o GitHub sem precisar digitar senha! 🚀



