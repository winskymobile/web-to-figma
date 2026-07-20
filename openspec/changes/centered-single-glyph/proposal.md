## Why

Centered single glyphs (emoji, symbols, lone characters in `place-items:center` / flex-center icon boxes) export with browser-measured widths that are often narrower than the font size, and single-child grid hosts often fail Auto Layout inference—so Figma neither shows a font-size box nor stack centering.

## What Changes

- Detect single grapheme text + CSS center intent (self or parent).
- Set TEXT width to `fontSize` (centered expansion from measured box); keep auto-width flag for lone symbol/emoji.
- Infer Auto Layout for single-child flex/grid hosts with center intent: Primary+Counter CENTER.

## Impact

- text converter sizing, layout infer, tests
