## 1. Preview font prepare

- [x] 1.1 Rewrite `prepare-preview-fonts.ts`: inject Noto SC + Inter faces; selective system-stack remap only; restore support
- [x] 1.2 Wait for injected faces (and optional page faces) with timeout; return load/remap/failure stats

## 2. Page font loader

- [x] 2.1 Resolve relative `@font-face` URLs against stylesheet/document base
- [x] 2.2 Keep page-first then CJK/Inter fallback chain; cache invalidation remains available

## 3. Copy UX

- [x] 3.1 Wire prepare stats into `onCopy`; warn toast when failures > 0
- [x] 3.2 Keep success path non-blocking on partial font degradation

## 4. Verify

- [x] 4.1 Add failing iframe browser tests for selective remap and `@font-face` discovery
- [x] 4.2 Make preview font preparation and CSSOM discovery iframe-realm safe
- [x] 4.3 Add failing tests for cache invalidation when the active preview changes
- [x] 4.4 Clear converter caches on preview replacement and session reset
- [x] 4.5 Add a shared font-resolution report covering page-face fetch fallback and missing glyphs
- [x] 4.6 Add regression tests for `→`, `✓`, and no unrelated-outline reuse

## 5. Verification

- [x] 5.1 Resolve current TypeScript failures in the affected paths and run app/package type checks
- [x] 5.2 Run unit/browser tests, build `web-to-figma`, and smoke-check the station without a universal Noto `!important` override
