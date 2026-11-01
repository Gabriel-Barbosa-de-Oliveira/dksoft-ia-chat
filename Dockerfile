# Backend do agente (api/) + servidor MCP (mcp/) numa só imagem.
# A API sobe o MCP como processo filho via stdio, então os dois precisam estar juntos.
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    CHAT_DB=/data/chat.db

WORKDIR /app

# Dependências primeiro, para aproveitar o cache de camadas.
# `api` precisa das devDependencies: `npm start` executa o TypeScript via tsx.
COPY mcp/package.json mcp/package-lock.json ./mcp/
COPY api/package.json api/package-lock.json ./api/
RUN npm --prefix mcp ci --include=dev && npm --prefix api ci --include=dev

COPY mcp ./mcp
COPY api ./api

# Volume do Fly.io é montado aqui (SQLite do histórico).
RUN mkdir -p /data

# cwd = /app/api mantém o MCP_ENTRY padrão (../mcp/src/index.ts) válido.
WORKDIR /app/api

EXPOSE 3000

CMD ["npm", "start"]
