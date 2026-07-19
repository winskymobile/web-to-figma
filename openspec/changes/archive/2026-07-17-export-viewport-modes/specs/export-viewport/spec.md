## ADDED Requirements

### Requirement: User selects a device category and logical width
The station SHALL provide mutually exclusive Mobile and PC categories. Mobile SHALL offer `360`, `375`, `390`, and `414` CSS-pixel widths. PC SHALL offer `1280`, `1440`, `1512`, and `1920` CSS-pixel widths. Exactly one category and one valid width SHALL be active.

#### Scenario: Default viewport
- **WHEN** a user opens the station with no valid stored preference
- **THEN** Mobile `375` is selected

#### Scenario: Select a mobile preset
- **WHEN** the user selects Mobile `414`
- **THEN** the preview reflows at 414 CSS pixels wide

#### Scenario: Switch to PC
- **WHEN** the user switches from a mobile width to PC
- **THEN** PC `1440` is selected unless a valid PC width is already active

### Requirement: Preview reflows at the selected logical width
The station SHALL size the preview document viewport to the selected logical width before conversion.

#### Scenario: Preview width
- **WHEN** an HTML document is loaded with Mobile `390` selected
- **THEN** the preview content area is 390 CSS pixels wide independent of the outer browser window

### Requirement: Copy uses selected width and complete content height
On copy-to-Figma, the station SHALL convert the document after layout at the selected logical width and SHALL size the root Figma frame from that width and the complete measured content height.

#### Scenario: Normal export
- **WHEN** Mobile `375` is active and the document does not overflow horizontally
- **THEN** the exported root frame is 375 units wide and includes the complete document height

#### Scenario: Horizontal overflow
- **WHEN** measured content is wider than the selected logical width
- **THEN** the exported frame expands to the measured width and the station shows a non-blocking warning

### Requirement: Export geometry remains one-to-one with CSS pixels
The station SHALL export at one Figma unit per measured CSS pixel and SHALL NOT apply an independent `1x/2x` geometry scale.

#### Scenario: Copy without geometry scale
- **WHEN** any viewport preset is copied
- **THEN** layer geometry is derived directly from preview CSS-pixel measurements

### Requirement: Viewport preference persists
The station SHALL persist the last valid device category and width in `localStorage` and restore them on the next load.

#### Scenario: Restore after reload
- **WHEN** the user selected PC `1512` and reloads the station
- **THEN** PC `1512` remains selected
