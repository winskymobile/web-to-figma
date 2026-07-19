## ADDED Requirements

### Requirement: CaptureManifest independently freezes the source inventory
Before pseudo proxies or converter nodes are inserted, the Chromium snapshot path SHALL run an independent `indexCaptureSources(documentElement, resourceManifest.captureObservations)` pass that freezes original imported sibling-index paths, candidate identities, pseudo identities, and pre-load neutralization/removal observations after baseline stylesheet readiness. Executable elements whose computed candidates matter SHALL remain same-slot inert originals. A truly removed subtree MUST be replaced only through a module-issued opaque `CaptureRemovalBundle` that inserts a nonce-bound comment slot and retains the complete pre-removal candidate set/digest; the index MUST reject forged bundles and set `sourceInventoryComplete: false` for unmatched slots/bundles. An annotation for inline handlers or other surviving nodes MUST merge a closed privacy-safe code plus occurrence count into the existing fixed-cardinality candidate rather than add one; it MAY conservatively force eligibility but MUST NOT force exclusion. After source-linked pseudo materialization and final geometry settlement, `scanCaptureManifest(sourceIndex)` SHALL finalize eligibility, computed styles, Range/client-rect geometry, browser-selected resources, pseudo-proxy geometry, and captured bounds without adding, removing, or renumbering candidates. Both phases SHALL complete before any conversion classifier or walker runs. Converter traversal SHALL consume this immutable inventory and MUST NOT change it.

Each source SHALL have a stable privacy-safe ID composed from its original child-node sibling-index path, contribution category, and deterministic per-host ordinal. IDs MUST be computed before pseudo proxies or converter nodes are inserted and MUST remain unchanged by stacking-order sorting, Auto Layout inference, line splitting, raster fallback, or Figma emission order. The runtime manifest SHALL contain source category, paint geometry and decoration ink bounds, a deterministic array of settled resource facts (`role/layerOrdinal`, source-key hash, bytes hash) when applicable, captured hierarchy/paint facts, manifest-owned fallback policies, and independent `sourceInventoryComplete`, `resourceProofComplete`, `hierarchyProofComplete`, and `paintOrderProofComplete` flags without storing raw page text or stack traces. Each fallback policy SHALL fix allowed impact flags, required output roles/evidence, and permitted hierarchy-edge substitutions. A false proof flag MUST prevent `complete` or `degraded`, even when its denominator is zero. A separately reviewed canonical acceptance overlay MAY add expected disposition, node kinds, exact fallback policy, and geometry/hierarchy expectations by source ID; converter output MUST NOT generate that overlay.

Every public source kind, detail, provenance, reason, fallback, and output role SHALL come from a closed runtime-validated registry. Unknown/custom HTML or SVG local names SHALL normalize to generic non-reversible source kinds rather than copying caller-controlled names. Annotation provenance SHALL retain a positive occurrence count. Raw text, attributes, selectors, URLs, exception messages, stack traces, and arbitrary caller strings MUST be rejected rather than copied into the manifest/report.

The first `scanCaptureManifest` call SHALL seal and cache the final manifest. Later scans of the same source index SHALL return the same immutable object without re-reading DOM/resources, and proxy/observation/resource binding after sealing SHALL be rejected.

#### Scenario: Converter cannot define its own denominator
- **WHEN** the converter classifies, reorders, splits, lifts, skips, or fails a source after `CaptureManifest` is frozen
- **THEN** the frozen source ID and eligibility remain unchanged and the ledger MUST close that existing source rather than altering the manifest denominator

#### Scenario: Stable source ID across emission changes
- **WHEN** two conversions of the same settled snapshot choose different valid Figma emission orders or split one text contribution into different line boxes
- **THEN** their source IDs remain identical and output GUID lists carry the one-to-many emission difference

#### Scenario: Rewrite removes an earlier sibling
- **WHEN** an original script or base Element before a surviving sibling is removed during static rewrite
- **THEN** an inert comment retains the removed child-node slot through indexing, observations synthesize the removed subtree's candidates, and the surviving sibling keeps its original imported path

#### Scenario: Multiple handlers annotate one candidate
- **WHEN** a surviving Element has multiple neutralized inline event handlers
- **THEN** every handler provenance annotates that Element's single structure candidate without creating another structure contribution or duplicate ID

