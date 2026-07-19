## 1. Frozen canonical source and completeness contract

- [ ] 1.1 Package a privacy/licensing-reviewed deterministic equivalent of the supplied 430px page and required assets as a repo-owned fixture; freeze independent observations for 202 DOM elements, 87 rendered non-empty text nodes, 17 image instances, 21 visible pseudo instances, 12 arrows, and 4 checkmarks
- [x] 1.2 Add RED browser tests for a pre-proxy source index and immutable conservative manifest: original IDs, slot-preserved removal bundle set/hash proof, synthesize/annotate validation, generation-node exclusion, safe-code privacy, all seven fixed cardinalities, iframe realms, significant whitespace, bound/unbound pseudo, off-root eligibility, and one-shot sealing
- [x] 1.3 Implement `indexCaptureSources` plus one-shot `scanCaptureManifest` independently of the walker, finalizing candidate eligibility/geometry with all independent proof flags conservatively false until opaque readiness/resource/graph enrichment exists; expose source-linked pseudo iteration/binding without recomputing IDs
- [ ] 1.4 Add RED browser/unit tests for settled `currentSrc` and CSS/pseudo resource resolution, decoration ink bounds, nearest eligible hierarchy/paint edges, manifest-owned discriminated fallback/output-role/evidence/edge-substitution policies, and canonical-overlay separation
- [ ] 1.5 Enrich and seal the runtime manifest with opaque baseline/removal completeness proof, resource/source-key hashes, ink bounds, fallback policies, hierarchy/paint facts, and proof flags without changing any source ID or letting converter output generate expectations
- [ ] 1.6 Add exhaustive RED unit tests for both count formulas, exactly one terminal record per manifest ID, role-linked outputs, invalid-terminal normalization, fallback-specific evidence, manifest-owned edge policy, immutable snapshots, grouped privacy-safe diagnostics, independent proof flags, and every status truth-table row
- [ ] 1.7 Implement the manifest-backed render-contribution ledger, coverage/edge summaries, raw-record preservation, grouped diagnostics with occurrence counts, and conversion-local status derivation
- [ ] 1.8 Add RED browser tests in which two same-tag manifest contributions fail, both raw errors retain distinct IDs, a later sibling converts, the result is failed, and both clipboard helpers reject
- [ ] 1.9 Thread manifest IDs through traversal with category-specific proof and source-linked diagnostic/fallback facts; conservatively leave every unproven contribution non-native
- [ ] 1.10 Add RED tests for the shared caller gate with complete/degraded/failed plus missing/unknown/malformed result shapes, then update web and extension callers to branch exhaustively and fail closed before clipboard access
- [ ] 1.11 Enable `IncompleteConversionError` in both clipboard helpers after caller compatibility; block every still-unproven eligible category rather than retaining an observe-only/best-effort copy path

## 2. Static import boundary and deterministic snapshot lease

- [ ] 2.1 Add RED import/browser tests proving inline/external/classic/module scripts and preloads, multiple handlers on one Element, `javascript:`/executable HTML `data:` URLs, iframe `srcdoc`/nested frames, object/embed, meta-refresh/navigation bypasses, and removed script/base path slots are neutralized before first load with correct observations
- [ ] 2.2 Implement a no-`allow-scripts` sandbox, execution-denying CSP, nonce-marked path-neutral infrastructure, pre-load executable/nested-document neutralization, inert comment slot preservation, and complete removal observations while leaving safe declarative resources available
- [ ] 2.3 Add RED browser tests that pin the canonical iframe to exactly `430 × 932`, assert `innerWidth = 430`, DPR 1, 100% zoom metadata, and `scrollTop = 0`, and cover top/bottom fixed, sticky, transformed fixed-containing-block, and `100vh` geometry
- [ ] 2.4 Add RED orchestration tests with injected hooks for the exact lease order: exclusive lease → width/height/scroll → baseline styles → source index → motion → font preparation → pseudo hook → final resource hook → stable frames → manifest/measure/walk → restoration; prove generation nodes do not change counts and font reflow is sampled only afterward
- [ ] 2.5 Implement the core `PreviewSnapshotLease` orchestration, baseline stylesheet fail-closed proof, viewport/DPR/zoom metadata, hook interfaces, stable-frame sampling, and reliable restoration; leave real manifest-resource and pseudo hook implementations to 4.8 and 5.3
- [ ] 2.6 Replace the full-height/20,000px presentation iframe with an exact-width real scrolling viewport so capture never changes `vh`, fixed, sticky, or responsive semantics

