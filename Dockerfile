FROM node:24-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=8000
ENV CODEX_APP_SERVER_URL=ws://127.0.0.1:4500
ENV CODEX_HOME=/home/node/.codex
ENV CODEX_UNSAFE_ALLOW_NO_SANDBOX=1

RUN apt-get update && apt-get install -y --no-install-recommends \
  bash \
  ca-certificates \
  git \
  openssh-client \
  python3 \
  make \
  g++ \
  ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/local/share/npm-global /app /workspace /home/node/.codex && \
  chown -R node:node /usr/local/share /app /workspace /home/node

USER node

ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=/usr/local/share/npm-global/bin:${PATH}

RUN npm install -g @openai/codex && npm cache clean --force

WORKDIR /app/backend

COPY --chown=node:node backend/package*.json ./
RUN npm ci

COPY --chown=node:node backend/ ./
RUN npm run build && npm prune --omit=dev

WORKDIR /app

COPY --chown=node:node docker/start-backend-with-app-server.sh /app/docker/start-backend-with-app-server.sh

EXPOSE 8000 4500

CMD ["bash", "/app/docker/start-backend-with-app-server.sh"]
