## ADDED Requirements

### Requirement: Absolute decorative pseudos become native frames
When a converted host frame has an active absolute or fixed `::before` or `::after` with empty decorative content and paintable ink, the converter SHALL emit a child Figma frame for that pseudo with resolved position and size relative to the host, including supported solid/gradient fills, borders, corner radius, opacity, and basic CSS transform when present.

#### Scenario: Hero corner accent after
- **WHEN** a host has `::after` with empty content, absolute positioning, fixed pixel size, border, border-radius, and rotate transform
- **THEN** the export contains a child frame under the host with matching approximate size and a stroke/fill representing the accent

#### Scenario: Full-bleed before decoration
- **WHEN** a host has `::before` with empty content, absolute fill of the host (inset 0), and background gradients
- **THEN** the export contains a child frame sized to the host box with gradient fills derived from the pseudo background

### Requirement: Paint order keeps before under content
For a host with both decorative `::before` and real children, the converter SHALL emit the before decoration node before real child nodes in the Figma child list so content remains above default decoration.

#### Scenario: Before then children
- **WHEN** a host has a decorative absolute `::before` and at least one element child
- **THEN** the before frame's sibling index is lower than the first real child's index

### Requirement: Unsupported decorative pseudos are reported, not silently invented
When a pseudo is active but not convertible under v1 rules (e.g. mask-image, unresolved geometry, non-empty generated text), the converter SHALL omit a fake node and MAY record a non-fatal diagnostic with code `pseudo-skipped` and a stable reason.

#### Scenario: Masked pseudo skipped
- **WHEN** a pseudo has an active mask-image and would otherwise be decorative
- **THEN** no pseudo frame is required and diagnostics MAY include `pseudo-skipped` with reason identifying mask
