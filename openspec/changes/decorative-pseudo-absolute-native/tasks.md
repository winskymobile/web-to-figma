## 1. Diagnostics and geometry helpers

- [x] 1.1 Add `pseudo-skipped` diagnostic code
- [x] 1.2 Implement pseudo style inspection + box resolution for absolute/fixed empty pseudos

## 2. Conversion + walk integration

- [x] 2.1 Convert eligible pseudos to frame node changes (fills, border, opacity, transform)
- [x] 2.2 Walk order: before → children → after with correct child indices

## 3. Tests

- [x] 3.1 Absolute empty ::after with border/radius becomes a child frame
- [x] 3.2 Absolute ::before full-bleed with gradient becomes a child frame under host
- [x] 3.3 Masked pseudo does not invent a frame (optional diagnostic)
- [x] 3.4 Run package tsc / targeted browser tests
