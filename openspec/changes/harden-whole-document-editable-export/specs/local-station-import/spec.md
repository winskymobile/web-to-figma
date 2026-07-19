## MODIFIED Requirements

### Requirement: Relative assets are resolved against the asset folder
The station SHALL treat the selected asset-folder root as a virtual, controlled origin for the imported HTML. It SHALL resolve discoverable local references from resource-bearing HTML attributes, `srcset` / `imagesrcset`, inline style attributes and `<style>` blocks, inline SVG `href` / `xlink:href`, linked stylesheet CSS, and nested CSS imports. No lookup or rewrite MAY read a file outside the selected folder.

For document-relative references, the station SHALL apply the first `<base>` element that has an `href`, matching Chromium's first-base rule. A local base is resolved with URL path semantics against the virtual asset root and becomes the base for HTML attributes, inline CSS, and inline SVG references. A hierarchical external base makes its relative references external absolute URLs; those references MUST NOT be looked up in the selected folder. If resolving a base would traverse above the asset root, the base is invalid: the station MUST report `base-path-escape`, MUST NOT clamp it to the root or fall back to a same-named local file, and MUST leave every reference that depends on that invalid base unresolved. After references have been classified and rewritten or materialized, the station MUST remove every `<base>` element from the preview document so the blob-document URL cannot change the resolved result. Each removed base leaves an inert non-Element comment slot and a synthesized excluded-source observation through capture indexing, preserving every later original sibling path; the comment is not itself a contribution.

A reference inside a linked or imported local stylesheet SHALL always resolve relative to that stylesheet's canonical selected-folder path, regardless of the document base. If a selected SVG resource is inspected for nested local references, those references SHALL resolve relative to that SVG file; inline SVG continues to use the effective document base.

The resolver SHALL split each local URL into a normalized path component, query, and fragment. Only the path component participates in selected-file lookup. Query and fragment suffixes MUST be preserved byte-for-byte in edge provenance. Because Chromium does not load a `blob:` URL with an appended query, resolved local query variants SHALL use the same query-free generation-owned blob URL and retain the query in provenance/semantic cache identity; the station MUST NOT claim server-side query-dependent bytes. A fragment suffix SHALL remain appended to the rewritten blob URL. A fragment-only reference such as `url(#paint)` or `href="#icon"` is an in-document reference and MUST remain unchanged without an asset lookup. A file reference such as `icons.svg#logo` MUST look up `icons.svg`, rewrite it to the selected file's blob URL, and retain `#logo`.

#### Scenario: Matching relative path
- **WHEN** the HTML references `css/main.css` and the folder contains `css/main.css`
- **THEN** the preview loads an inlined or rewritten stylesheet and every nested local reference in that stylesheet resolves relative to `css/`

#### Scenario: First local base is applied and removed
- **WHEN** the first `<base href="pages/mobile/">` precedes `<img src="../images/hero.webp?v=2#frame">`, and the selected folder contains `pages/images/hero.webp`
- **THEN** lookup uses `pages/images/hero.webp`, provenance preserves `?v=2#frame`, the query-free rewritten blob URL appends `#frame`, later `<base>` elements are ignored for resolution, and no `<base>` element remains in the preview document

#### Scenario: External base materializes external references
- **WHEN** the first base is `<base href="https://cdn.example.test/site/">` and the HTML contains `<img src="images/hero.webp">`
- **THEN** the image URL becomes `https://cdn.example.test/site/images/hero.webp`, is classified as external, is not matched to a selected local file, and all `<base>` elements are removed before preview load

#### Scenario: Base underflow is unresolved rather than clamped
- **WHEN** the first local base is `<base href="../../outside/">` and a relative image depends on that base
- **THEN** the station reports `base-path-escape` with the base and HTML source provenance, performs no selected-file lookup for the dependent image, does not substitute an asset-root file with the same basename, and removes the base before preview load

#### Scenario: Inline and external CSS use different bases
- **WHEN** a document with local base `pages/` contains inline CSS `url("images/a.png")` and links `../css/main.css`, whose rules contain `url("images/b.png")`
- **THEN** the inline URL resolves from `pages/`, the linked stylesheet reference itself resolves from the document base, and the stylesheet URL resolves from the canonical directory of the matched stylesheet rather than from `pages/`

#### Scenario: Nested stylesheet import preserves SVG fragment
- **WHEN** `css/main.css` imports `theme/base.css` and that stylesheet references `../images/mark.svg#logo`
- **THEN** the station resolves the import from `css/`, resolves the SVG from `css/theme/`, rewrites the selected SVG file, and preserves the `#logo` fragment

#### Scenario: Query and fragment do not change file identity
- **WHEN** `img/photo.webp?v=1#top` and `img/photo.webp?v=2#bottom` both resolve to the same selected file
- **THEN** both manifest edges use lookup key `img/photo.webp`, retain `?v=1` / `?v=2` in provenance, rewrite to the same query-free generation-owned blob base URL, append `#top` / `#bottom` respectively, and do not synthesize query-dependent file bytes

