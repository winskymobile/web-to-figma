## Context

`inferWrapStack` only accepts `align-items` mapped to MIN. Path lines with mixed-height chips + arrows use `align-items: center` and often still pack on one or more rows.

Stacking check compares DOM flow order to `sortNodesByStackingOrder`, which moves any `position: relative` element after static siblings even when layout order is unchanged.

## Decisions

### 1. Wrap counter align
Map center/max like nowrap flex. Simulate each row: primary greedy pack from the left; cross position = rowTop + align offset using that row's max height. Row tops advance by max(row heights) + counterSpacing.

### 2. Single-row wrap
No special case required if simulation covers center; single-row path-line verifies with counter CENTER.

### 3. Stacking gate
When comparing flow order for inference, only fail if a flow element's stacking sort key differs due to explicit z-index among positioned/non-positioned rules that reorder relative to siblings. Practical rule: run stacking sort only on elements that are positioned **and** have non-auto z-index, or compare layout order as DOM order for static + relative/sticky with z-auto (treat as DOM order).

Chosen rule: for layout inference, flow order is **DOM order**. Bail with `stacking-order-mismatch` only if two flow elements have explicit z-index values that would reorder them relative to each other (positioned with numeric z-index). Relative/sticky/absolute-in-flow with z-auto ignored for reorder.

Absolute children remain excluded from flow already.

## Risks

- Figma paste reflow for wrap+center may differ slightly on multi-line; simulation gate keeps only exact matches.
