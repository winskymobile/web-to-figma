## Context

`inferAutoLayout` returns `null` with no reason. `collectChildren` returns `null` on any non-empty direct Text node. Frame conversion spreads inferred stack fields or leaves `stackMode: "NONE"`.

Harden Non-Goal: Auto Layout coverage is not a success metric; 0.6px gate stays.

## Goals / Non-Goals

**Goals:**
- Stable bail reason enum + diagnostic per bailed container (deduped).
- Text nodes as flow items for inference measurement; walker already emits them.
- Tests: former text-bail becomes AL success when geometry matches; diagnostics present on non-uniform gap.

**Non-Goals:**
- Relaxing uniform gap or 0.6px verify.
- Prefer-edit / spacer spacing model.
- UI for per-layer bail reasons (diagnostics array is enough for v1).

## Decisions

### 1. tryInferAutoLayout API
Keep `inferAutoLayout(): T | null` for callers; add `tryInferAutoLayout(): { ok: true, value } | { ok: false, reason }`.

### 2. Flow item type
`FlowItem = Element | Text`. Rects for Text from `Range.selectNodeContents` + `getBoundingClientRect` relative to parent border box. Child stack overrides only apply to Elements.

### 3. Diagnostic code
`layout-infer-bailed` severity `warning`, include `reason` field. Dedup via existing diagnostic report keys.

### 4. report path
Pass `reportDiagnostic` into frame converter options from convert/walk (already on convert options).

## Risks

- Text in pure block stacks may still fail block-level display checks if mixed with inlines—OK.
- More warnings in toast if many containers bail—acceptable; message already aggregates counts.
