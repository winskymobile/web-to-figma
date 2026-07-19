## 1. Rename package & Docker

- [x] 1.1 Move `apps/local-station` → `apps/web-to-figma`; update package.json name
- [x] 1.2 Update Dockerfile, docker-compose, nginx comments, image/container names
- [x] 1.3 Update root README, PRODUCT.md, openspec references as needed
- [x] 1.4 Refresh pnpm lock / workspace install for new filter name

## 2. Monochrome fullscreen UI

- [x] 2.1 Replace app shell with toolbar + full-bleed stage (B/W/G tokens from mock)
- [x] 2.2 Wire HTML/folder pickers, status, missing badge, clear, copy
- [x] 2.3 Empty stage click + drag-drop HTML
- [x] 2.4 Keep conversion/asset/font logic under the new shell

## 3. Verify

- [x] 3.1 `pnpm --filter web-to-figma build` succeeds
- [x] 3.2 Docker rebuild & healthcheck on :8080