#### Scenario: Internal fragment requires no file
- **WHEN** CSS or inline SVG references `url(#gradient)` or `href="#shape"`
- **THEN** the reference remains byte-for-byte unchanged, creates no missing-resource entry, and creates no blob URL

#### Scenario: Safe declarative absolute and data URLs remain external
- **WHEN** a safe declarative image/font/style/paint context references an `http(s):`, `//`, `data:`, or existing `blob:` URL without a relative external base rewrite
- **THEN** the station leaves that reference unchanged, identifies it as external rather than local, and performs no selected-folder lookup; executable, nested-document, object/embed, navigation, and refresh contexts remain subject to the static-boundary neutralization requirement

### Requirement: Missing assets are listed without blocking workflow
The station SHALL report every unresolved local reference with its raw reference, normalized path lookup key when one exists, preserved query/fragment suffix, referring HTML/CSS/SVG source, resource kind, deterministic reason code, and severity. Missing, ambiguous, escaped, cyclic, and unsupported-token outcomes MUST remain distinguishable. Missing resources MUST NOT prevent preview creation, but a later conversion SHALL apply the completeness gate when an unresolved or substituted resource causes rendered content or editability loss.

#### Scenario: Missing file listed
- **WHEN** the HTML references `img/logo.png` and the folder has no matching file
- **THEN** the station lists `img/logo.png`, its HTML source, image kind, `not-found` reason, and severity while still rendering the best available static preview

#### Scenario: Missing nested CSS resource
- **WHEN** an inlined stylesheet references an unavailable font or image
- **THEN** the missing entry identifies the canonical stylesheet path and import provenance as its source instead of reporting an unqualified top-level path

#### Scenario: Ambiguous resource is not reported as missing
- **WHEN** a fallback alias matches two distinct selected files
- **THEN** the station reports an `ambiguous-alias` entry with deterministically ordered candidate paths and does not classify the reference as `not-found`

## ADDED Requirements

### Requirement: Resource closure is deterministic and cycle-safe
The station SHALL build one deterministic resource manifest for each preview generation. Each reference edge SHALL retain its source, raw URL, path lookup key, suffix, resource kind, resolution outcome, selected-file identity when resolved, and generated blob provenance when applicable.

Asset lookup SHALL use ordered resolution tiers. A case-sensitive exact normalized path match wins before any fallback. Explicit aliases that all identify the same selected file SHALL be deduplicated before ambiguity is evaluated. A case-insensitive path fallback or suffix/basename fallback MAY resolve only when all matches identify one distinct selected file. If a fallback tier matches multiple distinct files, the reference MUST remain unresolved as `ambiguous-alias`; the resolver MUST NOT choose the first enumerated file. Candidate and manifest ordering SHALL be deterministic by canonical selected-folder path and source order, independent of directory-handle enumeration order.

Local CSS SHALL use a canonical parse cache keyed by selected-file identity and an active recursion stack for cycle detection. A file's bytes MAY be tokenized once per generation, but every syntactically supported `@import` edge SHALL be applied at its original source position, including repeated imports of the same cached file. The station SHALL preserve cascade order and the semantics of each edge's media list, `supports()`, and `layer` / `layer()` qualifier. Encountering a target already on the active recursion stack SHALL suppress only that cyclic back-edge, report a non-fatal `css-import-cycle` diagnostic with the complete import chain, and allow later non-cyclic import edges to the cached stylesheet.

Every object URL SHALL have exactly one preview-generation owner. Within a generation, all aliases and query/fragment variants of one selected file SHALL reuse one query-free blob base URL, every referring edge SHALL retain separate query/fragment provenance, and fragment variants MAY append their fragment to that base. A stale, discarded, cleared, or superseded generation SHALL revoke only URLs it owns and MUST NOT publish its manifest or revoke URLs owned by another generation. Opaque blob URL token values need not be stable across runs, but file identity, edge order, outcomes, and provenance SHALL be deterministic.

#### Scenario: Exact path wins before ambiguous fallbacks
- **WHEN** `icons/logo.svg` is an exact case-sensitive match and other selected files also end in `logo.svg`
- **THEN** the exact file resolves without ambiguity and suffix candidates are not considered

#### Scenario: Case-insensitive fallback is ambiguous
- **WHEN** a reference has no exact match and case-insensitive comparison matches two distinct selected paths
- **THEN** the reference remains unresolved as `ambiguous-alias`, candidate paths are sorted deterministically, and no blob URL is created for that edge

#### Scenario: Unique suffix aliases one file
- **WHEN** several generated aliases for a reference all point to the same selected file and no exact match exists
- **THEN** the resolver deduplicates them by selected-file identity, resolves the one file, and records which fallback tier was used

