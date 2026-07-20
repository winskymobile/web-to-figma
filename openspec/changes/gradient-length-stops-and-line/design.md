## Context

`parseGradientStop` drops length positions → even spacing. `.page` uses four stops with two at `330px`. Diagonal gradients use `calculateGradientTransform` (rotate about unit-box center), not CSS Images covering line.

## Decisions

### A. Line length
For CSS angle θ (0° up, clockwise):
- direction vector in y-down box space: (sin θ, −cos θ)
- line length ≈ |w·sin θ| + |h·cos θ| (distance between parallel supporting lines of the box perpendicular to the gradient direction) — matches CSS “gradient line” length for rectangular boxes.

Length stop `Lpx` → position = clamp(L / lineLength, 0, 1).  
`em`/`rem` without font size: treat as px numeric fallback (parseFloat only) when box size given; if no box size, keep even-spacing fallback.

### B. Covering-line transform
Figma GRADIENT_LINEAR maps unit (0,0)→(1,0) through matrix to layer space.
Place start/end so the unit segment covers the CSS gradient line segment across the box in **normalized layer coordinates** (0–1 on both axes).

For box w×h:
1. unit direction û in y-down: (sin θ, −cos θ)
2. length L = |w sin θ| + |h cos θ|
3. center c = (w/2, h/2); start = c − û·(L/2), end = c + û·(L/2)
4. Normalize to unit box: sx=start.x/w, sy=start.y/h, ex=end.x/w, ey=end.y/h
5. Figma maps (0,0)→start and (1,0)→end with orthogonal side vector for m01/m11:
   - m00 = ex−sx, m10 = ey−sy
   - perpendicular of length similar: (−(ey−sy), ex−sx) scaled to keep reasonable aspect, or use same L projection on orthogonal unit in normalized space
   - m02 = sx, m12 = sy

Also keep axis-aligned shortcut identical within epsilon for 0/90/180/270.

### Call sites
`cssBackgroundToFigmaPaints(css, { width, height })` optional. Frame/pseudo pass measured size.

## Non-goals
Repeating period, background-size tiles, dual-position expansion (follow-up).
