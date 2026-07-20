## ADDED Requirements

### Requirement: Length color stops normalize by gradient line length
When a linear-gradient color stop uses a length unit (e.g. `px`) and the converter knows the painted box size, the stop position SHALL be the length divided by the CSS gradient line length for that box and angle, clamped to [0, 1], rather than evenly spaced by stop index.

#### Scenario: Page band at 330px
- **WHEN** `linear-gradient(180deg, #1296f4 0, #1296f4 330px, #f5fbff 330px, #f5fbff 100%)` is parsed with box height 1000 and width 430
- **THEN** the two middle stops have position approximately 0.33 (330/1000)

### Requirement: Linear gradient transform follows covering line
When box size is known, the GRADIENT_LINEAR transform SHALL map the unit gradient axis onto the covering gradient line across the box for the CSS angle so that percentage stops align with positions along that line.

#### Scenario: Diagonal mid stop
- **WHEN** `linear-gradient(135deg, #0d76e7, #10a8f6 58%, #19c79d)` is parsed with a non-square box size
- **THEN** the middle stop position is 0.58 and the paint transform is non-null and derived from the covering line (not only centered unit rotation without size)
