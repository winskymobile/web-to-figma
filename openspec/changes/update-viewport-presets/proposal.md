## Why

Current Mobile (`360/375/390/414`) and PC (`1280/1440/1512/1920`) presets skew toward older Plus widths and a niche MacBook logical width. Everyday H5 work (including pages capped near `430px`) and domestic desktop drafts more often need `430` and `1366`. Aligning presets to those conventions reduces friction and avoids exporting common long-pages at an awkward default-adjacent width.

## What Changes

- **BREAKING (preset list only):** Replace Mobile `414` with `430`; replace PC `1512` with `1366`.
- Mobile presets become `360`, `375`, `390`, `430`.
- PC presets become `1280`, `1366`, `1440`, `1920`.
- Keep defaults: Mobile `375`, PC `1440` (category switch still falls back to these when the previous width is invalid).
- Invalid stored widths (e.g. legacy `414` / `1512` in `localStorage`) continue to fall back to the category default via existing validation.
- Update main `export-viewport` requirements and any toolbar/docs comments that hard-code the old lists.
- Out of scope: subpixel `Math.round` geometry fix, custom freeform widths, changing default to `430`, conversion engine changes.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `export-viewport`: Update offered Mobile/PC CSS-pixel width lists and restore scenarios to match the new presets while preserving defaults, persistence, and 1:1 export geometry.

## Impact

- `apps/web-to-figma/src/lib/viewport.ts` — preset constants and default helpers.
- `apps/web-to-figma` toolbar / preview comments if they name old widths.
- `openspec/specs/export-viewport/spec.md` — after archive/sync of this change.
- Active change `harden-whole-document-editable-export` still mentions `414`/`1512` in its delta; this change updates main-station presets now. Harden can rebase later to include `430`/`1366` plus any custom-width work without blocking this ship.
- No `@figit/dom-to-figma` API change.
