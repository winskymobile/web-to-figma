## Decision

```
isSingleSymbolOrEmojiText(text) === true
  → nodeChange.textAutoResize = "WIDTH_AND_HEIGHT"
else
  → omit textAutoResize (Figma default NONE / fixed)
```

Still emit measured `size` as initial layout; auto-width allows Figma to grow with font metrics / host emoji after paste.

Non-goals: global auto-width; emoji raster; omit empty glyphs; +4px hard pad.
