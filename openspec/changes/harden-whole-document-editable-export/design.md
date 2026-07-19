## Context

The station already rewrites common local references, renders a same-origin iframe, measures `body`/`documentElement` scroll extents, and produces editable Figma node changes. The canonical 430px page currently measures about 430 × 5483 CSS pixels and contains 202 elements, 87 non-empty text items, 17 image instances, and 21 visible pseudo-element instances. A current conversion emits editable frames, text, and all 17 images, but no pseudo-element layers; caught node failures are diagnostics rather than a completeness gate.

The current root path also conflates content extent with artboard width: horizontal overflow widens the export. The synthetic Figma root is always white, clipping, and `stackMode: "VERTICAL"`, while its body child is measured relative to an HTML ancestor that is not itself exported. The preview wrapper's border also makes a selected 375px viewport produce a 373px iframe viewport, and preview height is capped at 20,000px. These choices prevent a defensible “the Figma root is the captured document” contract.

Confirmed constraints are: content and editability before visual fidelity, hierarchy before Auto Layout, full scrolling page, root width equal to preview width, 430px canonical capture at DPR 1 / 100% zoom / `scrollTop = 0`, no independent 2x scale, no whole-page bitmap fallback, reported local raster fallback only for isolated decoration, and Chromium-only behavior for the first phase.

## Goals / Non-Goals

**Goals:**

- Produce one deterministic full-document snapshot and one named root Figma frame with explicit geometry and background semantics.
- Account for every render contribution, including structure, text, image, SVG, form state, decoration, and visible `::before` / `::after` instances.
- Keep supported content native and editable; make every degradation observable and prevent success after fatal content loss.
- Preserve ancestry and paint order, using Auto Layout only after exact geometry verification.
- Resolve the local resource closure deeply enough that readiness and missing-resource diagnostics describe the actual preview.
- Establish automated Chromium coverage plus a real Figma paste/copy-back oracle for the supplied canonical page.

**Non-Goals:**

- Executing arbitrary imported scripts or reproducing dynamic application runtime state.
- Shadow DOM, custom-element lifecycle, nested iframe capture, cross-origin access bypasses, or non-Chromium browser parity.
- Native editability for video, canvas pixels, arbitrary filters/blend pipelines, or every CSS painting primitive.
- Pixel-perfect equivalence with an unspecified version of another browser extension.
- Reintroducing export scale or making Auto Layout coverage a success metric.

## Decisions

### 1. Introduce an explicit snapshot lease

The app will create a `PreviewSnapshotLease` immediately before font preparation and conversion. One capture has this fixed order: acquire the exclusive preview-converter lease; freeze width, viewport height, scroll, DPR, and zoom metadata; await baseline stylesheet readiness without injecting capture nodes; freeze original DOM paths, candidate identities, and observations; install the motion/caret policy; prepare fonts; materialize source-linked pseudo proxies; await final `document.fonts` plus manifest/pseudo-owned image/resource decode; require stable document geometry across consecutive animation frames; finalize manifest eligibility/geometry from the frozen source index, measure, and walk; then restore all temporary state in `finally`. A baseline stylesheet failure that can change candidate discovery sets `sourceInventoryComplete: false` and blocks copy; it cannot proceed with an apparently empty denominator. Sandbox/CSP enforcement is configured outside the indexed document; motion, font, and pseudo nodes are inserted only after source indexing, so no public caller-controlled exclusion predicate can hide an original node. No readiness or stability sample taken before font preparation or pseudo materialization can satisfy the gate. The lease verifies that `iframe.contentWindow.innerWidth` equals the logical width (presentation borders must not consume viewport pixels), preserves the actual iframe viewport height, and sets `scrollTop = 0`. Every timeout becomes a readiness diagnostic. It is held inside the existing preview-converter lease so a new import, asset folder, width, or clear action cannot mutate the active snapshot.

Production conversion always uses one Figma unit per measured CSS pixel and records the browser's actual DPR; the station does not pretend it can change iframe DPR. Responsive images use the browser-selected `currentSrc`. The canonical automation launches a controlled DPR 1 Chromium context at 100% zoom.

The presentation iframe remains a real scrolling viewport rather than being resized to the document's full height. Full-page export uses scroll extents and off-viewport DOM geometry without changing `vh`, fixed, sticky, or responsive layout semantics. The current 20,000px presentation-height cap therefore leaves capture semantics entirely; capture height has no arbitrary cap.

