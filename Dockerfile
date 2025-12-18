FROM node:24-alpine

# Instalar dependências do sistema necessárias para better-sqlite3
# Incluindo python3, py3-setuptools (contém distutils), make, g++, build-base, sqlite-dev, e git
RUN apk add --no-cache \
    python3 \
    py3-setuptools \
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
RUN npm install --include=dev

# Copiar código da aplicação
COPY . .

# Expor portas
EXPOSE 3000 5173

# Comando padrão
CMD ["npm", "run", "dev:docker"]