### Requirement: CaptureManifest uses fixed v1 contribution cardinalities
The v1 scanner SHALL first enumerate contribution candidates independently of converter support, then classify every candidate as exactly one `excluded` or `eligible` source in exactly one of seven categories. Failure to enumerate a candidate MUST NOT substitute for an `excluded` record. Candidate cardinalities and eligibility rules SHALL be:

- `structure`: one candidate for every original Element; metadata elements and elements without a principal box close as excluded, except neutralized executable or runtime-bearing sources and paint-eligible canvas/video/iframe/Shadow DOM hosts remain conservatively eligible unsupported sources;
- `text`: one candidate for every original Text node, regardless of eventual Figma line-box count; eligibility follows rendered CSS white-space semantics and non-empty Range geometry without trimming, so whitespace-only nodes under `pre`, `pre-wrap`, `break-spaces`, or any other visibly spacing context remain eligible; only a node with no rendered grapheme/spacing contribution or no non-empty Range rect closes as excluded;
- `image`: one candidate for every `HTMLImageElement`, keyed to settled `currentSrc` and its resource-manifest entry; non-paint-eligible candidates close as excluded and paint-eligible candidates are eligible;
- `svg`: one candidate for every `SVGGraphicsElement`, including unsupported SVG tags; non-paint-eligible candidates close as excluded and paint-eligible candidates are eligible;
- `form-state`: one candidate for every input, textarea, select, button, checkbox, or radio current state; non-paint-eligible candidates close as excluded and paint-eligible candidates are eligible;
- `pseudo`: one candidate per host and `before`/`after` when computed content or any active paint property is non-empty, including unsupported paint; ordinals are reserved as `before = 0` and `after = 1` even if only one candidate exists; all of that pseudo's paint layers and resource facts belong to this one pseudo contribution rather than separate host decorations; a candidate that is not paint-eligible closes as excluded and a paint-eligible candidate is eligible;
- `decoration`: for principal Element paint only, one candidate for every active non-transparent background-color declaration, every parsed background-image layer, one combined active border declaration, every box-shadow layer, and every active filter, backdrop-filter, mask, clip-path, or non-normal blend declaration; pseudo paint is excluded from this category to avoid double accounting; an active candidate that produces no paint-eligible geometry closes as excluded and every paint-eligible candidate is eligible.

The scanner, not an observation or converter caller, SHALL derive coverage relevance. Every eligible structure, text, image, SVG, form-state, and pseudo contribution is content-relevant; decoration is visual rather than content-relevant. Every eligible category is editability-relevant because native editable representation is the phase goal. Excluded candidates enter neither denominator. Runtime-unknown eligible sources use the stricter content/editability-relevant mapping rather than opting out.

For rendered candidates, paint eligibility SHALL require finite non-zero geometry remaining after captured ancestor display, visibility, opacity, and clipping rules. Exclusion for clipping is allowed only when full nonpainting is proven; complex or uncertain clipping remains eligible with unproven provenance. Eligibility SHALL NOT require intersection with the fixed-width/root-height artboard: negative-x, x greater than root width, transformed, fixed, and other no-clip visual overflow from the captured document remain eligible editable sources outside root bounds. Neutralized executable/runtime sources and inline event-handler runtime dependencies are the conservative exception and remain eligible unsupported even when neutralization prevents a measurable output box. An indexed original node unexpectedly detached, replaced, or reparented before final scan likewise remains conservatively eligible and makes source-inventory proof false rather than becoming an ordinary excluded node. Paint-eligible canvas/video/iframe/Shadow DOM content and any other unsupported visible feature likewise MUST remain eligible and therefore MUST close as `degraded`, `skipped`, or `error`; none of these sources may disappear by being unenumerated or reclassified as out of scope. Raw fixture observations such as DOM element, Text-node, image-instance, and pseudo-instance counts SHALL be stored separately from contribution cardinality.

#### Scenario: Indexed node changes unexpectedly before scan
- **WHEN** an original indexed node is detached, replaced, or reparented by anything other than an approved source-linked proxy operation before the manifest seals
- **THEN** its source remains eligible/unproven, `sourceInventoryComplete` is false, and it cannot disappear through a normal nonpainting exclusion

#### Scenario: One source emits multiple Figma nodes
- **WHEN** one Text node is split into multiple editable Figma text layers or one form-state source needs multiple native layers
- **THEN** the manifest still contains one source contribution and its ledger record lists every emitted output GUID

