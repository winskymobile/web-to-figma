## 1. Viewport model

- [x] 1.1 Update `MOBILE_WIDTHS` to `[360, 375, 390, 430]` and `PC_WIDTHS` to `[1280, 1366, 1440, 1920]` in `apps/web-to-figma/src/lib/viewport.ts`
- [x] 1.2 Keep defaults Mobile `375` and PC `1440` in `DEFAULT` and `defaultWidthFor`
- [x] 1.3 Confirm `loadViewportPreset` / `withWidth` / `presetForKind` still reject removed widths via `isWidthForKind`

## 2. UI and comments

- [x] 2.1 Grep `apps/web-to-figma` for hard-coded `414` / `1512` preset references and update comments (e.g. preview-stage JSDoc)
- [x] 2.2 Smoke: toolbar still lists four widths per kind from `widthsFor`

## 3. Specs and verification

- [x] 3.1 Keep change delta at `openspec/changes/update-viewport-presets/specs/export-viewport/spec.md` accurate
- [x] 3.2 Update main `openspec/specs/export-viewport/spec.md` Purpose + requirements to the new lists (or leave for archive sync if project prefers archive-only — prefer updating main now for operator clarity)
- [x] 3.3 Run `pnpm --filter web-to-figma check-types`
- [x] 3.4 Optional: add a tiny unit test for width lists/defaults if low-cost; otherwise typecheck + manual chip check is enough for this constant swap
