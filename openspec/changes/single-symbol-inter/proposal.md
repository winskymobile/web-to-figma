## Why

Standalone symbol/emoji runs (e.g. path-line `→`, check `✓`, `✅`) need a latin face that Figma can edit without missing-glyph jumps. System/CJK stacks (`-apple-system`, PingFang, YaHei, etc.) should export as **Noto Sans SC** with the same CSS weight so labels match embedded station faces. Only **single-symbol or single-emoji** nodes use **Inter** as primary.

## What Changes

- Detect single symbol / single emoji grapheme (not letter/digit/CJK, not multi-char runs).
- Those nodes only: primary = **Inter** @ CSS weight/italic → layout, glyphs, `fontName`.
- System/generic/CJK-stack (and empty) non-symbol text: primary = **Noto Sans SC** @ CSS weight (italic dropped for SC).
- Explicit custom families (Open Sans, brand faces, multi-char Inter, etc.): keep CSS primary.
- Multi-char runs keep Inter **outline** symbol-fallback for missing code points.

## Capabilities

### New Capabilities

- `single-symbol-inter`: Inter primary for single symbol/emoji; Noto Sans SC default for system stacks.

## Impact

- `packages/dom-to-figma` text converter + font style snap + tests
- Station loaders already prefer Noto/Inter bytes; converter primary request aligns labels
