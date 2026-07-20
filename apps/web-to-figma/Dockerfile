# Real environment: multi-stage monorepo build → nginx static SPA
# From repo root:
#   docker compose -f apps/web-to-figma/docker-compose.yml up --build -d
#   open http://localhost:8080

FROM node:24-bookworm-slim AS build
WORKDIR /app

ENV CI=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages/dom-to-figma/package.json packages/dom-to-figma/
COPY packages/fig-kiwi/package.json packages/fig-kiwi/
COPY apps/web-to-figma/package.json apps/web-to-figma/

RUN pnpm install --frozen-lockfile --filter web-to-figma...

COPY packages/fig-kiwi packages/fig-kiwi
COPY packages/dom-to-figma packages/dom-to-figma
COPY apps/web-to-figma apps/web-to-figma

RUN pnpm --filter @figit/fig-kiwi build \
  && pnpm --filter @figit/dom-to-figma build \
  && pnpm --filter web-to-figma build

FROM nginx:1.27-alpine AS runtime
COPY apps/web-to-figma/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web-to-figma/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]

# rebuild-stamp: centered-single-glyph 2026-07-20T15:36:54Z
