FROM node:24-alpine

# Instalar dependências do sistema necessárias para better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite git

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências (incluindo devDependencies)
RUN npm install --include=dev

# Copiar código da aplicação
COPY . .

# Expor portas
EXPOSE 3000 5173

# Comando padrão
CMD ["npm", "run", "dev"]

