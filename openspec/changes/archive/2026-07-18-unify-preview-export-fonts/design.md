## Context

Today `preparePreviewFontsForConvert` injects Noto Sans SC and applies `!important` font-family to nearly all elements, while the converter uses `page-font-loader` → `cjk-font-loader`. That aligns system text with Noto but stomps page brand fonts and does not preload Inter used for symbol fallbacks.

Confirmed product choices for this change:

- Target: same-source approximation (not pixel-perfect).
- Page fonts first; Noto only for system/generic stacks.
- No browser line-box text pipeline yet.
- Degrade with toast on font fetch failures.
- Preload Inter for symbols on both sides.
- No raster/outline hard fallback this phase.
- Local-tool licensing note: users must have rights to embed page fonts.

## Goals / Non-Goals

**Goals:**

- Preview reflow fonts and converter embed fonts share the same binary sources when possible.
- Preserve non-system page families during convert prepare.
- Load Inter in preview before convert for symbol metrics.
- Report partial font failures without blocking copy.

**Non-Goals:**

- Rewriting multi-line layout to `getClientRects` baselines.
- Full glyph subset packing of embedded fonts.
- Automatic image/outline export for hard text cases.
- Perfect match for cross-origin fonts blocked by CORS.

## Decisions

### 1. Selective remap (not global Noto)

- Inject `@font-face` for Noto Sans SC plus the version-pinned full Inter v4.1 static faces.
- Walk text-bearing elements; if the primary computed family matches a system/generic list, set inline `font-family` to `"Noto Sans SC", "Inter", sans-serif` and remember restore.
- Do not apply universal `* { font-family: Noto !important }`.

### 2. Shared fallback stack

- Converter resolution is page faces → CJK Noto → version-pinned full Inter v4.1 static faces for symbols. The Fontsource latin Inter subset is not a valid symbol fallback because it omits `→` and `✓`.
- Symbol fallback requests carry an explicit purpose, bypass page `@font-face` matching, and use a separate font-cache key. This prevents a page-declared latin-only `Inter` face from intercepting or colliding with the full symbol face under the same family/weight/style.
- Preview prepare must load the same full Inter v4.1 fallback faces before measurement.

### 3. Page face discovery

- Keep CSSOM `@font-face` scan in `page-font-loader`.
- Use the preview document's own constructors (or constructor-independent checks) for iframe CSSOM objects; parent-realm `instanceof` checks are invalid.
- Resolve relative `url(...)` against the stylesheet href / document URL when possible.
- Fetch failures fall through to CJK loader and are recorded in a shared resolution report returned to the UI.

### 4. Observability

- `preparePreviewFontsForConvert` returns `{ restore, stats }` with remapped count, loaded faces, failures.
- Copy toast: success as today; if failures > 0, append a short warning toast.

### 5. Defer subsetting

- Embedding still uses full face bytes from page or CDN (existing behavior). Subsetting is a later change.

### 6. Preview-scoped cache lifecycle

- The converter may be reused within one preview session.
- Replacing or clearing the preview document MUST clear converter font and image caches, because cache keys do not include document identity or font bytes.

### 7. Iframe realm safety

- DOM and CSSOM values from the preview iframe MUST be tested with `ownerDocument.defaultView` constructors or structural/tag checks.
- Browser tests mount representative content in a real iframe so parent-document tests cannot hide cross-realm failures.

### 8. Glyph degradation

- A secondary version-pinned full Inter v4.1 static face supplies common arrows and checkmarks when the primary or page face lacks them; unicode-range Fontsource subsets are not used for this purpose.
- If no loaded face contains a character, the converter records a missing-glyph diagnostic and uses an empty glyph blob only as an explicit degradation; it never aliases another character's outline or invents a misleading synthetic symbol.

## Risks / Trade-offs

- **[Risk] CORS blocks page font fetch** → Toast + Noto/Inter fallback; layout may still differ for that family.
- **[Risk] Selective remap misses some system stacks** → Expand SYSTEM_FAMILY_RE as needed.
- **[Risk] Custom fonts still metric-differ under OpenType.js wrap** → Accepted until line-box phase.
- **[Risk] Same family name points to different bytes in a later import** → Clear converter caches when the preview document changes.
- **[Risk] Parent/iframe constructors differ** → Exercise all font preparation and CSSOM discovery through iframe browser tests.

## Migration Plan

- App behavior plus package-internal converter changes; rebuild the Docker SPA.
- Rollback by reverting prepare/loader/app toast changes.

## Open Questions

- None for phase 1 (decisions confirmed via recommended package).
