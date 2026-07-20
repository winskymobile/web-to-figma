## Why

Lone Inter symbol/emoji TEXT nodes (weather dock icons, path arrows, etc.) keep a fixed measured box. Figma "auto width" (`textAutoResize: WIDTH_AND_HEIGHT`) lets the host reflow the glyph box after paste—closer to native single-icon behavior—without globally changing multi-line copy.

Scheme 1/2 emoji OpenSpec records were discarded; this change is sizing/auto-width only.

## What Changes

- When text is a single symbol/emoji (`isSingleSymbolOrEmojiText`), emit `textAutoResize: "WIDTH_AND_HEIGHT"`.
- All other text keeps unset `textAutoResize` (fixed measured box).
- Tests cover lone symbol sets auto width; normal multi-char body remains unset.

## Impact

- `packages/dom-to-figma` text converter + browser tests