#### Scenario: Unsupported visible source remains eligible
- **WHEN** the settled document contains paint-eligible visible content outside the phase's native support matrix
- **THEN** the scanner includes it in the eligible inventory and conversion cannot report complete by omitting it

#### Scenario: Non-painting candidate remains countable
- **WHEN** an enumerated Element, Text node, image, SVG graphic, form control, pseudo, or decoration candidate fails its category's paint-eligibility rule
- **THEN** it closes as `excluded` under its stable source ID instead of disappearing from `scanned`

#### Scenario: Non-rendered metadata is excluded
- **WHEN** a metadata or neutralized declarative node has no paint-eligible rendered contribution
- **THEN** its enumerated candidate closes as `excluded`, has no impact flags or output GUIDs, and does not enter coverage denominators, unless it is a neutralized executable/runtime source that the conservative rule keeps eligible unsupported

### Requirement: The conversion ledger closes every scanned contribution exactly once
The converter SHALL return one raw terminal ledger record for every frozen manifest source without deduplicating repeated records. The only outcomes SHALL be `excluded`, `native`, `degraded`, `skipped`, and `error`. Every record SHALL include its source ID, category, privacy-safe reason code, `impactFlags` drawn from `content`, `editability`, `visual`, `hierarchy`, and `layout`, `contentPreserved`, `nativeEditable`, and role-linked outputs, plus an allowed fallback ID/evidence when a fallback is used. Output roles SHALL distinguish at least `native`, `visual`, `structural-placeholder`, and `raster` where applicable.

The aggregate invariants SHALL be `scanned = excluded + eligible` and `eligible = native + degraded + skipped + error`. `excluded` records SHALL have empty `impactFlags` and outputs, `contentPreserved: true`, and `nativeEditable: false`, and SHALL be ignored by coverage. `native` records SHALL have empty `impactFlags`, `contentPreserved: true`, at least one role-linked output, and `nativeEditable: true` for an editable contribution. `degraded` records MUST satisfy the selected manifest fallback policy including every required role/evidence and edge substitution. `skipped` and `error` records MUST have no outputs. If a requested terminal violates these field rules or its manifest policy, the ledger SHALL store a valid `error/invalid-terminal` record with no outputs; it MUST NOT return a malformed native/degraded/skipped record. Grouped diagnostics MAY combine equivalent privacy-safe reason codes for presentation, but grouped diagnostics MUST retain the raw occurrence count and MUST NOT replace the raw ledger.

#### Scenario: Repeated node failures remain countable
- **WHEN** two contributions with the same tag fail for the same reason
- **THEN** the raw report contains two terminal `error` records with distinct source IDs even if the UI groups them under one diagnostic category

#### Scenario: Caught failure does not stop accounting
- **WHEN** conversion of one contribution throws a caught exception
- **THEN** that contribution closes as `error`, sibling traversal continues, and every remaining scanned contribution also receives exactly one terminal record

#### Scenario: Ledger arithmetic is exact
- **WHEN** conversion finishes with any combination of excluded, native, degraded, skipped, and error records
- **THEN** both aggregate equations hold exactly and every aggregate count can be reproduced from the raw ledger

### Requirement: Coverage and result status follow one normative truth table
`contentCoverage` SHALL equal represented content IDs divided by eligible content IDs, where represented content IDs are native records plus degraded records with `contentPreserved: true`. `nativeEditableCoverage` SHALL equal natively editable content IDs divided by eligible editable content IDs. Hierarchy coverage SHALL compare preserved or explicitly approved paint-shell edges with the manifest's eligible hierarchy edges. Division by zero SHALL yield 1 only when the independent manifest proves that denominator is zero.

The result status SHALL be derived as follows and MUST NOT be selected independently by a caller:

- `complete`: every eligible record is `native`; degraded, skipped, and error counts are zero; content, native-editability, and hierarchy coverage are all 1.0.
- `degraded`: skipped and error counts are zero; every degraded record has a manifest-approved fallback ID, a non-empty output-GUID list, `contentPreserved: true`, and impact flags limited to visual, editability, or layout, except an approved `paint-shell-lift` MAY also flag hierarchy while preserving content, native editability, and paint order; every manifest content ID remains represented.
- `failed`: any eligible `skipped` or `error`; any degradation with the `content` impact flag; any degradation lacking an approved fallback ID, output GUID, or content preservation; any unapproved hierarchy loss; missing glyph; root failure; readiness/resource failure tied to a visible contribution; or a false source-inventory, resource, hierarchy, or paint-order proof flag.

