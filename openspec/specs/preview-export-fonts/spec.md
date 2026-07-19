# preview-export-fonts Specification

## Purpose
Align preview font measurement with converter font embedding, preserve page-declared families, and surface recoverable font or glyph degradation without blocking copy.

## Requirements

### Requirement: Page fonts preferred over forced fallback
When preparing the preview document for conversion, the station MUST preserve non-system page font families and MUST only remap system/generic stacks to the shared fallback family.

#### Scenario: Custom @font-face kept
- **WHEN** an element uses a page-declared custom family that is not a system/generic stack
- **THEN** convert-prepare MUST NOT replace that family with Noto Sans SC

#### Scenario: System stack remapped
- **WHEN** an element’s primary computed family is a known system/generic font
- **THEN** convert-prepare MUST remap it to the shared fallback stack used for export

### Requirement: Shared fallback faces load before convert
The station MUST inject and wait for the shared fallback faces (Noto Sans SC and Inter) in the preview document before conversion measurement runs.

#### Scenario: Fallback faces ready
- **WHEN** the user starts copy-to-Figma
- **THEN** the station attempts to load Noto Sans SC and Inter into the preview document fonts set before calling convert

### Requirement: Converter prefers page @font-face bytes
The converter font loader MUST try page `@font-face` sources first and fall back to the CJK/latin loaders when no match exists or fetch fails.

#### Scenario: Page face match
- **WHEN** the requested family/weight matches a parseable page `@font-face` URL
- **THEN** the loader returns those font bytes for embedding

#### Scenario: Fetch failure falls back
- **WHEN** the matched page font URL cannot be fetched
- **THEN** the loader falls back to the shared fallback loader

### Requirement: Font degradation is visible
When convert-prepare encounters font load failures or remaps under degraded conditions, the station MUST inform the user without blocking copy.

#### Scenario: Partial failure toast
- **WHEN** one or more fallback/page font loads fail during prepare
- **THEN** after copy completes or proceeds, the UI shows a non-blocking warning that some fonts may not match the preview

#### Scenario: Page font fetch falls back
- **WHEN** a matching page `@font-face` is discovered but its bytes cannot be fetched
- **THEN** the converter uses its fallback and the copy result reports the page-font degradation

### Requirement: Font handling is iframe-realm safe
The station MUST discover CSS font faces and selectively remap elements in the active preview iframe without relying on parent-realm DOM or CSSOM constructors.

#### Scenario: System stack inside preview iframe
- **WHEN** a preview iframe element uses a system font stack
- **THEN** convert-prepare remaps that iframe element to the shared fallback stack and later restores its original inline style

#### Scenario: Font face rule inside preview iframe
- **WHEN** the preview iframe contains a matching parseable `@font-face` rule
- **THEN** the page font loader discovers the rule and attempts to use its resolved bytes

### Requirement: Font caches are scoped to the active preview
Changing or clearing the active preview document MUST invalidate converter font and image caches.

#### Scenario: Same family in consecutive documents
- **WHEN** two imported documents declare different bytes under the same family, weight, and style
- **THEN** conversion of the second document MUST NOT reuse the first document's cached font

### Requirement: Missing glyphs never reuse unrelated outlines
The converter MUST use a real glyph from the primary or configured fallback fonts when available and MUST report a degradation when none contains the character.

#### Scenario: Common arrow and checkmark
- **WHEN** CJK text contains `→` or `✓` and the primary face lacks the symbol
- **THEN** the converter uses a real fallback glyph outline and the symbol remains visible after Figma paste

#### Scenario: No loaded face contains a glyph
- **WHEN** no loaded font contains a character
- **THEN** the converter records a missing-glyph diagnostic and MUST NOT reuse another character's glyph path
