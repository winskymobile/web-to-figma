## Why

The station can currently produce a paste payload while silently omitting failed or unsupported content, and it does not define one stable full-document snapshot across resource loading, scroll geometry, and conversion. The 430px canonical page needs a measurable contract that preserves content and editability before optimizing visual fidelity, hierarchy, or Auto Layout.

## What Changes

- Capture one Chromium snapshot at the selected logical width, recorded DPR/zoom, and `scrollTop = 0`, with a root Figma frame whose width matches the preview and whose height covers the complete scrolling document; the canonical gate runs at DPR 1 and 100% zoom.
- **BREAKING** Add an independently scanned capture manifest and a conversion-completeness report whose terminal outcomes are `excluded`, `native`, `degraded`, `skipped`, and `error`; derive `complete | degraded | failed` result status from a normative truth table, and make clipboard helpers reject failed results instead of encoding a partial payload as success.
- Preserve supported text, containers, images, SVG, form content, and pseudo-element content as native editable Figma nodes. Whole-page raster fallback is forbidden; a local decorative raster fallback is allowed only when reported.
- Use Auto Layout only when browser geometry can be reproduced within the existing strict tolerance; otherwise preserve pixels and hierarchy with absolute positioning.
- Expand local resource rewriting and readiness checks so the conversion snapshot waits for discoverable styles, fonts, and images and reports unresolved sources with provenance.
- Add Mobile `430` plus validated custom logical widths without reintroducing independent `2x` export geometry.
- Establish the supplied 430px page as the first canonical browser fixture, with structural counts, diagnostics, root geometry, and real Figma paste/oracle acceptance.
- Limit this phase to Chromium static-document snapshots. Executing arbitrary imported scripts, Shadow DOM, nested iframes, video/canvas editability, cross-origin bypasses, and pixel-perfect equivalence with every browser or extension remain out of scope.

## Capabilities

### New Capabilities

- `whole-document-editable-export`: Complete scrolling-document capture, native editable-node coverage, explicit degradation accounting, and canonical Figma acceptance.
- `extension-conversion-safety`: Production WXT MV3 popup/clipboard safety gates for complete, degraded, and failed conversion results.

### Modified Capabilities

- `local-station-import`: Expand relative resource closure, missing-resource provenance, and readiness information beyond top-level `href`/`src` rewriting.
- `local-station-convert`: Require a settled full-document snapshot, completeness-gated success, and strict absolute fallback when Auto Layout is not geometrically equivalent.
- `export-viewport`: Add the canonical 430px width and validated custom logical widths while preserving one Figma unit per CSS pixel.
- `web-to-figma-shell`: Surface conversion completeness and actionable degraded/error summaries without claiming success after content loss.

## Impact

- `apps/web-to-figma`: import/rewrite pipeline, preview readiness, viewport controls, copy flow, diagnostics UI, and canonical browser fixtures.
- `packages/dom-to-figma`: document-root semantics, walker accounting, pseudo-element/native-node coverage, additive conversion result metadata, and oracle/corpus tests.
- `apps/extension`: handle complete, degraded, and failed converter results and prove through a real Chrome MV3 popup path that failed conversion leaves a clipboard sentinel unchanged and never displays success.
- Clipboard format remains Figma-compatible and conversion remains entirely browser-side; no server process or geometry scale is added.
