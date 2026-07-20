## Why

Hero titles such as `注册<em>流程</em><br>说明` export as multiple TEXT layers (or a frame of pieces), so designers cannot edit the title as one string while keeping hard line breaks and the yellow emphasis. Clipboard TextData already supports `characterStyleIDs` + `styleOverrideTable` (NodeChange partials); the converter should use them for simple inline hosts.

## What Changes

- Detect simple rich-inline hosts (block/heading/phrasing shell with only text, `br`, and shallow phrasing tags like `em`/`span`/`strong`/`i`/`b`).
- Flatten to one TEXT node: hard `br` → `\n`, same host box geometry, layout via existing multi-line path.
- Emit per-character `characterStyleIDs` and `styleOverrideTable` entries for fill (and other NodeChange text fields when they differ), preserving emphasis color.
- Do not walk flattened children as separate layers.
- Bail to existing multi-layer path when structure is unsupported (nested blocks, replaced elements, deep trees).

## Capabilities

### New Capabilities

- `inline-rich-text`: Single-layer rich inline text conversion with character styles.

## Impact

- `packages/dom-to-figma` walk/classify path, text types, text converter, browser tests.
