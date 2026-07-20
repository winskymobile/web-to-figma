## Why

Local H5 fidelity still drops masked decorative grids, under-uses flex padding measurement when children have margins, and surfaces conversion issues only as opaque counts. Authors need visible decorations, more correct Auto Layout on common flex rows, and readable diagnostic summaries—without remote URL import or relaxing the 0.6px AL gate.

## What Changes

- When an absolute decorative pseudo is skipped for `mask-image` (or similar paint that native fills cannot express), optionally emit a **local decorative raster** child frame within size bounds, with `decoration-rasterized` diagnostic.
- Deepen absolute pseudo handling: more robust empty-content detection; allow simple generated-text pseudos as text-bearing frames when single-line content is plain.
- Auto Layout flex inference: measure primary/cross leading padding from child geometry when CSS padding alone fails verify due to child margins (e.g. check-item), preserving the 0.6 gate.
- Station `formatConversionWarning`: group diagnostics by code/reason with Chinese labels and top reasons, not only total counts.

## Capabilities

### New Capabilities

- `local-fidelity-improvements`: Decorative raster fallback, flex margin-aware padding, pseudo deepen, diagnostic summary UX.

### Modified Capabilities

- (none required in main archived specs for this incremental package/app slice)

## Impact

- `packages/dom-to-figma` pseudo converter, walk, layout infer, diagnostics, tests.
- `apps/web-to-figma` conversion-warning + tests.
