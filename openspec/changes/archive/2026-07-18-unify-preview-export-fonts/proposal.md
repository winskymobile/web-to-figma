## Why

Preview and Figma export can use different font files and fallback stacks, so text metrics, wrapping, and glyph shapes diverge. Users need the preview they see to match the embedded fonts used for conversion as closely as practical (same-source approximation, not pixel-perfect).

## What Changes

- Prefer page-declared `@font-face` fonts for both preview measurement and export embedding.
- Remap only system/generic font stacks to a shared fallback (Noto Sans SC); do not force-replace custom families.
- Preload a shared latin symbol face (Inter) in the preview so missing CJK symbols match export fallbacks.
- Surface font load / embed degradations to the user (toast), instead of silent fallback only.
- Make font discovery and element checks safe for preview documents from a different iframe realm.
- Reset converter font/image caches when the active preview document changes so identically named page fonts cannot leak across imports.
- Preserve real glyph outlines for the sample's CJK and symbol characters; report missing glyphs rather than silently reusing or inventing paths.
- Out of scope for this change: browser client-rect line breaking rewrite, glyph subsetting pipeline, and raster/outline hard fallbacks.

## Capabilities

### New Capabilities

- `preview-export-fonts`: Shared font resolution between preview reflow and converter embedding, with observable degradation.

### Modified Capabilities

- (none)

## Impact

- `apps/web-to-figma` font prepare, preview lifecycle, loaders, and copy feedback.
- `packages/dom-to-figma` internal loaded-font metadata, glyph fallback behavior, diagnostics, and tests. Public converter method signatures remain compatible.
- Network dependency on font CDN for Noto/Inter fallbacks remains.
