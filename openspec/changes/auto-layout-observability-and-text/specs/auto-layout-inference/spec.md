## ADDED Requirements

### Requirement: Strict geometry gate remains default
When Auto Layout inference is enabled, the converter SHALL emit Figma stack properties for a container only when reconstructed child positions match captured geometry within 0.6 CSS/Figma pixels and spacing uniformity rules pass. Otherwise the container SHALL remain absolutely positioned (`stackMode` equivalent to none).

#### Scenario: Non-uniform gap stays absolute
- **WHEN** a block or flex container has inter-child gaps that differ by more than 0.6px
- **THEN** the container is not converted to Auto Layout

### Requirement: Bail reasons are reported
When inference runs and does not produce a stack for a candidate flex, block, or grid container, the converter SHALL record a non-fatal diagnostic with code `layout-infer-bailed` and a stable machine-readable `reason` string.

#### Scenario: Diagnostic on bail
- **WHEN** a flex container fails inference due to non-uniform spacing
- **THEN** `ConvertResult.diagnostics` includes an entry with code `layout-infer-bailed` and reason identifying non-uniform gap (or equivalent stable token)

### Requirement: Direct text nodes may participate as flow items
Non-empty direct Text children SHALL be eligible as Auto Layout flow items. Their boxes SHALL be measured from text ranges. If the resulting stack verifies within the geometry gate, the parent SHALL become Auto Layout; the existing walker SHALL still emit those text nodes as text layers in DOM order.

#### Scenario: Flex row with bare text and a box
- **WHEN** a horizontal flex container contains a non-empty text node sibling and an element sibling with uniform spacing that verifies
- **THEN** the container is converted to horizontal Auto Layout

#### Scenario: Text-only unmodelable patterns still bail safely
- **WHEN** text participation still cannot produce a verifying stack (e.g. non-uniform gaps among mixed items)
- **THEN** the container stays absolute and a `layout-infer-bailed` diagnostic is recorded
