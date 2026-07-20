## ADDED Requirements

### Requirement: Single-row two-track grids may become horizontal Auto Layout
When a CSS Grid container has exactly two flow children laid out on a single measured row (including typical `grid-template-columns: auto 1fr` or `max-content 1fr` headers), the converter SHALL attempt a non-wrapping HORIZONTAL Auto Layout inference that uses measured child rectangles and the 0.6px geometry gate. It SHALL NOT rely solely on wrap greedy packing for this case. If verification fails, the converter SHALL leave the container absolute (or fall through to other grid paths) without relaxing the gate.

#### Scenario: Stage head badge and title column
- **WHEN** a grid container uses two columns equivalent to fixed/auto + flexible track, with a fixed-size badge child and a second child filling the remaining width, uniform horizontal gap, and positions that verify within 0.6px
- **THEN** the container is converted to HORIZONTAL Auto Layout with spacing matching the measured gap

#### Scenario: Single-row grid that fails geometry stays absolute
- **WHEN** a two-child grid is one row but reconstructed HORIZONTAL positions differ by more than 0.6px from measured boxes
- **THEN** the container is not forced into Auto Layout via this path

### Requirement: Layered stage-card subtrees are independent
Success or failure of Auto Layout on a parent stage-card shell SHALL NOT prevent eligible descendants (path chips, shot grids, figures, captions, stage heads) from becoming Auto Layout when their own inference verifies.

#### Scenario: Shell absolute with editable inner stacks
- **WHEN** an outer block card fails vertical stack inference due to non-uniform inter-child margins but an inner two-column shot grid verifies as wrap Auto Layout
- **THEN** the shot grid may still be HORIZONTAL with WRAP while the outer card remains absolute
