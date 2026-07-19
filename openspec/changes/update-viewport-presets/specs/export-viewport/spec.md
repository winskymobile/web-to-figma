## MODIFIED Requirements

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

### Requirement: Viewport preference persists
The station SHALL persist the last valid device category and width in `localStorage` and restore them on the next load.

#### Scenario: Restore after reload
- **WHEN** the user selected PC `1366` and reloads the station
- **THEN** PC `1366` remains selected

## ADDED Requirements

### Requirement: Offered widths match everyday design conventions
Mobile presets SHALL include common Android (`360`), iPhone standard (`375`/`390`), and large iPhone / H5 cap (`430`) widths. PC presets SHALL include small desktop (`1280`), common laptop (`1366`), mid desktop (`1440`), and full-HD artboard (`1920`) widths. The station SHALL NOT offer `414` or `1512` as selectable presets after this change.

#### Scenario: Mobile chip set
- **WHEN** the user opens the Mobile width menu
- **THEN** the only width options are `360`, `375`, `390`, and `430`

#### Scenario: PC chip set
- **WHEN** the user opens the PC width menu
- **THEN** the only width options are `1280`, `1366`, `1440`, and `1920`
