## ADDED Requirements

### Requirement: Masked decorative pseudos may rasterize locally
When an absolute decorative `::before`/`::after` is active but cannot be expressed as native fills due to an active mask, the converter MAY emit a local image-backed frame for that pseudo if the resolved box is within configured size bounds. It SHALL record a non-fatal diagnostic with code `decoration-rasterized`.

#### Scenario: Masked card grid becomes raster child
- **WHEN** a host has an absolute empty `::before` with background paint and mask-image and a resolvable box under the size limit
- **THEN** conversion includes an absolutely positioned child frame with an image fill for that decoration OR a `pseudo-skipped` diagnostic if rasterization fails

### Requirement: Flex stack padding may be measured from children
When flex Auto Layout inference fails geometry verification using CSS border+padding alone but inter-child gaps are uniform, the converter SHALL retry with padding derived from measured child rectangles before bailing.

#### Scenario: Check row with icon margin
- **WHEN** a horizontal flex container has uniform gap and a child with small cross-axis margin that shifts the first cross coordinate beyond CSS padding by more than 0.6px
- **THEN** the container may still become HORIZONTAL Auto Layout if measured padding verifies within 0.6px

### Requirement: Conversion warnings summarize diagnostic codes
The station warning formatter SHALL include counts by diagnostic code (and top reasons when present), not only a single total, when diagnostics are non-empty.

#### Scenario: Mixed layout and pseudo diagnostics
- **WHEN** conversion returns multiple `layout-infer-bailed` and one `pseudo-skipped`
- **THEN** the warning string mentions those categories or codes in aggregate form readable in Chinese UI
