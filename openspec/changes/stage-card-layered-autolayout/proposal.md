## Why

Stage cards on real H5 pages (e.g. 和包注册流程) look absolute in Figma even when inner chips, captions, and equal-column shot grids are already inferable. The largest structural gap is single-row CSS Grid headers (`grid-template-columns: auto 1fr`) such as `.stage-head` (badge + title column): they only enter the wrap-simulation path today and fail geometry, so designers cannot edit spacing as Auto Layout. Layered success on these subtrees matters more than forcing the whole `section.stage-card` shell into one stack.

## What Changes

- Infer **single-row, two-track grid** containers (typical `auto`/`max-content` + `1fr`) as **HORIZONTAL** Auto Layout when measured child boxes verify within the 0.6px gate—without using wrap simulation.
- Optionally mark the expanding track child with primary grow when its width matches remaining free space (same spirit as flex-grow fill).
- Keep existing wrap/grid multi-row path for equal-column shot grids; add regression fixtures for stage-head, shot-grid, path-line, figure, phone-caption patterns.
- Do **not** force outer `stage-card` VERTICAL when child margins make spacing non-uniform; outer shell may remain absolute while children succeed.
- Preserve 0.6px gate; no spacers; no whole-card raster.

## Capabilities

### Modified Capabilities

- `auto-layout-inference`: single-row auto/1fr (or equivalent measured) grid → HORIZONTAL stack.

## Impact

- `packages/dom-to-figma` layout infer + autolayout browser tests.
- Stage-card style modules export more editable nested stacks (head / path / grid / figure / caption).