`toClipboardItem()` and `toClipboardHtml()` MUST throw `IncompleteConversionError` for `failed` results. Application and extension callers MUST write the clipboard only for `complete` or `degraded` results; there is no strict/best-effort toggle. A failed attempt MUST leave the pre-existing clipboard value unchanged.

#### Scenario: Fully native document
- **WHEN** every eligible contribution closes as native
- **THEN** all three coverages are 1.0, `status` is `complete`, and clipboard helpers may serialize the result

#### Scenario: Approved non-fatal degradation
- **WHEN** every eligible non-native contribution has an approved content-preserving fallback and no skipped or error record exists
- **THEN** `status` is `degraded`, clipboard helpers may serialize the result, and the caller MUST present a persistent degraded state rather than native success

#### Scenario: Visible content cannot be represented
- **WHEN** an eligible visible contribution is skipped, errors, or receives no approved content-preserving output
- **THEN** `status` is `failed`, the privacy-safe source ID and reason are reported, both clipboard helpers reject, and the caller leaves the clipboard unchanged

#### Scenario: Missing glyph is fatal
- **WHEN** every configured font lacks a real outline for a rendered grapheme
- **THEN** the text contribution closes as `error`, content coverage is incomplete, and the result is failed rather than emitting a successful empty glyph path

### Requirement: Supported content remains natively editable
The converter MUST represent supported text, containers, image instances, SVG graphics, form state, pseudo-element text, and simple decoration as native editable Figma nodes. It MUST preserve rendered text graphemes and significant whitespace, account for visible current form state separately from placeholder text, and MUST NOT substitute a whole-page bitmap for editable content.

#### Scenario: Significant whitespace
- **WHEN** rendered white-space semantics preserve leading, trailing, or repeated spaces
- **THEN** the native Figma text contribution preserves those visible graphemes without unconditional trimming

#### Scenario: Current form value
- **WHEN** a supported input, textarea, select, button, checkbox, or radio exposes visible current state
- **THEN** the form-state contribution represents the current value or state separately from placeholder text as native nodes, or the contribution closes with a reported degraded/skipped/error outcome according to the status truth table

#### Scenario: Browser-selected image source
- **WHEN** Chromium selects a `picture` or `srcset` candidate that differs from the literal `src` attribute
- **THEN** the image contribution, cache identity, emitted bytes, and resource hash correspond to settled `currentSrc` and preserve the measured fit/crop semantics

#### Scenario: CSS background image
- **WHEN** a rendered frame has a resolved `background-image: url(...)` layer
- **THEN** its independently scanned decoration contribution is emitted as a native Figma image paint with supported repeat/size/position semantics or closes with an explicit outcome governed by the status truth table

#### Scenario: SVG image fallback
- **WHEN** an SVG loaded through an `<img>` cannot be preserved as editable vectors but can remain an image without losing its rendered pixels
- **THEN** the image contribution closes as `degraded` with the approved `SVG-image-raster` fallback, visual/editability impact flags, `contentPreserved: true`, `nativeEditable: false`, and its image-node output GUID

#### Scenario: Simple pseudo-element
- **WHEN** a visible `::before` or `::after` contribution contains supported text, solid or gradient paint, border, radius, opacity, transform, or simple rectangular/vector geometry
- **THEN** it is emitted at its independently measured paint position as native Figma text, vector, or frame nodes and closes as `native`

### Requirement: Local raster fallback is strictly isolated and bounded
Local raster fallback MAY be used only for one independently scanned `decoration` contribution with a manifest-approved `local-raster` fallback ID. The raster capture SHALL render only that target decoration; it MUST NOT contain pixels from text, form state, image, SVG, structure, pseudo text, or another decoration contribution. The owning semantic and editable nodes SHALL remain independently native.

