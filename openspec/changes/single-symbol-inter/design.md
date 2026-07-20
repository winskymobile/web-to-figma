## Decision

```
text is single symbol/emoji grapheme
  → primaryFont = Inter @ weight/italic
  → fontName from loaded Inter

else if CSS family is system/generic/CJK stack (or empty)
  → primaryFont = Noto Sans SC @ weight, italic=false
  → fontName from loaded Noto (+ resolvedFamily)

else
  → primaryFont = CSS face as today
  → symbol-fallback Inter for missing outlines (existing)
```

Weight → Figma style via nearest bucket (Light/Regular/Medium/Bold/Black…).

Non-goals: whole-document Inter; forcing Noto over explicit custom @font-face brands; multi-symbol strings as Inter.

## FontName shape

Figma UI: **Family** picker shows `Inter` or `Noto Sans SC` only (no weight suffix).
**Style** picker holds weight: Light / Regular / Medium / Bold / Black (+ Italic).
Never emit family `"Inter Bold"` or `"Noto Sans SC Bold"` from OT name tables.