Alternative: measure immediately after iframe `load`. Rejected because `load` does not prove fonts, decoded images, nested CSS resources, or layout stability.

Imported executable scripts are neutralized before the rewritten document is assigned to the iframe for its first load. Inline, external, classic, and module scripts plus inline event-handler attributes cannot execute in this static-document phase. The preview sandbox omits `allow-scripts`, and CSP is applied through an iframe/response mechanism outside the indexed DOM. Executable elements whose computed candidates matter remain same-slot inert originals with dangerous attributes removed and observations attached. A true removal uses only the capture module's opaque `CaptureRemovalBundle`, created from the complete inert pre-removal subtree; it inserts a nonce-bound comment slot and retains the module-computed candidate set/digest. The index accepts only module-issued bundles and sets source inventory proof false for an unmatched slot/bundle. Inline handlers annotate the one surviving Element candidate with a closed `inline-event-handler` code and occurrence count. Removed `<base>` elements use the opaque bundle but close excluded. Slot markers may be discarded only after source indexing.

### 2. Separate the synthetic document root from DOM layout inference

Single-frame conversion will accept capture metadata in addition to the DOM element: exact logical width, full height, root paints, and overflow information. The synthetic root frame is the paste root and will use the capture width even when descendants overflow horizontally. It will not clip overflow and will default to absolute layout; it will not unconditionally impose a vertical stack on the body. HTML/body background propagation follows browser canvas-background rules, with transparent fallback only when neither paints the canvas.

`document.documentElement` becomes the walk root, preserving the real HTML → BODY ancestry and eliminating body measurements relative to an unexported parent. Its exported root position is normalized to `(0, 0)` and its root size comes from the capture. Complete height is the maximum of documentElement/body scroll, offset, client, and reliable fractional root-rect extents after settlement. Fixed and sticky nodes reflect their rendered `scrollTop = 0` position against the recorded capture viewport height.

The synthetic root remains the transport/paste frame; the HTML frame is its real document child. Browser canvas-background propagation is resolved once onto the synthetic root, and the propagated copy is suppressed on the HTML/body child when needed to avoid double painting.

Alternative: continue converting `body` directly. Rejected because it loses HTML hierarchy/background/overflow semantics and computes body position and fill against an ancestor that is not exported.

### 3. Freeze an independent capture manifest before conversion

Completeness cannot use the converter walker as its own denominator. Before proxy insertion, `indexCaptureSources(documentElement, resourceManifest.captureObservations)` freezes original child-node paths, category candidates, pseudo identities, and pre-load neutralization/removal observations after baseline CSS is ready. Every structurally removed original node retains an inert comment slot through this indexing step, so surviving siblings keep their original indices. A `synthesize` observation occupies each removed candidate's original path; an `annotate` observation merges one or more provenance records into the existing fixed-cardinality candidate at that path without adding a contribution. After proxy materialization and final stability, `scanCaptureManifest(sourceIndex)` finalizes eligibility, geometry, browser-selected resources, and pseudo-proxy measurements without adding, removing, or renumbering candidates; both phases finish before any conversion classifier runs. Stable source IDs are the original imported sibling-index path plus a category and per-host ordinal, so rewrite removal, proxy nodes, stacking order, and converter emission cannot renumber them. The manifest and ledger share IDs, but the converter cannot change the denominator.

The v1 scanner first enumerates deterministic candidates and then classifies each candidate as `excluded` or `eligible`; absence from the scanner is never an exclusion mechanism. It uses these cardinalities:

- `structure`: one candidate for every Element; metadata/no-principal-box candidates are excluded, while paint-eligible and neutralized executable/runtime candidates remain eligible;
- `text`: one candidate for every Text node regardless of how many Figma line boxes it later emits; eligibility follows rendered CSS white-space semantics and non-empty Range geometry without trimming, so visibly spacing whitespace-only nodes remain eligible and only nodes with no rendered grapheme/spacing contribution or rect are excluded;
- `image`: one candidate for every `HTMLImageElement`, keyed to settled `currentSrc` and its resource-manifest entry, then excluded only when not paint-eligible;
- `svg`: one candidate for every `SVGGraphicsElement`, including unsupported tags, then excluded only when not paint-eligible;
- `form-state`: one candidate for every input, textarea, select, button, checkbox, or radio state, then excluded only when not paint-eligible;
- `pseudo`: one candidate per host and `before`/`after` whose computed content or any active paint property is non-empty, with reserved ordinals `before = 0` and `after = 1` even when only one exists, then excluded only when not paint-eligible; all paint layers owned by that pseudo, including URL backgrounds, remain facts of this one pseudo contribution and are not duplicated as host decoration candidates;
- `decoration`: one candidate for non-transparent background color, one per parsed background-image layer, one combined visible border contribution, one per box-shadow layer, and one for each active filter, backdrop-filter, mask, clip-path, or non-normal blend contribution; an inactive or non-painted candidate is excluded.

