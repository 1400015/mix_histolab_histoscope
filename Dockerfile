# HistoScope-AI — imagem de produção (C2).
# Multi-stage: build JS (vite + esbuild) e depois runtime Node + Python
# com as dependências do motor de visão fixadas (engine/requirements.txt).

FROM node:20-slim AS jsbuild
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Só as dependências de runtime: o `dist/server.js` é empacotado com
# --packages=external (correcção 2026-09-28), logo importa express/vite/
# @google/genai/dotenv do node_modules em produção — sem este stage o
# contentor arrancava com ERR_MODULE_NOT_FOUND.
FROM node:20-slim AS deps
WORKDIR /deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM python:3.12-slim AS runtime
WORKDIR /app

# Motor de visão: Python + OpenCV/numpy fixados.
COPY engine/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Node runtime apenas para o servidor.
COPY --from=jsbuild /build/dist/index.html /app/dist/index.html
COPY --from=jsbuild /build/dist/assets /app/dist/assets
COPY --from=jsbuild /build/dist/server.js /app/server.js
# Dependências externas do bundle (express, vite, @google/genai, dotenv).
COPY --from=deps /deps/node_modules /app/node_modules
# Assets do motor: galeria, metadados e código Python (esbuild não os embute).
COPY engine /app/engine

ENV NODE_ENV=production
ENV PORT=3000
# Loopback por defeito — o compose publica a porta só no anfitrião local.
ENV HOST=0.0.0.0
EXPOSE 3000

# node:20-slim já inclui node; instalar a versão do apt seria a 18, por isso
# copiamos o binário da imagem de build.
COPY --from=jsbuild /usr/local/bin/node /usr/local/bin/node

CMD ["node", "/app/server.js"]
