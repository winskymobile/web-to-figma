## Why

Users need a lightweight local web station to open a local HTML file (with a companion asset folder), preview it in the browser, and copy the rendered result into Figma—without installing a browser extension or editing playground corpus scenes. Docker-hosted static serving makes the station easy to run on any machine.

## What Changes

- Add a new monorepo app `apps/local-station`: a Chinese-language SPA for HTML → Figma copy.
- Support picking **one HTML file** plus an **asset directory** (CSS, images, fonts, etc.).
- Resolve relative resource paths against the asset folder, rewrite them to `blob:` URLs, and render in a same-origin iframe preview.
- List **missing assets** while still allowing copy-to-Figma.
- Provide copy success/failure feedback, clear/reset, and short usage guidance.
- Ship a multi-stage **Docker + nginx** setup that serves the built static site only (conversion stays in the browser via `@figit/dom-to-figma`).
- Wire workspace scripts so `pnpm --filter local-station dev|build` works.

## Capabilities

### New Capabilities

- `local-station-import`: HTML + asset-folder import, path rewriting, missing-asset reporting.
- `local-station-convert`: Browser-side DOM → Figma clipboard conversion and user feedback.
- `local-station-hosting`: Local dev server and Docker/nginx static hosting for the SPA.

### Modified Capabilities

- (none)

## Impact

- New package under `apps/local-station` (private, not published to npm).
- Depends on workspace `@figit/dom-to-figma` (and optionally `@figit/ui`).
- Root docs/scripts may mention how to run/dev the station.
- No changes to published package APIs or the browser extension.
- MVP does **not** include zip upload, server-side conversion, payload inspector, or auth.
