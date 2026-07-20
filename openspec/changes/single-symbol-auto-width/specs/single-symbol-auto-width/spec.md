## ADDED Requirements

### Requirement: Single-symbol or single-emoji text uses Figma auto width

When a TEXT node is created from exactly one symbol/emoji grapheme (per `isSingleSymbolOrEmojiText`), the converter SHALL set `textAutoResize` to `WIDTH_AND_HEIGHT`.

#### Scenario: lone arrow

- **WHEN** text is `→`
- **THEN** textAutoResize is WIDTH_AND_HEIGHT

#### Scenario: multi-character body

- **WHEN** text is multi-character copy (e.g. `Hello world` or `OK →`)
- **THEN** textAutoResize is unset / not forced to WIDTH_AND_HEIGHT solely for this policy
