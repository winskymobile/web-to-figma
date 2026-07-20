## Context

`inferAutoLayout` for `display: grid` tries `inferBlockStack` then `inferWrapStack(..., "grid")`. A 2-column `auto 1fr` header is one visual row with unequal track widths; wrap simulation packs by intrinsic widths and does not model CSS grid tracks, so `.stage-head` fails verify. Equal 2-column `.shot-grid` already fits wrap when child widths + gap match greedy packing.

## Goals / Non-Goals

- **Goals:** Layered AL for stage-card subtrees; first-class path for single-row 2-child grid headers; fixtures; keep diagnostics honest.
- **Non-goals:** Outer stage-card forced VERTICAL; arbitrary multi-column fr tracks; spacer-based non-uniform gaps; relaxing 0.6px; prefer-edit mode.

## Decisions

### 1. New path: `inferSingleRowGridStack` (before wrap)

When `display: grid|inline-grid` and flow length === 2 (elements only for v1):

1. Compute child rects (already available).
2. Same row if `|y0 - y1| <= 0.6` and both heights overlap substantially (or tops within 0.6 with align-items start).
3. Reject if more than one measured row would be needed (either child wraps below).
4. Treat as HORIZONTAL stack:
   - `stackSpacing` = horizontal gap between the two boxes (must be ≥ -0.6 and finite).
   - Primary align MIN (v1); if justify-content is center/end and geometry needs it, only accept if verify passes with mapped justify.
   - Counter align from `align-items` / `align-items: start` → MIN (map like flex).
   - Padding: CSS border+padding first; if verify fails, measured pads from children (reuse flex measured-pad helper).
5. `verifyGeometry` must pass (0.6).
6. Optional: if second child's width ≈ parent inner width − first width − gap − pads within 0.6 and template suggests fr/fill, set `stackChildPrimaryGrow: 1` on second **only when** that matches existing grow emission rules (equal-split caution: for 1fr next to fixed, Figma fill-container is appropriate when measured width equals remaining space).

Eligibility signals (any is enough with geometry verify):

- `grid-template-columns` parses to two tracks where one is fr and the other is auto/max-content/min-content/fixed px; or
- Measured: left width << parent content width and right extends to content edge (within pad).

### 2. Order of attempts for grid

```
if grid:
  singleRow = inferSingleRowGridStack(input)
  if singleRow.ok → use it
  else:
    block = inferBlockStack(input)  # rare for multi-col
    if block.ok → use
    else wrap = inferWrapStack(input, "grid")
```

Do not replace wrap for N>2 equal columns.

### 3. Outer stage-card

No special-case class names. Block stack already handles uniform vertical gaps. Non-uniform margins (e.g. path-line 14/16) → bail → absolute shell OK.

### 4. Fixtures

Browser tests (synthetic CSS, no full hebao asset load required):

- stage-head analogue: grid auto 1fr, badge 54px + text column
- shot-grid analogue: 2 equal 1fr columns, two figures
- path-line: flex wrap center chips (existing coverage; optional pin)
- figure: relative phone + caption margin-top
- phone-caption: flex row gap

### 5. Risks

- **[Risk]** Figma fill-grow on 1fr child changes on paste if sibling sizes change → Accepted; geometry at capture time is authoritative.
- **[Risk]** `auto 1fr` with align-items center and unequal heights → verify may fail → stay absolute (honest).
- **[Risk]** Three-column headers → out of scope v1.

## Migration

None. Inference-only; existing absolute exports improve when rules match.
