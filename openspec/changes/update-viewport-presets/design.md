## Context

`apps/web-to-figma/src/lib/viewport.ts` owns `MOBILE_WIDTHS`, `PC_WIDTHS`, defaults, and `localStorage` load/save. The toolbar renders chips from `widthsFor(kind)`. Main spec `openspec/specs/export-viewport/spec.md` still lists the archived 2026-07-17 preset set.

Recommended product set (confirmed):

| Kind   | Widths                         | Default |
|--------|--------------------------------|---------|
| Mobile | 360, 375, 390, 430             | 375     |
| PC     | 1280, 1366, 1440, 1920         | 1440    |

## Goals / Non-Goals

**Goals:**

- Ship the recommended everyday preset lists with stable defaults.
- Keep one logical width driving both preview iframe width and export root width.
- Preserve invalid-stored-width fallback behavior.
- Keep OpenSpec main `export-viewport` aligned with code.

**Non-Goals:**

- Fixing half-pixel/`Math.round` right-edge drift (separate geometry change).
- Adding custom numeric width input (owned by harden delta later).
- Changing default Mobile to 430 or PC to 1920 in this change.
- Extension or playground viewport UX.

## Decisions

### 1. Replace rather than append

Keep four chips per category (toolbar density and current UI). Swap `414→430` and `1512→1366` instead of growing to five options.

### 2. Defaults stay 375 / 1440

Matches existing habit and archive scenarios; users targeting 430 H5 can one-click select 430. Revisit default-to-430 only if product later prioritizes that page class.

### 3. Persistence

Existing keys `web-to-figma:viewport-kind` / `web-to-figma:viewport-width` unchanged. `isWidthForKind` rejects removed widths so `414`/`1512` restore as category defaults — intentional **BREAKING** for stored prefs only.

### 4. Spec strategy

Delta-modify `export-viewport` in this change; implement code in the same PR/session. Harden’s broader delta remains separate and may still list custom ranges / old PC `1512` until rebased.

## Risks / Trade-offs

- [Users with saved 414/1512] → Fall back to 375/1440; acceptable for a utility tool.
- [Harden delta drift] → Document in proposal Impact; rebase when harden next edits export-viewport.
- [430 still has fractional grids at some breakpoints] → Does not claim to fix quantization; only improves preset relevance.

## Migration Plan

1. Update constants + types in `viewport.ts`.
2. Update main/delta specs and comments.
3. Typecheck web-to-figma; smoke toolbar chip list manually if needed.
4. No data migration script.

## Open Questions

- None for this change. Default-to-430 deferred.
