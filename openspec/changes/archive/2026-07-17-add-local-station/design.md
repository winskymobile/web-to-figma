## Context

The monorepo already provides `@figit/dom-to-figma` (browser DOM → Figma clipboard) and a playground for corpus scenes. Users still lack a dedicated local station to open **their own** HTML plus a companion asset folder, preview it, and copy into Figma. Conversion must run in the browser (computed styles, canvas, fonts). Docker should only host the static SPA (lightweight form).

## Goals / Non-Goals

**Goals:**

- Ship `apps/local-station`: Chinese SPA — pick HTML + asset folder → preview → copy to Figma.
- Rewrite relative asset paths against the chosen folder into `blob:` URLs.
- Report missing assets without blocking copy.
- Support local `pnpm` dev and multi-stage Docker/nginx static hosting.
- Reuse `@figit/dom-to-figma` with default auto-layout.

**Non-Goals:**

- Zip upload, multi-HTML canvas, payload tree inspector.
- Server-side / Playwright conversion inside Docker.
- Browser extension changes.
- Account, history, or cloud storage.
- Perfect Safari folder-picker parity beyond `webkitdirectory` where available.

## Decisions

### 1. New app `apps/local-station` (Vite + React + Tailwind)

- **Why**: Matches monorepo frontend stack without TanStack Start SSR complexity; SPA-only is required for real DOM conversion.
- **Alternatives**: Extend playground (mixes corpus tooling with import UX); standalone repo (harder workspace linking).

### 2. Import model: one HTML file + asset directory

- HTML via `<input type="file" accept=".html,.htm">`.
- Assets via `<input type="file" webkitdirectory multiple>` (broad Chromium/WebKit support).
- Treat the directory root as the HTML file’s base directory for relative URL resolution.
- Absolute `http(s):` / `data:` / `//` URLs are left unchanged.
- Missing files are listed; conversion still allowed.

### 3. Preview via blob HTML + same-origin iframe

- Build a rewritten HTML string (or blob URL) with resolved asset URLs.
- Load into iframe; wait for `load`; convert `contentDocument.documentElement` / `body`.
- Revoke object URLs on clear/re-import to avoid leaks.

### 4. Conversion + clipboard

- Singleton `createFigmaConverter()` with default loaders and `layout: "auto"`.
- On user gesture: `convert({ element, width, height, name })` then `navigator.clipboard.write([result.toClipboardItem()])`.
- Surface loading / success / error toasts (sonner or lightweight custom).

### 5. Hosting

- Dev: Vite on a fixed port (e.g. 4177).
- Prod: `pnpm --filter local-station build` → static `dist/`.
- Docker multi-stage: Node build in monorepo context → `nginx:alpine` serves `dist` on port 80 (map host 8080).
- Optional root `docker-compose.yml` service `local-station`.

### 6. UI scope (MVP “常用增强”)

- Steps: HTML → folder → preview → copy.
- Missing asset list, clear, short usage notes.
- Chinese copy throughout.
- Prefer `@figit/ui` tokens/components when low-friction; otherwise Tailwind + local layout.

## Risks / Trade-offs

- **[Risk] Relative paths assume asset folder == HTML directory** → Document clearly; show unresolved paths.
- **[Risk] Cross-origin remote images may fail without CORS** → List as network assets; default image loader may fail; copy still proceeds with degraded visuals.
- **[Risk] `webkitdirectory` UX shows many files** → Only store map of relative path → File; do not dump raw list in UI.
- **[Risk] Large folders / big images** → Keep work client-side; no hard limit in MVP; may add soft warnings later.
- **[Risk] Clipboard requires secure context + gesture** → Require click handler; run on localhost/https only.

## Migration Plan

- Additive only: new app + Docker files; no package API breaks.
- Rollback: remove app / stop container; rest of monorepo unchanged.

## Open Questions

- None for MVP (resolved with user: multi-file model as HTML+folder, missing assets non-blocking, new app, enhanced minimal UI).
