## 1. Types + flatten

- [x] 1.1 Extend `FigmaTextData` with characterStyleIDs + styleOverrideTable
- [x] 1.2 Implement `flattenRichInline(host)` eligibility + run collection
- [x] 1.3 Wire `nodeToTextNodeChange` to accept full string + style runs

## 2. Walk

- [x] 2.1 Emit flattened rich TEXT before frame child walk; skip children

## 3. Tests

- [x] 3.1 Hero-like h1 → one TEXT, newline, style ids for em color
- [x] 3.2 Nested div host → not flattened
- [x] 3.3 tsc + text/autolayout tests green
