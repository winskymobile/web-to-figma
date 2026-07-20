## Why

Linear gradients on real H5 pages (e.g. 和包 `.page` blue band at `330px`, finish-panel mid stop at `58%` on `135deg`) export with wrong mid-band / hard-cut positions. Length-based color stops currently fall back to even spacing, and the Figma gradient transform uses a centered unit rotation that does not match CSS covering-line geometry on diagonals.

## What Changes

- Resolve `px`/`em`/`rem` stop offsets using the CSS gradient line length derived from the painted box size and angle (A).
- Compute GRADIENT_LINEAR transforms with covering-line endpoints for the box (B), so percent stops align with browser sampling along the gradient axis.
- Pass box width/height from frame and pseudo converters into `cssBackgroundToFigmaPaints`.
- Unit tests for 330px dual stops and 135deg transform/stop positions.

## Capabilities

### New Capabilities

- `css-gradient-fidelity`: Length stops + covering-line transform for linear gradients.

## Impact

- `packages/dom-to-figma` gradient parser, frame/pseudo/text call sites, gradient tests.
