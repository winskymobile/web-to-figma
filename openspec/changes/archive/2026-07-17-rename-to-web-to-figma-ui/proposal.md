## Why

The local HTML→Figma tool was branded `local-station`, which does not match the project directory / product name `web-to-figma`. The UI also needs a simpler fullscreen-preview layout (monochrome toolbar + clickable empty canvas) aligned with the approved mock.

## What Changes

- Rename the app package and Docker artifacts from `local-station` to `web-to-figma` (display name, package name, image/container names, docs, scripts).
- Keep path as `apps/web-to-figma` (rename directory from `apps/local-station`) so folder, filter, and Docker dockerfile path stay consistent.
- Replace the multi-panel UI with the approved black-white-gray toolbar + full-bleed preview; center empty state opens HTML picker (click + drag-drop).
- Update README / PRODUCT copy to use the new name.

## Capabilities

### New Capabilities

- `web-to-figma-shell`: Minimal monochrome toolbar shell and fullscreen preview host for the converter app.

### Modified Capabilities

- `local-station-hosting` → hosting paths/names become `web-to-figma` (Docker image, compose service, filter scripts).
- `local-station-import` / `local-station-convert`: behavior retained; UI surface rebranded (no requirement change beyond naming and empty-state pick).

## Impact

- `apps/local-station` → `apps/web-to-figma`
- package name `local-station` → `web-to-figma`
- Docker: `web-to-figma:latest`, container `web-to-figma`, compose service `web-to-figma`
- pnpm: `pnpm --filter web-to-figma …`
- Users must rebuild Docker after pull; old `web-to-figma-local-station` container should be removed.
