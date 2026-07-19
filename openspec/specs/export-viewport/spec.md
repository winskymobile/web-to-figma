# export-viewport Specification

## Purpose
User-selectable Mobile/PC logical viewport widths drive preview reflow and Figma root frame dimensions at one Figma unit per CSS pixel.

## Requirements
### Requirement: User selects a device category and logical width
The station SHALL provide mutually exclusive Mobile and PC categories. Mobile SHALL offer `360`, `375`, `390`, and `430` CSS-pixel widths. PC SHALL offer `1280`, `1366`, `1440`, and `1920` CSS-pixel widths. Exactly one category and one valid width SHALL be active.

#### Scenario: Default viewport
- **WHEN** a user opens the station with no valid stored preference
- **THEN** Mobile `375` is selected

#### Scenario: Select a mobile preset
- **WHEN** the user selects Mobile `430`
- **THEN** the preview reflows at 430 CSS pixels wide

#### Scenario: Select a PC preset
- **WHEN** the user selects PC `1366`
- **THEN** the preview reflows at 1366 CSS pixels wide

#### Scenario: Switch to PC
- **WHEN** the user switches from a mobile width to PC
- **THEN** PC `1440` is selected unless a valid PC width is already active

#### Scenario: Legacy stored width no longer offered
- **WHEN** stored width is `414` (mobile) or `1512` (PC)
- **THEN** the station falls back to that category’s default width (`375` or `1440`)

### Requirement: Preview reflows at the selected logical width
The station SHALL size the preview document viewport to the selected logical width before conversion. Decorative chrome around the preview (borders, outlines, shadows) SHALL NOT reduce the iframe layout width: `contentWindow.innerWidth` MUST equal the selected logical width at conversion time.

#### Scenario: Preview width
- **WHEN** an HTML document is loaded with Mobile `390` selected
- **THEN** the preview content area is 390 CSS pixels wide independent of the outer browser window

#### Scenario: Chrome does not consume viewport pixels
- **WHEN** Mobile `430` is selected and the document is ready for copy
- **THEN** the preview iframe layout width is 430 CSS pixels (not 428 from a 1px border on each side)

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
- **WHEN** the user selected PC `1366` and reloads the station
- **THEN** PC `1366` remains selected

### Requirement: Offered widths match everyday design conventions
Mobile presets SHALL include common Android (`360`), iPhone standard (`375`/`390`), and large iPhone / H5 cap (`430`) widths. PC presets SHALL include small desktop (`1280`), common laptop (`1366`), mid desktop (`1440`), and full-HD artboard (`1920`) widths. The station SHALL NOT offer `414` or `1512` as selectable presets.

#### Scenario: Mobile chip set
- **WHEN** the user opens the Mobile width menu
- **THEN** the only width options are `360`, `375`, `390`, and `430`

#### Scenario: PC chip set
- **WHEN** the user opens the PC width menu
- **THEN** the only width options are `1280`, `1366`, `1440`, and `1920`
