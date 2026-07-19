## ADDED Requirements

### Requirement: App identity is web-to-figma
The SPA document title and primary chrome brand label MUST use the product name `web-to-figma` (not Local Station).

#### Scenario: Brand on load
- **WHEN** the user opens the app
- **THEN** the page title and toolbar brand identify the product as web-to-figma

### Requirement: Fullscreen preview with top toolbar
The main viewport MUST be a full-bleed preview stage; controls MUST live in a single top toolbar (HTML pick, asset folder pick, status, clear, copy).

#### Scenario: Layout
- **WHEN** the app is shown at desktop size
- **THEN** the preview fills remaining height below the toolbar with no multi-column explanation panels

### Requirement: Empty stage picks HTML
When no document is loaded, the center empty state MUST be activatable to choose an HTML file (click). Dragging a `.html`/`.htm` file onto the empty stage MUST also load it.

#### Scenario: Click empty stage
- **WHEN** the user activates the empty preview state
- **THEN** the HTML file picker opens

#### Scenario: Drop HTML on empty stage
- **WHEN** the user drops a `.html` file onto the empty stage
- **THEN** the app loads that document into the session
