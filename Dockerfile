FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/providers/package.json packages/providers/package.json
COPY packages/widgets/package.json packages/widgets/package.json
COPY scripts/package.json scripts/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm -r run build

ENV NODE_ENV=production
ENV MCP_BASE_PATH=/whistle
ENV AFTER_THE_WHISTLE_DB_PATH=/tmp/after-the-whistle.db

EXPOSE 10000
CMD ["pnpm", "--filter", "@after-the-whistle/mcp-server", "run", "start"]
