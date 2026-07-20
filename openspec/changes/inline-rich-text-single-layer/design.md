## Context

`isPlainTextElement` requires zero element children, so `h1` with `em`+`br` is a FRAME; walker emits separate text runs. `TextData` in fig-kiwi includes `characterStyleIDs: uint[]` and `styleOverrideTable: NodeChange[]` (partial style nodes with `styleID`, `fillPaints`, etc.). Layout already tokenizes `\n` as hard breaks.

## Decisions

### 1. Host eligibility (v1)
- Element is not skip/image/svg/form.
- Flow of child nodes: only `#text`, `br`/`BR`, and phrasing tags in allowlist: `em,strong,span,i,b,small,mark,u,s,code,a` (a without block children).
- Phrasing tags may contain only text (and nested phrasing depth ≤ 2).
- At least one of: a `br`, or two+ style runs that differ in fill/color (or font-weight/style).
- Host computed font family/size used as base; runs only override deltas.
- If host has non-transparent background/border/padding that paints a box, still OK: emit TEXT with host content box; do not paint host chrome as part of text (existing frame path would paint chrome—if host has visible box chrome, **bail** and keep frame+children so we do not drop backgrounds). v1 bail when host has non-transparent background or border width > 0 or padding > 0 (matches plain-text leaf spirit for box; hero h1 is transparent zero pad).

### 2. Flatten
- Walk in DOM order.
- Text nodes: use `textContent` as-is (no trim of internal runs; skip pure whitespace-only between blocks if needed—preserve single spaces).
- `br` → `\n` (collapse `\r`).
- Build `characters` string and parallel `styleIdPerChar` array length = characters.length (UTF-16 code units to match JS string indexing used elsewhere).
- Style id 0 = host/default fills; id ≥ 1 = override table.

### 3. styleOverrideTable
Partial NodeChange-like objects:
```
{ styleID: 1, fillPaints: [ solid yellow ] }
```
Only fields that differ from base. Encoder already encodes known NodeChange fields by name.

### 4. Layout / metrics
- Call existing `nodeToTextNodeChange` with host Element, full characters (including `\n`), size/position from host content box.
- Force multi-line path when `\n` present or multi client rects.
- Glyph coloring: derived glyphs currently monochrome; Figma applies character fills from style table on paste. Keep glyph outlines; style table carries color.

### 5. Walker
Before normal frame conversion, if `tryFlattenRichInline(host)` succeeds, emit one TEXT and return without walking children.

### 6. Non-goals
- Full HTML rich text / lists / images in text.
- Soft-wrap mid-line split interaction with rich hosts (if mid-line wrap needed, bail).
- Editing semantics for hyperlinks beyond color.

## Risks
- [Risk] Figma paste ignores styleOverrideTable → color lost but still one layer with correct breaks; diagnostic optional.
- [Risk] UTF-16 vs codepoint for CJK — use JS string indices consistently with glyph pipeline.
