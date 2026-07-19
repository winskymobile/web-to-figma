## MODIFIED Requirements

### Requirement: Copy produces a Figma clipboard payload
On an explicit user action, the station SHALL convert the settled preview snapshot with `@figit/dom-to-figma`, evaluate its normative `complete | degraded | failed` result status, and write a Figma-compatible clipboard item only for `complete` or `degraded`. A `failed` result MUST leave the clipboard unchanged.

#### Scenario: Complete copy
- **WHEN** every eligible capture-manifest contribution is native and clipboard writing succeeds
- **THEN** the clipboard contains a Figma paste payload and the UI shows the native-success state

#### Scenario: Reported non-fatal degradation
- **WHEN** conversion returns `degraded` because every fallback is approved, source-linked, content-preserving, and has an output GUID
- **THEN** the station writes the payload, shows a non-blocking degraded warning, and does not describe the result as fully native

#### Scenario: Fatal content loss
- **WHEN** a rendered content item is skipped or fails without an allowed fallback
- **THEN** the station MUST NOT write the clipboard payload or show success and MUST identify the blocking diagnostic category

#### Scenario: Conversion or clipboard failure
- **WHEN** conversion, completeness evaluation, or clipboard writing fails
- **THEN** the station shows an error message and does not claim success

### Requirement: Conversion uses browser-side default auto-layout
The station SHALL run conversion entirely in the browser using `createFigmaConverter`. Auto Layout SHALL be enabled only through exact geometry inference, and each container that cannot reproduce the captured geometry SHALL fall back to absolute positioning without changing its content coverage.

#### Scenario: Converter configuration
- **WHEN** a conversion starts
- **THEN** it MUST use the browser DOM converter instance with strict geometry-gated Auto Layout and no server round-trip

#### Scenario: Auto Layout inference fails
- **WHEN** a container's browser geometry cannot be represented by the supported Figma stack model
- **THEN** that container remains absolute and its supported descendants are still converted in hierarchy and paint order

## ADDED Requirements

### Requirement: Copy uses one settled static-document snapshot
Before measurement, the station SHALL execute one exclusive lease in this order: freeze iframe inner width, viewport height, scroll, DPR, and zoom metadata; await baseline stylesheet readiness without injecting capture nodes; freeze the original source index and observations; install the motion/caret policy; prepare fonts; materialize source-linked pseudo proxies; await final `document.fonts` and manifest/pseudo-owned images/resources up to a bounded timeout; require consecutive stable animation frames; finalize the immutable capture manifest geometry, measure, and walk; then restore state in `finally`. Generation-owned motion/font/proxy nodes MUST NOT enter the frozen source candidate set. It MUST set `scrollTop = 0`, MUST NOT resize the iframe to the document scroll height before measurement, and SHALL keep one Figma unit per measured CSS pixel regardless of device DPR.

#### Scenario: Resources settle
- **WHEN** all reachable styles, fonts, and images become ready before the timeout
- **THEN** conversion measures the document only after font preparation and pseudo materialization and after geometry is stable across consecutive animation frames

#### Scenario: Canonical capture viewport
- **WHEN** the canonical fixture is captured
- **THEN** the iframe inner viewport is exactly `430 × 932` CSS pixels at DPR 1, 100% browser zoom, and `scrollTop = 0`

#### Scenario: Resource timeout
- **WHEN** a resource does not settle before the timeout
- **THEN** the snapshot proceeds only if completeness can account for the degradation and otherwise blocks copy as fatal content loss

#### Scenario: Baseline stylesheet cannot be proven ready
- **WHEN** a stylesheet failure or timeout can change computed pseudo or decoration candidate discovery before source indexing
- **THEN** the manifest sets `sourceInventoryComplete: false`, copy is blocked, and the station MUST NOT treat absent computed candidates as an empty denominator

#### Scenario: Imported script
- **WHEN** imported HTML contains executable script content
- **THEN** the static-document path MUST prevent that script from executing and reports dynamic runtime rendering as unsupported for this phase

### Requirement: Full document root is deterministic
The station SHALL walk `document.documentElement` at `scrollTop = 0` and convert the complete document into one named top-level Figma frame whose width is the selected logical width. Root height SHALL be `ceil(max(documentElement/body scrollHeight, offsetHeight, clientHeight, scrollY + getBoundingClientRect().bottom))` after settlement. HTML → BODY ancestry, browser canvas-background propagation, and content outside the initial viewport SHALL be preserved; transformed or fixed visual overflow SHALL remain visible through disabled root clipping rather than widening or heightening the root.

#### Scenario: Long scrolling page
- **WHEN** the preview scroll height is greater than the viewport height
- **THEN** the root frame covers the complete measured height and includes supported content below the fold

#### Scenario: Canonical complete height
- **WHEN** the pinned canonical fixture is measured in its pinned Chromium environment
- **THEN** the root height is `5484` Figma units with a tolerance of at most `±1` unit

#### Scenario: Fixed and sticky content
- **WHEN** the document contains fixed or sticky content
- **THEN** its Figma geometry reflects the rendered position in the settled `scrollTop = 0` snapshot and the completeness report identifies the positioning mode
