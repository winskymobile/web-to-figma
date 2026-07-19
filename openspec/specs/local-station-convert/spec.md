# local-station-convert Specification

## Purpose
TBD - created by archiving change add-local-station. Update Purpose after archive.
## Requirements
### Requirement: Preview renders the rewritten HTML
The station SHALL render the rewritten HTML document in a same-origin iframe (or equivalent) so the user can verify layout before copying.

#### Scenario: Preview after successful import
- **WHEN** an HTML file has been loaded (with or without a complete asset folder)
- **THEN** the station shows a live preview of the document

### Requirement: Copy produces a Figma clipboard payload
On an explicit user action, the station SHALL convert the preview document’s DOM with `@figit/dom-to-figma` and write a Figma-compatible clipboard item via `navigator.clipboard`.

#### Scenario: Successful copy
- **WHEN** the user clicks “复制到 Figma” and conversion succeeds
- **THEN** the clipboard contains a Figma paste payload and the UI shows a success message

#### Scenario: Conversion or clipboard failure
- **WHEN** conversion or clipboard write fails
- **THEN** the station shows an error message and does not claim success

### Requirement: Conversion uses browser-side default auto-layout
The station SHALL run conversion entirely in the browser using `createFigmaConverter` with default layout behavior (`auto` / native auto-layout inference).

#### Scenario: Converter configuration
- **WHEN** a conversion starts
- **THEN** it MUST use a browser DOM converter instance (not a server round-trip)

### Requirement: Usage guidance is available
The station SHALL show short Chinese usage guidance covering: select HTML, select asset folder, preview, paste into Figma with Cmd/Ctrl+V.

#### Scenario: First visit
- **WHEN** the user opens the station with no files loaded
- **THEN** the empty state includes the usage steps