#### Scenario: Cyclic CSS imports suppress only the back-edge
- **WHEN** stylesheet A imports B and B imports A
- **THEN** A and B are each tokenized at most once, the B-to-A back-edge is not expanded, the full A-to-B-to-A chain is reported as non-fatal, and preview generation completes

#### Scenario: Repeated imports preserve edge qualifiers and order
- **WHEN** a stylesheet imports the same cached file once with `layer(theme) supports(display: grid) screen` and again with a different layer or media qualifier
- **THEN** the target file is parsed once, both import edges remain in their original cascade positions, each qualifier retains equivalent Chromium semantics, and neither edge is discarded merely because the file is cached

#### Scenario: One file and multiple suffixes share a blob owner
- **WHEN** HTML, CSS, and SVG edges with different aliases or suffixes resolve to the same selected image
- **THEN** the manifest contains every referring edge and one generation-owned blob base URL mapped back to the image's canonical selected-folder path

#### Scenario: Superseded preview generation cannot affect the winner
- **WHEN** a newer HTML or asset selection replaces a build while its resource closure is still resolving
- **THEN** the older build cannot publish its manifest and can revoke only its own generated object URLs, while the newer generation's URLs and provenance remain valid

### Requirement: Executable imported content is neutralized before preview
The station SHALL establish the static-document execution boundary while rewriting the imported source and before assigning the preview iframe's first URL. The preview sandbox MUST omit `allow-scripts`, and the rewritten document MUST install an execution-denying CSP for scripts, object/embed content, nested frames, and navigation. Executable inline, external, classic, and module `<script>` content plus script/module preload hints MUST be neutralized before parsing in the preview iframe, and external script resources MUST NOT be requested for execution. Case-insensitive inline event-handler attributes on HTML or SVG elements, `javascript:` URLs, executable HTML `data:` URLs, iframe `srcdoc` or nested-frame sources, object/embed sources, and `<meta http-equiv="refresh">` navigation MUST be neutralized before first load. Non-executable data blocks MAY remain only when Chromium would treat their MIME type as inert.

The resource manifest SHALL record every neutralized script/preload, inline handler, executable URL, nested document, object/embed, and refresh/navigation source with its original privacy-safe sibling-index path and an `unsupported-runtime` reason. CSS-dependent executable elements SHALL remain same-slot inert originals wherever possible. A true removal MUST use the capture module's opaque `CaptureRemovalBundle`, which inserts the nonce-bound slot and carries the complete pre-removal candidate set/digest; arbitrary caller-authored synthesis is forbidden. Surviving handlers use the closed `inline-event-handler` provenance code with an occurrence count. The scanner marks source inventory proof false for unmatched slot/bundle state. The static preview covers only the resulting initial DOM and MUST NOT claim potential runtime-generated output was converted. When a neutralized source is associated with rendered state unresolved because execution/navigation was prevented, that contribution SHALL carry runtime provenance and reach the completeness gate.

#### Scenario: Inline and module scripts cannot run before the lease
- **WHEN** imported HTML contains an inline classic script and a module script that would mutate the DOM or a station global
- **THEN** neither script executes during the first iframe load, both are recorded as `unsupported-runtime`, and the static DOM presented for readiness is the rewritten script-free DOM

#### Scenario: External script is not requested for execution
- **WHEN** imported HTML contains `<script src="js/app.js">`
- **THEN** the preview makes no executable request for `js/app.js`, records the raw source and HTML provenance, and does not rewrite it into a runnable blob script

#### Scenario: Inline handler on visible content is neutralized
- **WHEN** a rendered HTML or SVG element contains an `onload`, `onerror`, `onclick`, or other `on*` attribute
- **THEN** the attribute cannot execute in the first preview load, the diagnostic identifies the affected element without exposing its text, and any unresolved visible state that depended on the handler is linked to the `unsupported-runtime` outcome

#### Scenario: Nested execution cannot bypass the static boundary
- **WHEN** imported HTML contains executable iframe `srcdoc`, a nested-frame source, object/embed content, `javascript:`, or an executable HTML `data:` URL
- **THEN** sandbox, CSP, and rewrite prevent execution and same-origin authority, no nested executable request succeeds, and the source is recorded as `unsupported-runtime`

#### Scenario: Refresh navigation cannot replace the static preview
- **WHEN** imported HTML contains `<meta http-equiv="refresh">`, script/module preload, or another automatic executable/navigation hint
- **THEN** rewrite and sandbox/CSP prevent the request or navigation before first load, preserve source-path accounting, and record `unsupported-runtime`

#### Scenario: Inert data script remains non-executable
- **WHEN** a `<script type="application/json">` contains data but no executable JavaScript semantics
- **THEN** the station MAY retain the data block, MUST NOT execute it, and does not classify the block itself as rendered content