Metadata/non-rendered nodes and neutralized declarative resources are recorded as `excluded`; executable scripts, inline event handlers, paint-eligible canvas/video/iframe/shadow content, and every unsupported visible feature remain eligible and therefore become degraded/skipped/error rather than disappearing as “out of scope.” Paint eligibility requires finite non-zero paint geometry after ancestor display/visibility/opacity/clipping, but does not require intersection with the fixed-width root frame: negative-x, x greater than root width, transformed, fixed, and other no-clip visual overflow remain eligible editable sources outside root bounds. A neutralized executable/runtime source is conservatively eligible even though its script node has no principal box, because this static phase cannot prove its omitted output is empty. The scanner's observation block separately freezes raw fixture facts such as total DOM elements, text nodes, images, and pseudo instances; those observations are not confused with contribution cardinality.

Scanner type detection is iframe-realm safe: it uses `nodeType`, `localName`, `namespaceURI`, and `ownerDocument.defaultView` constructors rather than outer-window `instanceof` checks. Generation-owned motion/font/proxy nodes inserted after indexing are ignored except when a proxy is explicitly bound to an existing pseudo source ID.

The source-index foundation slice bounds computed `background-image` and `box-shadow` layer scanning to 65,536 code units, 64 nested function levels, 256 parsed top-level layers, and 131,072 scan steps. If any bound or syntax proof is exceeded, the scanner retains the proven prefix plus exactly one conservative remainder candidate with `candidate-parse-unproven`; it never drops the active property, and `sourceInventoryComplete` remains false. In this slice, only axis-aligned `overflow: hidden | clip` chains without transforms or compositing dependencies may prove full clipping. `clip-path`, mask, filter/backdrop, non-normal blend, pseudo paint, and shadow/external ink remain eligible/unproven until task 1.5 supplies safe ink and graph proof, even when a principal box alone appears fully clipped.

The runtime capture manifest freezes source facts: source ID, category, captured geometry/decoration ink bounds, a deterministic array of settled resource facts (`role/layerOrdinal`, source-key hash, bytes hash), paint/hierarchy facts, and manifest-owned fallback policies. This array allows one pseudo or decoration contribution to own multiple resource layers without double counting. Each fallback policy fixes allowed impact flags, required output roles/evidence, and any permitted hierarchy-edge substitution; a converter cannot self-approve an edge lift or invent an output role. `scanCaptureManifest` is one-shot: its first call seals and caches the manifest, later calls return that identical immutable object, and proxy/resource binding after sealing is rejected. The manifest also carries independent `sourceInventoryComplete`, `resourceProofComplete`, `hierarchyProofComplete`, and `paintOrderProofComplete` flags; any false flag prevents `complete` or `degraded`, even when an associated denominator is zero. Early vertical slices may therefore land conservative facts without authorizing success. A separate checked-in canonical acceptance overlay is reviewed and frozen before converter output is generated; keyed by those source IDs, it contains expected disposition/node kinds, exact fallback policies, and geometry/hierarchy expectations. Updating the overlay requires a source-fixture change plus independent review; converter output can never generate or rewrite expected values.

### 4. Add a conversion ledger beside diagnostics

Diagnostics explain individual degradations; they are not a coverage model. A conversion-scoped render-contribution ledger consumes the frozen manifest, retains one raw terminal record per eligible/excluded contribution without deduplicating repeated failures, then derives grouped diagnostics and aggregate counts without exposing page text:

- contribution categories: structure, text, pseudo, image, SVG, form-state, and decoration;
- outcomes: excluded, native, degraded, skipped, and error, with impact flags drawn from `content`, `editability`, `visual`, `hierarchy`, and `layout`, plus optional native-simplification, font-substitution, paint-shell-lift, SVG-image-raster, or local-raster fallback; every output GUID is paired with a manifest-recognized role such as `native`, `visual`, `structural-placeholder`, or `raster`;
- safe metadata: sibling-index path, tag/source kind, pseudo type, diagnostic code, and output GUIDs, never raw DOM text or stack traces.

