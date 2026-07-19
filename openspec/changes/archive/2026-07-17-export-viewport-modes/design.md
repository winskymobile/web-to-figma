## Context

`apps/web-to-figma` previously sized its preview from the browser window. That made responsive layout and exported root-frame dimensions depend on the station window rather than the design intent.

## Goals / Non-Goals

**Goals:**

- Mobile and PC device categories with common width presets.
- Preview and export use the same logical CSS width.
- Complete document height is exported.
- Selected category and width persist.
- Default is Mobile `375`.

**Non-Goals:**

- Arbitrary custom widths.
- Export scaling independent from the logical viewport.
- Multi-frame export.
- Device chrome or notch simulation.

## Decisions

### 1. Device categories and widths

- Mobile presets: `360`, `375`, `390`, `414`.
- PC presets: `1280`, `1440`, `1512`, `1920`.
- Switching categories selects that category's default (`375` or `1440`) when the current width is not valid for the new category.

### 2. Preview/export parity

The iframe content area is exactly the selected logical width. Copy measures the already-reflowed document and passes:

```ts
width = max(selectedWidth, documentScrollWidth)
height = max(documentScrollHeight, 200)
```

If content horizontally overflows the selected width, export expands to the measured overflow width and shows a soft warning.

### 3. No independent export scale

The earlier `1x/2x` experiment was removed because scaling Figma geometry without changing CSS reflow requires transforming the converted node tree and introduces avoidable fidelity risks. The station exports one Figma unit per measured CSS pixel.

### 4. Persistence

- `web-to-figma:viewport-kind`
- `web-to-figma:viewport-width`

Legacy mode values may be read for migration. The obsolete export-scale key is removed.

## Risks / Trade-offs

- Fixed presets do not cover every source design width; later changes may add an explicit custom width.
- Horizontal overflow produces a root frame wider than the selected preset so content is not clipped.
- Tall-page height follows document measurement and can change after delayed resources load; readiness is handled by a later hardening change.

## Migration Plan

- Existing users default to Mobile `375` if no valid stored width exists.
- Remove obsolete export-scale preference during state loading.
- Rollback is limited to the station UI and viewport helper.

## Open Questions

- None for the implemented preset behavior.
