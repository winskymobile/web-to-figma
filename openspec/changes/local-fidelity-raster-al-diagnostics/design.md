## Context

Absolute decorative pseudos already export natively when unmasked. Masked stage-card grids skip. Flex check-items fail verify because child margin-top is outside CSS padding. App warnings only count diagnostics.

## Decisions

### 1. Local raster (v1)
On pseudo skip reason `masked` only (not all skips): if box resolves and area ≤ 512×512 CSS px and ≤ 25% of host area (relaxed vs harden 5% for station usefulness on card headers), draw host's ::pseudo via offscreen approach:

Practical approach without full proxy lease:
- Create temporary absolutely positioned clone layer is hard for pseudos.
- Use `Element` + foreign: draw by applying computed styles onto a canvas is incomplete for CSS gradients+mask.

Better v1 approach:
- Insert a temporary measuring proxy `div` into host with styles copied from getComputedStyle(host,'::before'), suppress original pseudo via style tag, html2canvas-like is heavy.

Simpler v1 that works for mask+gradient backgrounds:
- Create off-DOM canvas sized to pseudo box.
- Re-implement is too heavy.

**Chosen pragmatic v1:** DOM proxy materialization limited to conversion time:
1. Create `div[data-wtf-pseudo-proxy]` as first/last child of host.
2. Copy geometric + paint related computed properties from pseudo used style (background*, border*, mask*, opacity, border-radius, transform).
3. Position absolute with resolved left/top/width/height.
4. Add stylesheet `host::before, host::after { content: none !important }` scoped if possible—global during convert only on that host via attribute `data-wtf-capturing`.
5. `html-to-image` not in deps—use browser: draw via SVG foreignObject snapshot of the proxy element.

SVG foreignObject + XMLSerializer is a known pattern without new deps.

6. Restore DOM after snapshot.
7. Emit IMAGE fill frame like image converter.

If snapshot fails → keep skip diagnostic only.

### 2. Flex padding from geometry
In `inferFlexStack`, after building CSS pad, if `verifyGeometry` fails, recompute:
- padLeading = min primary coords of children
- padCross = min cross coords  
- padTrailing / padCrossTrailing from parent size − last edges
Clamp ≥ 0; re-verify. If success, use measured pads. Does not relax gap uniformity.

### 3. Generated text pseudo
If content is a quoted string (not counter/attr), emit frame with... text needs font pipeline. **v1 simplify:** treat non-empty content as skip `generated-text` still OR create a frame with name containing text only without glyphs—bad.

Better: for generated text, skip raster; add diagnostic only. **Deepen** instead: 
- `content: "\\2022"` etc.  
- Improve empty detection for `none` / normal / space variants  
- Export `content: " "` empty decorations

Actually proposal said simple generated-text as text frames—requires nodeToTextNodeChange with synthetic text node. Walk can create Text in temp element.

v1 generated text: create temporary span with text, convert via existing text path is heavy.

**Deepen scope for ship:** 
- empty content robustness  
- masked → raster  
- optional: `content` that is only punctuation and short → raster the pseudo (same as masked path) when native fails for generated-text? Too broad.

I'll implement: masked raster + flex measured pads + diagnostic UX + pseudo empty/content edge cases + try nowrap flex for single-line generated content by creating child text via document.createTextNode in a temporary element attached to host during convert only for measurement... Skip generated text conversion if too long; ship flex+raster+diagnostics as core.

### 4. Diagnostics UX
`formatConversionWarning` + new `summarizeDiagnostics(diagnostics)`:
- Group by code
- Map codes to Chinese
- Include top reasons (max 3 groups)
- Unit test without browser where possible
