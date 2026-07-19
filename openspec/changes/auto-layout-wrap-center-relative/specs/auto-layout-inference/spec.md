## MODIFIED Requirements

### Requirement: Direct text nodes may participate as flow items
Non-empty direct Text children SHALL be eligible as Auto Layout flow items. Their boxes SHALL be measured from text ranges. If the resulting stack verifies within the geometry gate, the parent SHALL become Auto Layout; the existing walker SHALL still emit those text nodes as text layers in DOM order.

#### Scenario: Flex row with bare text and a box
- **WHEN** a horizontal flex container contains a non-empty text node sibling and an element sibling with uniform spacing that verifies
- **THEN** the container is converted to horizontal Auto Layout

## ADDED Requirements

### Requirement: Wrap stacks may use center or max cross-axis alignment
When `flex-wrap: wrap` (or an equivalent uniform grid wrap path) is inferred, the converter SHALL accept counter-axis alignment of MIN, CENTER, or MAX when a row-aware packing simulation reproduces each child's measured position within 0.6px.

#### Scenario: Path chips with wrap and center
- **WHEN** a flex row with `flex-wrap: wrap` and `align-items: center` has uniform gaps and mixed child heights that verify under centered row packing
- **THEN** the container is converted to a wrapped horizontal Auto Layout with counter align CENTER

### Requirement: Relative positioning without z-index does not block stack order
Auto Layout inference SHALL use DOM order for flow children when no numeric z-index reorders those children. `position: relative` (or sticky) with `z-index: auto` SHALL NOT by itself cause a stacking-order bail.

#### Scenario: Figure with relative phone frame
- **WHEN** a block container's first child is `position: relative; z-index: auto` and the second is static, with uniform vertical spacing that verifies
- **THEN** the container may become a vertical Auto Layout stack in DOM order
