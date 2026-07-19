## Context

Frame conversion already maps host `background-color` / gradient `background-image`, borders, shadows, and CSS transforms. Pseudos never enter the walker. Hero decorations use empty absolute pseudos with multi-layer gradients, borders, and rotation.

## Goals / Non-Goals

**Goals:**
- Absolute decorative pseudos (empty or whitespace `content`) become child frames under the host.
- Geometry from used computed style (px tops/widths, inset, right/bottom) relative to host border box.
- Gradient/solid fills via existing `cssBackgroundToFigmaPaints`; borders via existing border parser; opacity; simple 2D transform when present.
- Diagnostics for skip reasons.

**Non-Goals:**
- Full pseudo proxy DOM mutation lease (harden follow-up).
- Local canvas raster bake (follow-up if needed for mask/repeating fidelity).
- Generated text pseudos (`content: "foo"`) as text nodes (later).
- Changing Auto Layout rules.

## Decisions

### 1. Emission site
Inside `walkNode` after host frame is emitted: convert `::before`, walk real children, convert `::after`. Offset child indices accordingly.

### 2. Eligibility (v1)
Include when:
- `content` is not `none` (empty string `""` counts as active for decorative boxes),
- `display` is not `none`,
- `position` is `absolute` or `fixed`,
- has paintable ink (non-transparent background, background-image not none, border width, or box-shadow),
- resolved width/height ≥ 0.5px.

Skip (diagnostic) when:
- `mask-image` / `-webkit-mask-image` active (non-none),
- `content` is non-empty text (not pure decorative empty),
- geometry cannot be resolved,
- not absolute/fixed (static pseudos deferred).

### 3. Geometry
Resolve used lengths from `getComputedStyle(el, '::before'|'::after')`. Prefer pixel used values. For inset-style, derive x/y/w/h from top/right/bottom/left + parent size. Parent size from host `getBoundingClientRect()`.

### 4. Stacking
Emit before before children so default Figma sibling order puts decoration under content when host creates a stacking context. Negative z-index pseudos still emit first.

### 5. Naming
`name`: `${hostName}::before` / `::after` for layer panel clarity.

## Risks

- Used style units may be `auto` on some engines for sticky cases → skip safely.
- Multi-layer repeating gradients approximate in Figma (existing parser); visual not always pixel-identical.
- Without raster, mask-faded grids remain missing until follow-up.
