# Como Adicionar o Logo do Flux

## Opção 1: Usando o Script Automático

Execute o script que criamos:

```bash
cd /Users/robertoliveira/Documents/robert/financas-local
./copy-logo.sh
```

O script vai:
1. Procurar automaticamente por imagens com "flux" no nome na pasta Downloads
2. Se não encontrar, vai listar as imagens recentes para você escolher
3. Copiar a imagem para `public/assets/logo.png`

## Opção 2: Cópia Manual

1. Encontre a imagem do logo na sua pasta Downloads
2. Copie a imagem para: `financas-local/public/assets/logo.png`
3. Se a imagem tiver outro nome, renomeie para `logo.png`

**Formatos suportados:** PNG, JPG, JPEG, SVG, WEBP

## Após Adicionar

1. Recarregue a página do navegador (F5 ou Cmd+R)
2. O logo deve aparecer no lugar da letra "F" no header

## Estrutura de Arquivos

```
financas-local/
  └── public/
      └── assets/
          └── logo.png  ← Coloque a imagem aqui
```

## Nota

Se a imagem não for encontrada, o sistema vai usar o logo padrão (letra "F" com gradiente) como fallback.


