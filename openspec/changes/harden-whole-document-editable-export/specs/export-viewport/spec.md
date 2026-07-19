## MODIFIED Requirements

### Requirement: User selects a device category and logical width
The station SHALL provide mutually exclusive Mobile and PC categories. Mobile SHALL offer `360`, `375`, `390`, `414`, and `430` CSS-pixel presets plus integer custom widths from `240` through `767`. PC SHALL offer `1280`, `1440`, `1512`, and `1920` presets plus integer custom widths from `768` through `3840`. Exactly one category and one valid logical width SHALL be active.

#### Scenario: Default viewport
- **WHEN** a user opens the station with no valid stored preference
- **THEN** Mobile `375` is selected

#### Scenario: Select canonical mobile preset
- **WHEN** the user selects Mobile `430`
- **THEN** the preview reflows at 430 CSS pixels wide

#### Scenario: Enter custom width
- **WHEN** the user enters an integer custom width inside the selected category's range
- **THEN** that value becomes the active preview and export width

#### Scenario: Reject invalid custom width
- **WHEN** the user enters a non-integer, non-finite, or out-of-range custom width
- **THEN** the station keeps the last valid width and explains the accepted range

#### Scenario: Switch to PC
- **WHEN** the user switches from a mobile width to PC
- **THEN** PC `1440` is selected unless a valid stored PC width is available

### Requirement: Preview reflows at the selected logical width
The station SHALL size the preview document viewport to the selected preset or custom logical width before readiness and conversion measurement.

#### Scenario: Preset preview width
- **WHEN** Mobile `430` is selected
- **THEN** the preview content area is exactly 430 CSS pixels wide independent of the outer browser window

#### Scenario: Custom preview width
- **WHEN** a valid custom width of `512` is active
- **THEN** the preview content area and subsequent snapshot use exactly 512 CSS pixels

### Requirement: Copy uses selected width and complete content height
On copy-to-Figma, the station SHALL size the top-level root frame to exactly the selected logical width and to the complete measured document height. Horizontal overflow SHALL remain present as editable content outside the root bounds with root clipping disabled; it SHALL NOT silently widen the root frame.

#### Scenario: Normal export
- **WHEN** Mobile `430` is active and the document has a complete scrolling height
- **THEN** the exported root frame is 430 units wide and includes the complete document height

#### Scenario: Horizontal overflow
- **WHEN** measured content extends past the selected logical width
- **THEN** the root remains at that logical width, overflow content is not clipped or discarded, and the station shows a non-blocking geometry warning

### Requirement: Viewport preference persists
The station SHALL persist the last valid device category and preset or custom width in `localStorage` and restore them on the next load.

#### Scenario: Restore preset after reload
- **WHEN** the user selected PC `1512` and reloads the station
- **THEN** PC `1512` remains selected

#### Scenario: Restore custom width after reload
- **WHEN** the user selected a valid Mobile custom width of `512` and reloads the station
- **THEN** Mobile `512` remains active as a custom width