The manifest SHALL freeze the target decoration's ink-overflow bounds before conversion. Raster bounds MUST be no larger than those bounds plus at most a one-CSS-pixel antialiasing fringe on each edge. The resulting raster rectangle MUST be at most 512 by 512 CSS pixels and its area MUST be at most 5% of the captured root area; both limits apply. A raster MUST NOT use the document root bounds, combine multiple contribution IDs, or substitute the owning semantic container. A raster whose bounds overlap native text or form-state geometry is allowed only when the manifest paint graph proves it is strictly behind those native layers and its pixels/compositing do not sample, contain, replace, or occlude them.

If the target depends on backdrop pixels, a filter input, mask, clip, non-normal blend, isolation group, or another contribution in a way that prevents target-only capture and independent recomposition, local raster isolation is unproven and conversion SHALL fail. An allowed local raster record SHALL have `impactFlags` containing visual and editability, `contentPreserved: true`, `nativeEditable: false`, a non-empty output-GUID list, exact raster bounds/area, and the approved fallback ID.

#### Scenario: Isolated decoration can be rasterized
- **WHEN** one unsupported decoration can be captured within its frozen ink bounds without sampling, containing, replacing, or occluding semantic content or another contribution
- **THEN** only that decoration is rasterized, its ledger record is degraded with exact bounds and area, and all semantic content remains native

#### Scenario: Raster candidate contains text or form pixels
- **WHEN** isolating a raster would capture, replace, or paint above native text or current form state
- **THEN** the local-raster fallback is forbidden and the contribution closes as skipped/error with `status: "failed"`

#### Scenario: Raster candidate has mixed compositing dependencies
- **WHEN** the effect requires backdrop, mask, clip, filter, blend, or isolation inputs from other contributions and target-only equivalence cannot be proven
- **THEN** conversion fails rather than flattening those dependencies into a larger bitmap

#### Scenario: Root-sized, oversized, or merged raster candidate
- **WHEN** a raster candidate uses root bounds, exceeds 512 by 512 CSS pixels, exceeds 5% of root area, exceeds its frozen ink bounds plus antialias fringe, or merges more than one source contribution
- **THEN** conversion fails and no whole-page or semantic-container bitmap is emitted

### Requirement: Hierarchy and paint order follow the manifest paint graph
The scanner SHALL freeze a stacking-context and paint-order graph covering background/border, negative z-index contexts, in-flow content, positioned auto/zero content, and positive z-index contexts, including contexts created by position/z-index, transform, opacity, filter, isolation, and blend. The converter SHALL preserve DOM ancestry whenever Figma ancestry can express the same graph.

When a descendant must interleave across a non-stacking ancestor, the converter MAY apply only the manifest-approved `paint-shell-lift` strategy: lift the editable visual node to the manifest-named nearest exported paint shell, leave a source-linked structural placeholder under the original parent, emit role-linked `visual` and `structural-placeholder` outputs, and record a degraded hierarchy impact. The manifest policy SHALL name the permitted original-edge substitution and required output-edge/geometry/paint evidence; the converter cannot author or broaden that policy. The lift is allowed only when content, native editability, measured geometry, and paint order remain equivalent. If those properties cannot all be preserved, conversion SHALL fail.

#### Scenario: DOM ancestry can preserve paint order
- **WHEN** the manifest paint graph can be represented within the converted DOM ancestry
- **THEN** every visual node remains under its converted DOM parent and sibling order matches the manifest paint order

#### Scenario: Controlled paint-shell lift
- **WHEN** one editable descendant must interleave across a non-stacking ancestor and the approved lift preserves content, native editability, geometry, and paint order
- **THEN** the visual node is lifted only to the manifest-named nearest paint shell, a source-linked placeholder remains in the original hierarchy, and the source closes as degraded only after matching the policy's substitution, evidence, and `visual` plus `structural-placeholder` output roles

#### Scenario: Paint-shell lift cannot preserve equivalence
- **WHEN** a proposed lift changes content, native editability, measured geometry, or paint order
- **THEN** the affected source closes as skipped/error and the result is failed

### Requirement: Auto Layout requires geometry and paint-order equivalence
The converter SHALL emit Figma Auto Layout only when reconstructed child positions and sizes match captured browser geometry within 0.6 CSS/Figma pixels and the resulting Figma sibling/stacking order is equivalent to the manifest paint-order graph. Otherwise it SHALL keep the container and children in absolute layout or use an independently approved paint-shell lift without changing content coverage.