Every scanned contribution closes exactly once. The invariants are `scanned = excluded + eligible` and `eligible = native + degraded + skipped + error`. Excluded records have no impact flags and do not enter coverage. Native/degraded records require at least one role-linked output GUID; skipped/error records have no outputs. A terminal request that violates outcome fields, fallback evidence/policy, edge substitution, or output roles is stored as a valid `error/invalid-terminal` record rather than exposing an impossible native/degraded/skipped row. A caught conversion exception closes its contribution as error while traversal continues to account for siblings. A missing glyph is an error; a successful page-font or symbol fallback is degraded. Local raster is degraded and must carry bounded-isolation evidence.

Status follows one normative truth table:

- `complete`: every eligible record is native; degraded/skipped/error are zero; content, native-editability, and hierarchy coverage are 1.0.
- `degraded`: skipped/error are zero; each degraded record has an allowed fallback ID, output GUID, `contentPreserved: true`, and impact flags limited to visual/editability/layout, except the explicit `paint-shell-lift` policy may also flag hierarchy while preserving content/editability/paint. All manifest content IDs remain represented.
- `failed`: any eligible skipped/error record; any content-impacting degradation; any degradation without an allowed fallback/output GUID/content preservation; an unapproved hierarchy loss; missing glyph; root failure; readiness/resource failure tied to a visible contribution; or any false independent source-inventory, resource, hierarchy, or paint-order proof flag.

`contentCoverage = representedContent / eligibleContent`, where represented content is native plus degraded records with `contentPreserved: true`. `nativeEditableCoverage = nativeEditableContent / eligibleEditableContent`. Division by zero yields 1 only for a manifest that independently proves the corresponding denominator is zero.

`ConvertResult` gains `status: "complete" | "degraded" | "failed"` plus a report. Existing document/encoding fields remain available for inspection, but `toClipboardItem()` and `toClipboardHtml()` throw `IncompleteConversionError` for failed results. This intentional behavior break prevents older web or extension callers from silently copying a partial failure. The app and extension write the clipboard only for complete/degraded results. Allowed font fallback or isolated decorative rasterization may copy with a persistent degraded warning. This is one strict mode for this phase rather than a strict/best-effort toggle.

### 5. Materialize supported pseudo-elements inside the leased snapshot

Chromium exposes pseudo computed styles but not pseudo DOM nodes or direct client rects. During the snapshot lease, visible `::before` and `::after` instances will be replaced temporarily by tagged proxy nodes built from their computed content and supported computed paint/layout properties; a scoped capture stylesheet disables the original pseudo while the proxy is present. The proxy participates in the same browser layout, can be measured by the existing walker, and carries source metadata so the ledger reports it as a pseudo rather than a normal element. All proxies are removed during lease restoration.

The first native subset is text, solid/gradient background, border, radius, opacity, transform, and simple rectangular/vector geometry. Unsupported complex decoration is eligible for local raster only when a single decoration contribution has a closed compositing dependency, its crop is the intersection of that contribution's paint bounds with the capture domain plus at most one CSS pixel of antialias padding, and the crop is at most 512 × 512 CSS pixels and at most 5% of root area. The raster pixels MUST NOT sample, contain, replace, or occlude text, form-state, image, or other semantic contributions. Geometric overlap is allowed only when the manifest paint graph proves the target is strictly behind all overlapping native semantic layers and target-only capture/recomposition is independent; any overlap above, sampling dependency, or ambiguous order fails. The raster cannot depend on backdrop/blend/filter/mask/clip inputs outside the candidate contribution. The raster node retains a source ID and output GUID and records `contentPreserved: true`, `nativeEditable: false`, and visual/editability impact. Any larger, mixed, unproven-overlap, or externally composited candidate is skipped/error and makes the result failed; element-, section-, viewport-, and whole-page screenshots are forbidden.

Alternative: infer pseudo boxes from computed CSS alone. Rejected because computed style does not expose final pseudo geometry. Whole-element screenshots are also rejected because they destroy editability of unrelated content.

### 6. Preserve paint order before maximizing Auto Layout

