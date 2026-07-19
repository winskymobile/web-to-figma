## Why

Many containers fall back to absolute layout under the strict Auto Layout gate. Authors and the station cannot see *why*, and a large class of real H5 markup (flex rows with a glyph/dot plus bare text) bails solely because direct text nodes are treated as unmodelable—even though the walker already emits those text nodes. We need observability plus first-class text flow items without relaxing the 0.6px geometry gate or making AL coverage a success metric.

## What Changes

- Add structured `layout-infer-bailed` diagnostics with stable reason codes when `layout: "auto"` does not produce a stack.
- Allow non-empty direct `Text` children to participate in stack inference as flow items (measured via Range geometry), removing the hard bail on mixed element+text flex/grid/block stacks when geometry still verifies.
- Keep the 0.6px `verifyGeometry` / uniform-gap rules; non-uniform margins, wrap+center, floats, etc. still absolute-position.
- Out of scope: prefer-edit mode, spacer-based non-uniform gaps, wrap-align expansion, baseline/order/float modeling.

## Capabilities

### New Capabilities

- `auto-layout-inference`: Rules for when DOM containers become Figma Auto Layout, bail reasons, and text flow participation.

### Modified Capabilities

- (none required for station convert wording; diagnostics surface through existing ConvertResult)

## Impact

- `packages/dom-to-figma` layout infer, diagnostics, frame converter, autolayout tests.
- Downstream apps may show more `layout-infer-bailed` warnings in conversion toast aggregates.
- No change to default `layout: "auto"` strictness beyond enabling text flow items that pass geometry checks.
