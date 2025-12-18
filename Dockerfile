FROM node:24-alpine

# Instalar dependências do sistema necessárias para better-sqlite3
# Incluindo python3, make, g++, build-base (toolchain completo), sqlite-dev, e git
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    build-base \
    sqlite \
    sqlite-dev \
    git \
    && ln -sf python3 /usr/bin/python

# Configurar npm para usar Python 3
ENV PYTHON=/usr/bin/python3

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências (incluindo devDependencies)
# Usar --build-from-source para garantir compilação correta do better-sqlite3
RUN npm install --include=dev --build-from-source

# Copiar código da aplicação
COPY . .

# Expor portas
EXPOSE 3000 5173

# Comando padrão
CMD ["npm", "run", "dev:docker"]