The scanner builds a stacking-context/paint-order graph using Chromium's background/border, negative z-index context, in-flow, positioned auto/zero, and positive z-index phases, including contexts established by position/z-index, transform, opacity, filter, isolation, and blend. When Figma ancestry can express this order, the walker preserves DOM ancestry. When a descendant must interleave across a non-stacking ancestor, the converter may lift only that editable visual layer to a nearest exported paint shell, leave a source-linked structural placeholder, and record an allowed `paint-shell-lift` hierarchy degradation. If content/editability/paint order cannot all be preserved by that controlled lift, conversion fails.

Absolute-layout parents emit the manifest paint order. Auto-layout inference remains at the strict 0.6px geometry gate and additionally requires an equivalent paint-order graph; direct text flow, irregular gaps, unsupported order/alignment, or paint-order conflicts fall back to absolute. Positioned children may remain absolute within a stack only when their insertion order preserves paint order without changing the relative order of in-flow children; otherwise the parent falls back to absolute or the explicit paint-shell policy.

No outlier algorithm may convert a normal-flow child to absolute solely to keep the parent as Auto Layout. Auto Layout coverage is reported for analysis but is not an acceptance threshold.

### 7. Build a recursive, provenance-aware local resource manifest

`rewriteHtmlDocument` will delegate to a resource-manifest builder that owns URL normalization, query/fragment provenance, blob reuse, and referring-source metadata. It will handle HTML URL attributes, `srcset`, SVG `href`/`xlink:href`, inline/style-block `url(...)`, stylesheet `url(...)`, and recursive `@import`. Existing external/data/blob URLs remain unchanged. The selected folder is the maximum readable boundary. Only the first `<base href>` applies: a local base changes HTML/inline/SVG resolution and is removed after rewrite; an external base makes later relative references external; parent traversal that underflows the selected root is unresolved rather than clamped. Linked stylesheet resources always remain relative to the stylesheet's own path.

CSS uses a canonical-file parse cache plus an active recursion stack, not a global “expand once” set. Each import edge preserves cascade order and media/supports/layer qualifiers while cyclic active edges terminate with diagnostics. Exact normalized paths win; case-fold collisions or multiple suffix/basename matches are unresolved ambiguity, sorted deterministically, and never depend on directory enumeration order. `url(#local-id)` remains a document fragment; `file.svg#id` shares file bytes/object ownership while retaining `#id` in the rewritten URL. Because Chromium rejects `blob:` URLs with an appended query, local query variants retain their query byte-for-byte in edge provenance and semantic/cache identity but use the same query-free blob URL; fragment suffixes remain attached to the rewritten URL. The station must not claim that a local server-side query response was reproduced.

The first implementation will replace regex-only CSS splitting with a bounded tokenizer that understands strings, comments, escapes, `url()`, and `@import`, without adding a full CSS parser dependency. Unsupported CSS token shapes are reported with provenance instead of silently assumed resolved.

### 8. Make the canonical fixture a layered acceptance oracle

The canonical page will have a privacy/licensing-reviewed checked-in fixture or deterministic equivalent plus a hand-reviewed source manifest frozen before converter implementation. Its capture input is exactly 430 × 932 CSS pixels, DPR 1, 100% browser zoom, and `scrollTop = 0`; full-height calculation is `ceil(max(html/body scrollHeight, offsetHeight, clientHeight, scrollY + rect.bottom))`, expected to produce 5484 with ±1px tolerance for the pinned fixture/browser. Transformed/fixed visual overflow does not enlarge the root because root clipping is disabled. Browser acceptance has four layers:

1. snapshot: width, height, readiness, and source counts;
2. conversion: root fields, native/degraded/skipped/error counts plus derived result status, glyph/image/pseudo coverage, and hierarchy/paint invariants;
3. clipboard: encode/decode and Figma node-change structure;
4. real Figma: paste the same payload in recorded Figma Web and Desktop builds, copy back, distill, and compare exact characters, node kinds, parent/paint-shell edges, image/vector/blob hashes, and allowed degradation IDs. Bind hashes for the fixture, asset/resource manifest, runtime manifest, acceptance overlay, payload, report, source screenshot, both copy-back payloads, both normalized Figma exports, and the checked-in comparator implementation together with Chrome version, OS, Figma build/version, and capture timestamp under one run ID.