## 3. Document root, canvas, and viewport controls

- [ ] 3.1 Add RED converter/browser tests for document capture mode, `documentElement` walk root, synthetic root `stackMode: "NONE"`, disabled frame clipping/mask, no grow/stretch side effects, normalized HTML → BODY GUID edge, and descendants outside the 430-unit root
- [ ] 3.2 Add RED tests for the exact full-height formula and three canvas-background cases: HTML paints canvas, transparent HTML promotes BODY background once, and both are transparent; pin canonical root height to `5484 ±1`
- [ ] 3.3 Implement explicit document capture metadata, exact-width/full-height absolute synthetic root, one-time HTML/body canvas propagation, and non-clipping horizontal-overflow diagnostics without changing existing arbitrary-element or multi-frame compatibility
- [ ] 3.4 Add RED unit/UI tests for Mobile 430, category-bounded custom widths, invalid input fallback, persistence, exact iframe content width, and mutation blocking during the active conversion lease
- [ ] 3.5 Implement 430/custom viewport models and toolbar controls while preserving one Figma unit per CSS pixel and never expanding root width for horizontal overflow

## 4. Recursive resource closure and rendered image sources

- [ ] 4.1 Add RED tests for first-`<base>` local/external behavior, removal after rewrite, root-underflow rejection, HTML/inline/SVG resolution against the base, and linked stylesheet URLs remaining relative to their own stylesheet
- [ ] 4.2 Add RED tests for a canonical CSS-file parse cache plus active recursion stack, cyclic imports, repeated imports at distinct cascade positions, and preserved `media`, `supports()`, and `layer()` import-edge qualifiers
- [ ] 4.3 Add RED tests for HTML/CSS/SVG URL tokens, query provenance with query-free blob reuse, fragment preservation, `url(#local-id)`, `file.svg#id`, exact-path priority, deterministic case/suffix ambiguity rejection, source provenance, generation-owned blob deduplication, and stale-generation revocation safety
- [ ] 4.4 Implement the deterministic resource manifest and bounded CSS tokenizer with per-file parse caching, per-edge expansion semantics, active-cycle diagnostics, controlled base resolution, and generation-scoped object URL ownership
- [ ] 4.5 Add RED Chromium tests at DPR1 and DPR2 for `picture`/`srcset`/`sizes`, settled `currentSrc`, blob-to-original-manifest provenance, and cache identity; separately cover `cover`, `contain`, `none`, `scale-down`, and non-centered `object-position`
- [ ] 4.6 Implement browser-selected image source bytes and fit/crop transforms, wait for manifest-owned CSS/pseudo/SVG images as specified, and report visible unresolved sources through their contribution IDs
- [ ] 4.7 Repair and test the directory-input fallback's live `FileList` handling without changing the Chromium directory-handle primary path
- [ ] 4.8 Integrate the deterministic resource manifest with the snapshot lease's final-resource hook, including contribution-linked decode/readiness, timeout policy, and settled resource facts before manifest sealing

## 5. Pseudo-elements and bounded decorative raster

- [ ] 5.1 Add RED browser fixtures for absolute decoration, inline generated text, flex/grid pseudo items, `:empty`/child-selector stability, and before/after local paint comparison; prove all 21 canonical visible pseudos are independently discovered
- [ ] 5.2 Implement leased pseudo proxy materialization after font preparation and before final readiness, with original-pseudo suppression, source-ID linkage, layout/paint equivalence checks, and complete restoration
- [ ] 5.3 Integrate source-linked pseudo iteration/binding with the snapshot lease's pseudo hook, then re-run final font/image/resource readiness and stable geometry before manifest sealing
- [ ] 5.4 Convert pseudo text, simple geometry, solid/gradient paints, borders, radius, opacity, and transforms to native nodes; require the canonical fixture to finish with 21/21 pseudo contributions native and local-raster count zero
- [ ] 5.5 Add RED tests for local-raster eligibility: single closed decoration dependency, at most one-pixel antialias padding, at most 512 × 512 CSS pixels and 5% of root area, no semantic pixels or occlusion, strictly-behind geometric overlap only with paint-graph proof, and no external backdrop/blend/filter/mask/clip dependency
- [ ] 5.6 Implement source-linked local decorative raster with role-linked outputs, bounded-isolation evidence, and impact flags; make mixed, forbidden/unproven-overlap, oversized, element/section/viewport, or whole-page candidates `failed`

