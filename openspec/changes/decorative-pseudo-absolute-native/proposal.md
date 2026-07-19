## Why

Real H5 pages (e.g. 和包注册流程) paint hero 底纹 and geometric accents with absolute `::before` / `::after` layers. The converter walks only real Element/Text nodes, so those decorations disappear in Figma even when text and images convert correctly. Authors need decorative ink preserved as editable structure, without whole-page raster.

## What Changes

- Materialize active absolute decorative `::before` / `::after` as native Figma child frames (fills, strokes, radius, opacity, basic transforms) when geometry can be resolved from used styles.
- Emit them in paint-friendly order: before → real children → after (respecting negative z-index decoration behind content).
- Report non-fatal diagnostics when a pseudo is present but skipped (mask/clip/unsupported paint).
- Prefer native nodes; local decorative raster remains out of this first implementation slice when native is impossible (degraded/skipped diagnostics only), aligned with harden non-goals of no whole-page bitmap success.
- Out of scope for this change: full 21-pseudo harden gate, flex/grid pseudo items as stack children, Shadow DOM, whole-document lease rewrite.

## Capabilities

### New Capabilities

- `decorative-pseudo-export`: Absolute empty decorative pseudo-elements as native Figma decoration frames.

### Modified Capabilities

- (none in main `openspec/specs/`; this is additive package behavior consumed by the station)

## Impact

- `packages/dom-to-figma` walk + new pseudo conversion helper + diagnostics + browser tests.
- Station inherits behavior on next convert without API break.
- Slightly larger node graphs on decorated pages; more diagnostics when pseudos are skipped.
