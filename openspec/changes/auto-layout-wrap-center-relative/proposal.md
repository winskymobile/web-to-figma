## Why

Real H5 pages (e.g. 和包注册流程) leave important flex rows absolute: `flex-wrap: wrap` + `align-items: center` path chips bail with `wrap-align-not-min`, and vertical stacks under `figure` bail with `stacking-order-mismatch` solely because a child uses `position: relative` without z-index reordering. Those containers should become Auto Layout when geometry still verifies.

## What Changes

- Allow wrap inference with counter-axis `CENTER` / `MAX` when a per-row simulation matches measured child positions within 0.6px.
- Treat stacking-order mismatch only when z-index (or non-auto paint reorder) would change flow child order; `position: relative` + `z-index: auto` must not block block/flex inference.
- Keep uniform gap + 0.6px gate; do not add spacers or prefer-edit.

## Capabilities

### Modified Capabilities

- `auto-layout-inference`: wrap counter-align + stacking check rules.

## Impact

- `packages/dom-to-figma` layout infer + autolayout browser tests.
- More containers (path lines, figures with relative phones) export as stacks.
