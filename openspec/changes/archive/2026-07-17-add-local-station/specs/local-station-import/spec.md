## ADDED Requirements

### Requirement: User can select a single HTML file
The station SHALL allow the user to select exactly one local `.html` or `.htm` file as the design source.

#### Scenario: HTML selected
- **WHEN** the user chooses a valid HTML file
- **THEN** the station stores that file as the active document and shows its file name

#### Scenario: Non-HTML rejected
- **WHEN** the user selects a file that is not HTML
- **THEN** the station MUST reject it and explain that an HTML file is required

### Requirement: User can select an asset folder
The station SHALL allow the user to select a local directory of companion assets (CSS, images, fonts, and other files referenced by the HTML).

#### Scenario: Folder selected
- **WHEN** the user chooses an asset directory
- **THEN** the station indexes files by relative path within that directory

### Requirement: Relative assets are resolved against the asset folder
The station SHALL treat the asset folder root as the base directory of the HTML file and resolve relative `href` / `src` (and equivalent) references to files inside that folder, rewriting them to usable blob URLs for preview.

#### Scenario: Matching relative path
- **WHEN** the HTML references `css/main.css` and the folder contains `css/main.css`
- **THEN** the preview MUST load that stylesheet via a rewritten URL

#### Scenario: Absolute and data URLs unchanged
- **WHEN** the HTML references an `http(s):`, `//`, or `data:` URL
- **THEN** the station MUST leave that reference unchanged

### Requirement: Missing assets are listed without blocking workflow
The station SHALL list relative references that cannot be resolved in the asset folder, and MUST still allow preview and copy attempts.

#### Scenario: Missing file listed
- **WHEN** the HTML references `img/logo.png` and the folder has no matching file
- **THEN** the station shows `img/logo.png` in a missing-assets list and still enables copy-to-Figma

### Requirement: User can clear the session
The station SHALL provide a clear/reset action that drops the HTML, asset index, preview, and missing-asset list and revokes created object URLs.

#### Scenario: Clear after import
- **WHEN** the user activates clear after importing files
- **THEN** the UI returns to the empty state with no active preview document