The visual gate uses the checked-in `wtf-visual-v1` comparator whose source hash is bound to the run. It converts both 1x inputs to 8-bit unpremultiplied sRGB RGBA, composites them over the canonical manifest's opaque `#ffffff` canvas background, and crops/pads by root coordinates to exactly 430 × 5484; no dynamic antialias mask is allowed. Off-root no-clip overflow is checked through structural and bounding-box assertions rather than silently expanding this raster canvas. `wtf-visual-v1` computes luminance SSIM with an 11 × 11 Gaussian window (`sigma = 1.5`, `K1 = 0.01`, `K2 = 0.03`), and counts a changed pixel when any normalized RGB channel differs by more than 8/255. Whole-page SSIM must be at least 0.98, changed pixels at most 2%, and required content bounding boxes within 1 CSS/Figma pixel. Complex-decoration regions also have manifest-specific paint assertions.

The supplied external `/Users/vincent/Downloads` files are discovery inputs, not a permanent test dependency. Automated tests must use a repo-owned fixture or generated equivalent. Real Figma acceptance is required before declaring canonical fidelity complete, but independent unit/browser slices remain runnable without Figma.

### 9. Deliver in gated vertical slices

Implementation order is: canonical manifest and RED baseline; completeness ledger; root snapshot geometry; resource closure/readiness; pseudo native subset; hierarchy/paint and local raster fallback; UI gate; real Figma oracle. Each slice receives a focused RED test, implementation, independent spec review, code-quality review, and fresh regression run before its task is checked.

The extension gate is exercised through the actual production WXT Manifest V3 build in pinned Chrome. Its E2E opens the real popup, seeds a multi-MIME clipboard sentinel, and follows the popup → injected trigger → content converter → status gate → Clipboard API → toast path. Failed, missing-status, or unknown-status results must leave every sentinel byte unchanged and show no success state; degraded writes once with a persistent warning, and complete alone shows native success. This failed-result no-write invariant remains active through any supported rollback.

## Risks / Trade-offs

- **[Risk] Snapshot settlement never becomes perfectly idle** → use bounded waits, stable-geometry sampling, and explicit timeout diagnostics rather than indefinite waiting.
- **[Risk] Pseudo proxy materialization perturbs layout** → compare geometry before/after materialization, scope styles by capture IDs, and mark the pseudo unsupported when equivalence cannot be proven.
- **[Risk] Strict completeness blocks pages that previously copied partially** → show actionable categories and allow only proven non-fatal degradation; never restore a false success path.
- **[Risk] Fixed/sticky semantics are ambiguous on a full page** → define one static `scrollTop = 0` snapshot and record positioning modes in the manifest.
- **[Risk] Root width no longer expands for horizontal overflow** → disable root clipping, preserve off-frame editable nodes, and show a geometry warning.
- **[Risk] Local raster fallback becomes a shortcut** → enforce the closed-compositing, crop-size, semantic-overlap, and source-ID rules above; count every use and fail any mixed or oversized candidate.
- **[Risk] Recursive resources create cycles or object-URL leaks** → canonical-file parse caching plus an active recursion stack, one object-URL owner per preview generation, and existing generation/revocation gates.
- **[Risk] The canonical fixture or Figma normalization changes** → pin fixture bytes and acceptance environment metadata; update an oracle only after a documented paste/copy-back clean comparison.

## Migration Plan

1. Add the independent manifest and result status/report metadata while retaining the encoded clipboard format, then update web and extension callers to branch exhaustively before enabling failed-result rejection.
2. Enable failed-result helper rejection immediately after caller compatibility in the same vertical slice. Until later native-category slices prove and close text/image/SVG/form/pseudo/decoration contributions, those unproven pages intentionally block rather than copy through an observe-only or best-effort escape hatch; the real MV3 sentinel test later becomes the release gate.
3. Add 430/custom widths and switch root width/overflow behavior with regression coverage.
4. Enable recursive resources and pseudo conversion by supported subset.
5. Record the accepted Figma oracle and make canonical completeness a release gate.

Rollback is code-only: the new snapshot, pseudo, resource, or paint-order implementations may revert independently, but the failed-result clipboard no-write invariant MUST remain enabled. No persisted user data migration is required; invalid stored custom widths fall back to the existing category defaults.

## Open Questions

None for the first Chromium static-document phase. Additional browser engines, runtime script capture, Shadow DOM, and broader local raster policy require separate changes.
