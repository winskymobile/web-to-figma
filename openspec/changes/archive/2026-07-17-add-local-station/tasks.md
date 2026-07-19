## 1. Scaffold app

- [x] 1.1 Create `apps/local-station` package (package.json, tsconfig, vite, index.html, Tailwind)
- [x] 1.2 Depend on workspace `@figit/dom-to-figma` and React 19 stack; wire into pnpm workspace
- [x] 1.3 Add root/README notes for `pnpm --filter local-station dev|build`

## 2. Import & path rewrite

- [x] 2.1 HTML file picker + validation (`.html`/`.htm`)
- [x] 2.2 Asset folder picker (`webkitdirectory`) and relative-path index
- [x] 2.3 Parse HTML for relative assets; rewrite matches to blob URLs; collect missing list
- [x] 2.4 Clear/reset revokes object URLs and resets state

## 3. Preview & convert UI

- [x] 3.1 Same-origin iframe preview of rewritten document
- [x] 3.2 Missing-assets panel (non-blocking)
- [x] 3.3 Copy-to-Figma via `createFigmaConverter` + clipboard write
- [x] 3.4 Loading/success/error feedback, usage guidance, Chinese UI shell

## 4. Docker hosting

- [x] 4.1 Multi-stage Dockerfile (monorepo build → nginx static)
- [x] 4.2 Optional docker-compose service + documented port mapping
- [x] 4.3 nginx SPA fallback for client routes if needed

## 5. Verify

- [x] 5.1 `pnpm install` and `pnpm --filter local-station build` succeed
- [x] 5.2 Smoke: load sample HTML+assets, preview, conversion path does not throw
