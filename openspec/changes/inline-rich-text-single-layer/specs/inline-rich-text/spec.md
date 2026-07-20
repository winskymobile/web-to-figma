## ADDED Requirements

### Requirement: Simple rich-inline hosts may become one TEXT layer
When a text host element contains only text nodes, line breaks, and shallow phrasing elements (such as `em` used for color emphasis), the converter SHALL emit a single Figma TEXT node whose characters preserve hard line breaks from `br` elements, instead of separate per-run TEXT nodes, when host box chrome does not require a painted frame.

#### Scenario: Hero title with emphasis and br
- **WHEN** an `h1` contains text, an `em` with a distinct color, a `br`, and following text, with transparent host background and no padding/border
- **THEN** conversion produces one TEXT node whose characters include a newline between the first line and the second line

### Requirement: Character styles preserve emphasis fills
When runs within a flattened rich-inline TEXT differ in text color from the host default, the converter SHALL attach `textData.characterStyleIDs` and `textData.styleOverrideTable` so that those character ranges map to fill paints matching the computed colors of the source runs.

#### Scenario: Yellow emphasis span
- **WHEN** the substring corresponding to emphasized text has a computed color different from the host
- **THEN** those character indices reference a non-zero style id whose override fill matches that color within converter color fidelity rules

### Requirement: Unsupported inline trees fall back
When the host contains unsupported structure (block children, depth overflow, painted host chrome, replaced content), the converter SHALL NOT force single-layer flattening and SHALL keep the existing walk/frame behavior.

#### Scenario: Heading with nested block
- **WHEN** an `h1` contains a nested `div`
- **THEN** the converter does not emit a single flattened rich TEXT for that host via this path