#### Scenario: Geometry is not equivalent
- **WHEN** any reconstructed child position or size differs from the captured geometry by more than 0.6 units
- **THEN** the container uses absolute positioning and no normal-flow child is removed or made an outlier solely to retain Auto Layout

#### Scenario: Paint order is not equivalent
- **WHEN** Auto Layout insertion order cannot reproduce the manifest paint-order graph while preserving in-flow child order
- **THEN** the parent falls back to absolute layout or an approved paint-shell lift; it MUST NOT report an equivalent Auto Layout result

### Requirement: Canonical Chromium and Figma oracle is hash-bound and measurable
The repo-owned canonical fixture SHALL be captured with an exact 430 by 932 CSS-pixel Chromium viewport, DPR 1, 100% browser zoom, and `scrollTop = 0`. Complete root height SHALL be `ceil(max(html/body scrollHeight, offsetHeight, clientHeight, scrollY + rect.bottom))` and SHALL equal 5484 within ±1 CSS/Figma pixel for the pinned fixture and browser. The root SHALL be 430 units wide, SHALL NOT clip transformed/fixed visual overflow, and MUST NOT contain a root-sized bitmap.

The hand-reviewed canonical manifest SHALL be frozen before converter output and SHALL retain separate raw observations for 202 DOM elements, 87 non-empty rendered Text-node items, 17 image instances, 21 visible pseudo-element instances, 12 `→` graphemes, and 4 `✓` graphemes. All 21 pseudo contributions MUST close as native (`21/21`), canonical local-raster count MUST be zero, content coverage MUST be 1.0, and skipped/error/unreported-fallback counts MUST be zero. Any other degraded source MUST match an exact manifest-approved source ID, fallback ID, impact flags, and expected node kind.

One oracle run ID SHALL bind cryptographic hashes for the fixture, selected assets/resource manifest, frozen runtime `CaptureManifest`, canonical acceptance overlay, converter report, clipboard payload, source screenshot, both Figma copy-back payloads, both normalized Figma 1x exports, and the checked-in visual comparator implementation together with Chrome version, OS, DPR, zoom, viewport, Figma Web build, Figma Desktop build, and capture timestamp. Real-Figma acceptance SHALL paste the same hash-bound clipboard payload into both recorded Web and Desktop builds, copy it back, and compare exact characters, node kinds, parent and paint-shell edges, image/vector/blob hashes, output GUID linkage where preserved, and allowed degradation IDs.

The visual gate SHALL use the hash-bound checked-in `wtf-visual-v1` comparator. It SHALL convert both 1x inputs to 8-bit unpremultiplied sRGB RGBA, composite them over the canonical manifest's opaque `#ffffff` canvas background, and crop/pad by root coordinates to exactly 430 by 5484; no dynamic antialias mask is permitted, and off-root no-clip overflow is verified separately through structure and bounding boxes. `wtf-visual-v1` SHALL compute luminance SSIM with an 11 by 11 Gaussian window (`sigma = 1.5`, `K1 = 0.01`, `K2 = 0.03`) and count a changed pixel when any normalized RGB channel differs by more than 8/255. Whole-page SSIM MUST be at least 0.98, changed pixels MUST be at most 2%, and every required content bounding box MUST be within 1 CSS/Figma pixel on each edge. Manifest-specific complex-decoration paint assertions MUST also pass.

#### Scenario: Canonical browser capture
- **WHEN** the pinned canonical fixture is loaded at 430 by 932, DPR 1, 100% zoom, and `scrollTop = 0`
- **THEN** the independent manifest observations and source IDs match the frozen manifest, root geometry is 430 by 5484 ±1, all 21 pseudo contributions are native, local-raster count is zero, and every completeness invariant passes

#### Scenario: Canonical clipboard is decoded
- **WHEN** the canonical complete/degraded result is encoded and decoded before Figma paste
- **THEN** the decoded node-change structure, exact characters, node kinds, parent/paint-shell edges, asset hashes, output linkage, and allowed degradation IDs match the report and frozen manifest under the same run ID

#### Scenario: Canonical Figma Web and Desktop acceptance
- **WHEN** the identical hash-bound payload is pasted into the recorded Figma Web and Desktop builds and each result is copied back
- **THEN** both copy-back structures match the frozen manifest and report, no fatal content loss appears, and both 1x exports pass SSIM, changed-pixel, bounding-box, and manifest-specific paint thresholds
