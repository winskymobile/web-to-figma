## Decision

```
isSingleGrapheme(text) && hasCenterIntent(element|parent)
  → size.width = fontSize (x shifted to keep visual center)
  → textAutoResize WIDTH_AND_HEIGHT for symbol/emoji (existing) and single grapheme when centered

display flex|grid, one flow child, center intent (place-items/align/justify center)
  → stack HORIZONTAL FIXED/FIXED, primary CENTER, counter CENTER
  → verifyGeometry must pass
```

Center intent: placeItems, placeContent, alignItems, justifyItems, justifyContent, textAlign including `center`.