## 6. Native content, SVG/CSS images, hierarchy, and paint order

- [ ] 6.1 Add RED tests and preserve significant text whitespace, current input/textarea/select/checkbox/radio state, and fatal missing-glyph semantics
- [ ] 6.2 Add an independent SVG fixture covering primitives, text, defs/use, gradients, unsupported paint servers, masks, clips, filters, and external SVG `<img>` degradation; implement supported native vectors and report every fallback
- [ ] 6.3 Add an independent CSS-background fixture covering multiple URL layers, repeat, size, position, gradients, unresolved layers, and contribution cardinality; implement supported image paints and report each unsupported layer
- [ ] 6.4 Add RED mapping tests and close ordinary supported background-color, native gradient, border, box-shadow, filter, and backdrop-filter decoration IDs only when emitted paints/effects are equivalent; treat radius/opacity as equivalence evidence on the owning structure/border/paint rather than separate IDs, and leave mask/clip/blend or partially parsed declarations non-native
- [ ] 6.5 Add RED paint-order fixtures for negative z-index, nested stacking contexts, isolation/transform/opacity, fixed progress, sticky navigation over later flow, and a descendant that must interleave across a non-stacking ancestor
- [ ] 6.6 Implement the manifest paint-order graph and controlled `paint-shell-lift` with a source-linked structural placeholder; fail when content, editability, and paint equivalence cannot all be preserved
- [ ] 6.7 Add RED Auto Layout tests that require both strict 0.6px geometry and paint-order equivalence, and implement absolute fallback without leaf-shell/outlier inference or reordering normal-flow children

## 7. Web and real Chrome extension safety gates

- [ ] 7.1 Add RED web UI tests proving `complete` alone shows native success, `degraded` writes once and shows one persistent warning, and `failed` leaves a clipboard sentinel unchanged with no success toast
- [ ] 7.2 Enable the web clipboard gate and expose excluded/native/degraded/skipped/error/local-raster counts plus privacy-safe blocking diagnostics
- [ ] 7.3 Build the actual WXT MV3 extension and add a no-mock production-path Chrome E2E that loads it, opens its popup, seeds a clipboard sentinel, triggers copy, and proves a real failed result leaves the sentinel byte-for-byte unchanged, shows blocking diagnostics, and never shows success; keep missing/unknown-shape coverage in the shared production gate tests from 1.8
- [ ] 7.4 Extend the real extension E2E for degraded and complete results, require a persistent degraded warning versus native success, record Chrome/extension build metadata, and prohibit rollback of the failed-result no-write invariant

## 8. Canonical Chromium, clipboard, and Figma acceptance

- [ ] 8.1 Run the canonical fixture at exactly 430 × 932/DPR1/100% zoom/scrollTop0 and require root `430 × 5484±1`, content coverage 1.0, zero skipped/error/unapproved fallback, 17 native rendered image contributions, 21/21 native pseudo contributions, and no local or root-sized bitmap
- [ ] 8.2 Extend clipboard encode/decode and corpus gates to compare the frozen manifest, exact characters, node kinds, parent/paint-shell edges, image/vector/blob hashes, geometry, and exact approved degradation IDs rather than converter-generated minima
- [ ] 8.3 Paste the same payload into recorded Figma Web and Desktop builds, copy it back, and bind hashes for fixture/resource manifest/runtime manifest/acceptance overlay/payload/report/source screenshot/both copy-backs/both normalized exports/comparator with Chrome/Figma/OS versions and one run ID
- [ ] 8.4 Implement and hash-bind the checked-in `wtf-visual-v1` sRGB comparator, exact root crop/pad and off-root overflow assertions; require SSIM ≥ 0.98, changed pixels ≤ 2% at >8/255 RGB delta, required content bounding boxes within 1px, and all complex-paint assertions

## 9. Review, regression, and documentation

- [ ] 9.1 Run independent spec-compliance and code-quality reviews after every completed vertical slice and resolve all Critical/Important findings before checking that slice
- [ ] 9.2 Run app, real extension E2E, dom-to-figma, and fig-kiwi tests; strict TypeScript checks; production builds; `git diff --check`; and `openspec validate harden-whole-document-editable-export --strict`
- [ ] 9.3 Update capability documentation with supported/native/degraded matrices, capture-manifest and report schemas, snapshot assumptions, local-raster limits, resource/base semantics, extension safety gates, and the hash-bound canonical Figma procedure
