## ADDED Requirements

### Requirement: Real Chrome E2E exercises the packaged extension conversion path
The project SHALL verify extension conversion safety with an unpacked production WXT Manifest V3 Chrome build. The E2E MUST open the extension's real popup, trigger whole-page copy through the popup control, and traverse the production popup dispatch, injected trigger, content-script caller, `@figit/dom-to-figma` converter, status gate, browser Clipboard API, and in-page toast path. It MUST NOT replace or mock the converter, extension caller, trigger transport, clipboard write, or status UI.

#### Scenario: Production popup copy path
- **WHEN** the extension acceptance E2E runs against a deterministic test page
- **THEN** it builds and loads the actual Chrome MV3 extension artifact, opens its real popup, activates the whole-page copy control, and observes the terminal result produced by the production conversion and clipboard path

#### Scenario: Status fixtures use the real converter
- **WHEN** complete, degraded, and failed acceptance fixtures are exercised
- **THEN** each status is produced by the production converter from the fixture's rendered document rather than injected by a stub or test-only caller branch

### Requirement: Chrome acceptance metadata is fixed and attributable
The extension E2E SHALL run with a pinned Chrome for Testing build and SHALL record the exact Chrome product version and revision, operating system and architecture, headed or headless mode, extension manifest version, production extension artifact SHA-256, source revision, and fixture hash. A run whose execution metadata differs from the checked-in acceptance metadata MUST fail rather than silently update the expected result.

#### Scenario: Pinned Chrome execution
- **WHEN** the extension E2E launches Chrome and loads the unpacked build
- **THEN** the observed Chrome and extension metadata exactly match the pinned acceptance metadata before any clipboard assertion is accepted

#### Scenario: Artifact provenance
- **WHEN** an E2E result is retained as release evidence
- **THEN** its Chrome metadata, extension artifact hash, source revision, and fixture hash identify the exact production bundle and page that produced the clipboard outcome

### Requirement: Failed conversion leaves the clipboard completely unchanged
Immediately before triggering a failed conversion, the E2E SHALL seed the real browser clipboard with a unique sentinel `ClipboardItem` and retain the exact ordered MIME-type set and bytes for every sentinel representation. When the production converter returns `status: "failed"`, the extension MUST NOT call a clipboard-writing path, MUST NOT replace any sentinel representation, MUST NOT show a success toast, and MUST show persistent blocking diagnostics derived from the conversion report.

#### Scenario: Failed whole-page copy preserves sentinel
- **WHEN** the real popup triggers whole-page copy for a deterministic fixture that makes the production converter return `status: "failed"`
- **THEN** the clipboard's MIME types and bytes are byte-for-byte identical to the prefilled sentinel after the terminal UI state, no native or generic success toast is present, and persistent blocking diagnostics identify the fatal category

#### Scenario: Failed conversion after a prior successful copy
- **WHEN** a failed popup conversion follows an earlier successful conversion and the clipboard is reseeded with a new sentinel before the failed attempt
- **THEN** the failed attempt leaves the new sentinel completely unchanged and cannot reuse the earlier success state or toast

### Requirement: Extension clipboard and UI behavior is status-gated
Every production extension conversion caller, including whole-page and picked-element copy, SHALL branch exhaustively on the converter's `complete`, `degraded`, and `failed` statuses before constructing or writing a clipboard item. A complete result SHALL be the only result that produces the native-success state. A degraded result without fatal content loss SHALL write its Figma payload and show a persistent degradation warning instead of native success. A failed result SHALL preserve the clipboard and show blocking diagnostics.

#### Scenario: Complete result shows native success
- **WHEN** the real popup triggers a conversion whose production result has `status: "complete"` and the clipboard write succeeds
- **THEN** the clipboard contains the generated Figma payload, the page shows the native-success state, and no degraded or blocking state is shown

#### Scenario: Degraded result writes with persistent warning
- **WHEN** the real popup triggers a conversion whose production result has `status: "degraded"` and contains no fatal content loss
- **THEN** the clipboard contains the generated Figma payload, a persistent warning exposes the reported degradation categories, and no native-success or blocking state is shown

#### Scenario: Failed result blocks write and success
- **WHEN** any production extension caller receives `status: "failed"`
- **THEN** it does not construct or write a clipboard item, does not show native or generic success, and presents persistent blocking diagnostics from the report

### Requirement: Extension callers are compatible with the status API and fail closed
The production extension build SHALL consume the converter's status and report API without inferring success from promise resolution, encoded bytes, or an empty grouped-diagnostic list. The caller MUST preserve the report through its terminal UI state, MUST handle every declared status exhaustively, and MUST treat a missing, unknown, or incompatible status/report shape as a blocking conversion failure with no clipboard write.

#### Scenario: Status-bearing caller compatibility
- **WHEN** the extension is built against the status-bearing converter API
- **THEN** both whole-page and picked-element production callers type-check and route complete, degraded, and failed results through the shared status gate before clipboard access

#### Scenario: Missing or unknown status fails closed
- **WHEN** a converter result lacks a recognized status or required report fields because of an incompatible bundle or API version
- **THEN** the extension leaves the clipboard unchanged, shows an incompatibility diagnostic, and does not display a success state

### Requirement: Failed-result no-write protection is non-rollbackable
Once the status-bearing API is available, every supported release and rollback configuration MUST retain the invariant that failed, missing-status, and unknown-status results cannot write the clipboard. A rollback MAY disable newer snapshot, resource, pseudo-element, or diagnostic presentation features, but it MUST NOT restore an unconditional convert-then-write path or bypass the production status gate. Release acceptance SHALL include the real Chrome failed-sentinel E2E.

#### Scenario: Feature rollback retains the gate
- **WHEN** a newer conversion feature is disabled or rolled back while the extension remains supported
- **THEN** a failed or unrecognized conversion result still leaves the prefilled clipboard sentinel byte-for-byte unchanged and cannot show success

#### Scenario: Release gate rejects unsafe extension behavior
- **WHEN** a candidate extension build writes after a failed result, changes any sentinel representation, bypasses the production status gate, or omits the pinned Chrome E2E evidence
- **THEN** the release acceptance fails and the build MUST NOT be treated as conversion-safe
