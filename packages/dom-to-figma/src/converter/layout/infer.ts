/**
 * Auto-layout properties inferred from a flex container, phrased directly in
 * kiwi NodeChange fields. Returned only when the reconstructed geometry
 * matches what the browser actually laid out (see `verifyGeometry`), so
 * applying these to a frame never moves pixels — callers fall back to
 * absolute positioning (`stackMode: "NONE"`) on `null`.
 */
type InferredStack = {
  stackMode: "HORIZONTAL" | "VERTICAL";
  stackSpacing: number;
  stackPrimaryAlignItems: StackJustifyValue;
  stackCounterAlignItems: StackAlignValue;
  /** Sizing modes must always be explicit: pasting a stack without them makes
   * Figma hug-to-content on the primary axis, shrinking the frame
   * (established by oracle batch-01). RESIZE_TO_FIT (hug) is emitted only
   * when the CSS declares a content-driven size AND the measured frame size
   * equals the content size, so the paste-time hug is a no-op. */
  stackPrimarySizing: StackSizingValue;
  stackCounterSizing: StackSizingValue;
  /** Left padding. Includes the border width: Figma lays out from the frame
   * edge while CSS offsets children by border + padding. */
  stackHorizontalPadding: number;
  /** Top padding, border included. */
  stackVerticalPadding: number;
  stackPaddingRight: number;
  stackPaddingBottom: number;
  /** Multi-line rows (flex-wrap / uniform grids). */
  stackWrap?: "WRAP";
  /** Gap between wrapped rows. */
  stackCounterSpacing?: number;
  /** Set for reversed flex directions: children are emitted in visual order,
   * so Figma's z-order must flip to preserve the browser's paint order. */
  stackReverseZIndex?: boolean;
};

/** Auto-layout child overrides, keyed by child element by `inferAutoLayout`. */
export type InferredChildStack = {
  /** flex-grow child whose size matches Figma's fill-container distribution. */
  stackChildPrimaryGrow?: 1;
  /** Child stretched across the counter axis with no explicit cross size. */
  stackChildAlignSelf?: "STRETCH";
  /** Absolutely positioned child inside a stack: excluded from layout, kept
   * at its transform with its constraints — mirroring CSS semantics. */
  stackPositioning?: "ABSOLUTE";
};

export type InferredAutoLayout = {
  stack: InferredStack;
  /** Per-child overrides; children not in the map get fixed sizing. */
  children: ReadonlyMap<Element, InferredChildStack>;
  /** Reversed flex direction: the walker must emit children in reverse
   * (visual) order, paired with `stackReverseZIndex` on the stack. */
  reverseChildren?: boolean;
};

/** Stable machine-readable reasons when Auto Layout inference declines a container. */
export type LayoutInferBailReason =
  | "display-not-supported"
  | "direct-text-node" // retained for compatibility; text is now flow-eligible
  | "no-flow-children"
  | "stacking-order-mismatch"
  | "zero-size"
  | "order-nonzero"
  | "non-uniform-gap"
  | "unmapped-align"
  | "verify-geometry-failed"
  | "wrap-variant-unsupported"
  | "wrap-justify-not-min"
  | "wrap-align-not-min"
  | "wrap-with-grow"
  | "wrap-nonuniform-gap"
  | "wrap-sim-mismatch"
  | "block-inline-child"
  | "float-child"
  | "content-overflow"
  | "reverse-with-absolute"
  | "unhandled";

export type TryInferAutoLayoutResult =
  | { ok: true; value: InferredAutoLayout }
  | { ok: false; reason: LayoutInferBailReason };

type FlowItem = Element | Text;

type StackJustifyValue = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
type StackAlignValue = "MIN" | "CENTER" | "MAX";
type StackSizingValue = "FIXED" | "RESIZE_TO_FIT";

/** Max deviation (px) between reconstructed and measured child positions. */
const GEOMETRY_TOLERANCE = 0.6;
/** Max spread (max−min) among inter-child gaps still treated as one stack gap. */
const GAP_SPREAD_TOLERANCE = GEOMETRY_TOLERANCE;

const JUSTIFY_MAP: Record<string, StackJustifyValue> = {
  normal: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  left: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  right: "MAX",
  "space-between": "SPACE_BETWEEN",
  // The kiwi enum has SPACE_EVENLY but Figma's engine renders it as
  // space-between (oracle batch-01). With spacing measured from real rects,
  // CENTER reproduces both space-evenly (leading gap = g) and space-around
  // (leading gap = g/2) exactly; verifyGeometry guards the equivalence.
  "space-evenly": "CENTER",
  "space-around": "CENTER",
};

const ALIGN_MAP: Record<string, StackAlignValue> = {
  // `stretch`/`normal` only differ from `start` when a child has no explicit
  // cross size; geometry verification rejects the container in that case.
  normal: "MIN",
  stretch: "MIN",
  "flex-start": "MIN",
  start: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  // baseline needs font-metric math we don't model yet -> bail.
};

type Rect = { x: number; y: number; width: number; height: number };

/** Block-level outer displays that can participate in vertical block flow. */
const BLOCK_LEVEL_DISPLAYS = new Set([
  "block",
  "flex",
  "grid",
  "flow-root",
  "table",
  "list-item",
]);

/**
 * Infer Figma auto-layout properties for an element, or return `null` when
 * the container's layout can't be reproduced exactly (then it stays
 * absolutely positioned, which is always safe).
 *
 * Covers flex containers (HORIZONTAL/VERTICAL by direction) and plain block
 * flow (VERTICAL when spacing is uniform). Direct non-empty Text nodes may
 * participate as flex/grid flow items (Range-measured). Absolutely positioned
 * children ride along with `stackPositioning: "ABSOLUTE"` instead of blocking
 * the container. Out of scope (bails): wrapping patterns that cannot be
 * reconstructed, non-uniform gaps, order/z-index reordering, baseline
 * alignment, floats, and bare text inside pure block stacks.
 */
export function inferAutoLayout(element: Element): InferredAutoLayout | null {
  const result = tryInferAutoLayout(element);
  return result.ok ? result.value : null;
}

/**
 * Like `inferAutoLayout`, but returns a stable bail reason for diagnostics.
 */
export function tryInferAutoLayout(element: Element): TryInferAutoLayoutResult {
  const style = window.getComputedStyle(element);
  const display = style.display;
  const isFlex = display === "flex" || display === "inline-flex";
  const isBlock = display === "block" || display === "flow-root";
  const isGrid = display === "grid" || display === "inline-grid";
  if (!(isFlex || isBlock || isGrid)) {
    return { ok: false, reason: "display-not-supported" };
  }

  const collected = collectChildren(element);
  if (!collected.ok) {
    return collected;
  }
  const { flow, absolute } = collected;
  if (flow.length === 0) {
    return { ok: false, reason: "no-flow-children" };
  }

  // Stack layout follows DOM order. Bail only when numeric z-index would
  // reorder flow children relative to each other. `position: relative` with
  // z-index:auto must not block inference (walker may still paint via stack
  // order, but geometry order stays DOM order).
  if (flowHasNumericZIndexReorder(flow)) {
    return { ok: false, reason: "stacking-order-mismatch" };
  }

  const parentRect = element.getBoundingClientRect();
  // Skip zero-size shells
  if (parentRect.width < 0.5 || parentRect.height < 0.5) {
    return { ok: false, reason: "zero-size" };
  }

  const childRects: Array<Rect> = flow.map((child) =>
    getFlowItemRect(child, parentRect)
  );
  const parentSize = { width: parentRect.width, height: parentRect.height };

  const input: StackInferenceInput = {
    element,
    style,
    flow,
    childRects,
    parentSize,
  };

  let inferred: StackInference | null = null;
  let pathReason: LayoutInferBailReason = "unhandled";
  if (isFlex) {
    if (style.flexWrap === "nowrap") {
      const r = inferFlexStack(input);
      if (r.ok) {
        inferred = r.value;
      } else {
        pathReason = r.reason;
      }
    } else {
      const r = inferWrapStack(input, "flex");
      if (r.ok) {
        inferred = r.value;
      } else {
        pathReason = r.reason;
      }
    }
  } else if (isBlock) {
    const r = inferBlockStack(input);
    if (r.ok) {
      inferred = r.value;
    } else {
      pathReason = r.reason;
    }
  } else {
    const block = inferBlockStack(input);
    if (block.ok) {
      inferred = block.value;
    } else {
      const wrap = inferWrapStack(input, "grid");
      if (wrap.ok) {
        inferred = wrap.value;
      } else {
        pathReason = wrap.reason !== "unhandled" ? wrap.reason : block.reason;
      }
    }
  }
  if (!inferred) {
    return { ok: false, reason: pathReason };
  }

  // Reversal reorders emission; mixing that with absolute children (which
  // keep their stacking positions) isn't modeled yet.
  if (inferred.reverseChildren && absolute.length > 0) {
    return { ok: false, reason: "reverse-with-absolute" };
  }

  for (const child of absolute) {
    inferred.childOverrides.set(child, { stackPositioning: "ABSOLUTE" });
  }

  return {
    ok: true,
    value: {
      stack: inferred.stack,
      children: inferred.childOverrides,
      reverseChildren: inferred.reverseChildren,
    },
  };
}

function isElementFlowItem(item: FlowItem): item is Element {
  return item.nodeType === Node.ELEMENT_NODE;
}

function getFlowItemRect(item: FlowItem, parentRect: DOMRect): Rect {
  if (item.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.selectNodeContents(item);
    const rect = range.getBoundingClientRect();
    return {
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height,
    };
  }
  const el = item as Element;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - parentRect.left,
    y: rect.top - parentRect.top,
    width: rect.width,
    height: rect.height,
  };
}

type StackInferenceInput = {
  element: Element;
  style: CSSStyleDeclaration;
  flow: ReadonlyArray<FlowItem>;
  childRects: ReadonlyArray<Rect>;
  parentSize: { width: number; height: number };
};

type StackInference = {
  stack: InferredStack;
  childOverrides: Map<Element, InferredChildStack>;
  reverseChildren?: boolean;
};

function inferFlexStack(
  input: StackInferenceInput
):
  | { ok: true; value: StackInference }
  | { ok: false; reason: LayoutInferBailReason } {
  const { element, style, parentSize } = input;

  const direction = style.flexDirection;
  const isRow = direction === "row" || direction === "row-reverse";
  const reversed = direction.endsWith("-reverse");

  // Reversed directions: work in visual order (reversed DOM order) — the
  // walker will emit children the same way.
  const flow = reversed ? [...input.flow].reverse() : input.flow;
  const childRects = reversed
    ? [...input.childRects].reverse()
    : input.childRects;

  let justify = JUSTIFY_MAP[style.justifyContent];
  const align = ALIGN_MAP[style.alignItems];
  if (!(justify && align)) {
    return { ok: false, reason: "unmapped-align" };
  }
  // In reversed flow the main-axis start/end swap in visual terms.
  if (reversed && justify === "MIN") {
    justify = "MAX";
  } else if (reversed && justify === "MAX") {
    justify = "MIN";
  }

  const spacing = uniformGap(childRects, isRow);
  if (spacing === null) {
    return { ok: false, reason: "non-uniform-gap" };
  }

  const spec: InferredStack = {
    stackMode: isRow ? "HORIZONTAL" : "VERTICAL",
    stackSpacing: spacing,
    stackPrimaryAlignItems: justify,
    stackCounterAlignItems: align,
    stackPrimarySizing: "FIXED",
    stackCounterSizing: "FIXED",
    stackHorizontalPadding: round2(
      edge(style.borderLeftWidth) + edge(style.paddingLeft)
    ),
    stackVerticalPadding: round2(
      edge(style.borderTopWidth) + edge(style.paddingTop)
    ),
    stackPaddingRight: round2(
      edge(style.borderRightWidth) + edge(style.paddingRight)
    ),
    stackPaddingBottom: round2(
      edge(style.borderBottomWidth) + edge(style.paddingBottom)
    ),
    ...(reversed && { stackReverseZIndex: true }),
  };

  if (!verifyGeometry(spec, parentSize, childRects)) {
    return { ok: false, reason: "verify-geometry-failed" };
  }

  const elementFlow = flow.filter(isElementFlowItem);

  applySizingModes({
    element,
    style,
    spec,
    parent: parentSize,
    children: elementFlow,
    childRects: elementFlow.map((child) => {
      const i = flow.indexOf(child);
      return childRects[i] as Rect;
    }),
    isRow,
  });

  return {
    ok: true,
    value: {
      stack: spec,
      childOverrides: inferChildOverrides({
        element,
        children: elementFlow,
        childRects: elementFlow.map((child) => {
          const i = flow.indexOf(child);
          return childRects[i] as Rect;
        }),
        parentStyle: style,
        spec,
        parentSize,
        isRow,
      }),
      reverseChildren: reversed || undefined,
    },
  };
}

/**
 * Multi-line rows as a wrapped HORIZONTAL stack (`flex-wrap: wrap`, and
 * uniform CSS grids, which lay out identically when every child fits the
 * same greedy packing). Figma re-flows wrapped stacks with its own greedy
 * row-breaking on paste, so conversion requires that a simulation of that
 * packing reproduces the browser's exact row assignments and positions —
 * otherwise the container falls back to absolute positioning.
 */
function inferWrapStack(
  input: StackInferenceInput,
  source: "flex" | "grid"
):
  | { ok: true; value: StackInference }
  | { ok: false; reason: LayoutInferBailReason } {
  const { element, style, flow, childRects, parentSize } = input;

  let wrapCounterAlign: StackAlignValue = "MIN";
  if (source === "flex") {
    if (style.flexDirection !== "row" || style.flexWrap !== "wrap") {
      return { ok: false, reason: "wrap-variant-unsupported" };
    }
    // Row-internal distribution other than left-packed changes Figma's
    // re-flow in ways the simulation below doesn't model.
    if (JUSTIFY_MAP[style.justifyContent] !== "MIN") {
      return { ok: false, reason: "wrap-justify-not-min" };
    }
    const mappedAlign = ALIGN_MAP[style.alignItems];
    if (!mappedAlign) {
      // baseline / unmapped — still unsupported for wrap.
      return { ok: false, reason: "wrap-align-not-min" };
    }
    wrapCounterAlign = mappedAlign;
  }
  for (const child of flow) {
    if (!isElementFlowItem(child)) {
      continue;
    }
    if (Number.parseFloat(window.getComputedStyle(child).flexGrow) > 0) {
      return { ok: false, reason: "wrap-with-grow" };
    }
  }

  const padLeft = edge(style.borderLeftWidth) + edge(style.paddingLeft);
  const padTop = edge(style.borderTopWidth) + edge(style.paddingTop);
  const padRight = edge(style.borderRightWidth) + edge(style.paddingRight);
  const padBottom = edge(style.borderBottomWidth) + edge(style.paddingBottom);

  // Group measured rects into rows. With center/max cross-align, tops differ
  // within a row; cluster by vertical overlap / proximity of midlines.
  const rows = groupWrapRows(childRects);

  const inRowGaps: Array<number> = [];
  for (const row of rows) {
    for (let k = 1; k < row.length; k += 1) {
      const prev = childRects[row[k - 1] as number] as Rect;
      const cur = childRects[row[k] as number] as Rect;
      inRowGaps.push(cur.x - (prev.x + prev.width));
    }
  }
  const spacing = (() => {
    if (inRowGaps.length === 0) {
      return 0;
    }
    const minG = Math.min(...inRowGaps);
    const maxG = Math.max(...inRowGaps);
    if (maxG - minG > GAP_SPREAD_TOLERANCE) {
      return null;
    }
    return round2(inRowGaps.reduce((s, g) => s + g, 0) / inRowGaps.length);
  })();
  if (spacing === null) {
    return { ok: false, reason: "wrap-nonuniform-gap" };
  }

  const rowHeights = rows.map((r) =>
    Math.max(...r.map((i) => (childRects[i] as Rect).height))
  );
  const rowTops = rows.map((r, rowIndex) => {
    const h = rowHeights[rowIndex] as number;
    // Invert counter-align to recover the row box top from measured child tops.
    const tops = r.map((i) => {
      const rect = childRects[i] as Rect;
      if (wrapCounterAlign === "CENTER") {
        return rect.y - (h - rect.height) / 2;
      }
      if (wrapCounterAlign === "MAX") {
        return rect.y - (h - rect.height);
      }
      return rect.y;
    });
    return Math.min(...tops);
  });
  const rowGaps: Array<number> = [];
  for (let r = 1; r < rows.length; r += 1) {
    rowGaps.push(
      (rowTops[r] as number) -
        ((rowTops[r - 1] as number) + (rowHeights[r - 1] as number))
    );
  }
  const counterSpacing = (() => {
    if (rowGaps.length === 0) {
      return 0;
    }
    const minG = Math.min(...rowGaps);
    const maxG = Math.max(...rowGaps);
    if (maxG - minG > GAP_SPREAD_TOLERANCE) {
      return null;
    }
    return round2(rowGaps.reduce((s, g) => s + g, 0) / rowGaps.length);
  })();
  if (counterSpacing === null || counterSpacing < -GEOMETRY_TOLERANCE) {
    return { ok: false, reason: "wrap-nonuniform-gap" };
  }

  // Free space above the first row / below the last becomes vertical padding
  // (needed when a fixed-height line box is taller than the tallest child and
  // align-items center/max offsets the whole row).
  const measuredPadTop = rowTops[0] as number;
  const lastIdx = rows.length - 1;
  const measuredPadBottom =
    parentSize.height -
    ((rowTops[lastIdx] as number) + (rowHeights[lastIdx] as number));
  if (
    measuredPadTop < -GEOMETRY_TOLERANCE ||
    measuredPadBottom < -GEOMETRY_TOLERANCE
  ) {
    return { ok: false, reason: "content-overflow" };
  }
  // CSS padding is a lower bound; measured free space may be larger.
  if (measuredPadTop + GEOMETRY_TOLERANCE < padTop) {
    return { ok: false, reason: "wrap-sim-mismatch" };
  }
  if (measuredPadBottom + GEOMETRY_TOLERANCE < padBottom) {
    return { ok: false, reason: "wrap-sim-mismatch" };
  }
  const stackPadTop = round2(Math.max(measuredPadTop, 0));
  const stackPadBottom = round2(Math.max(measuredPadBottom, 0));

  // Simulate Figma's greedy packing with counter-axis MIN/CENTER/MAX.
  // Row height is the max child height in the row; cross offset is applied
  // inside that row box. Start at measured first-row top.
  const rightLimit = parentSize.width - padRight;
  let x = padLeft;
  let y = stackPadTop;
  let simRowHeight = 0;
  let rowStart = true;
  let rowItems: Array<Rect> = [];
  const flushRowCheck = (items: Array<Rect>, rowTop: number, rowH: number) => {
    let cx = padLeft;
    for (const rect of items) {
      let expectedY = rowTop;
      if (wrapCounterAlign === "CENTER") {
        expectedY = rowTop + (rowH - rect.height) / 2;
      } else if (wrapCounterAlign === "MAX") {
        expectedY = rowTop + (rowH - rect.height);
      }
      if (
        Math.abs(rect.x - cx) > GEOMETRY_TOLERANCE ||
        Math.abs(rect.y - expectedY) > GEOMETRY_TOLERANCE
      ) {
        return false;
      }
      cx += rect.width + spacing;
    }
    return true;
  };
  for (const rect of childRects) {
    if (!rowStart && x + rect.width - rightLimit > GEOMETRY_TOLERANCE) {
      if (!flushRowCheck(rowItems, y, simRowHeight)) {
        return { ok: false, reason: "wrap-sim-mismatch" };
      }
      y += simRowHeight + counterSpacing;
      x = padLeft;
      simRowHeight = 0;
      rowItems = [];
    }
    rowItems.push(rect);
    x += rect.width + spacing;
    simRowHeight = Math.max(simRowHeight, rect.height);
    rowStart = false;
  }
  if (rowItems.length > 0 && !flushRowCheck(rowItems, y, simRowHeight)) {
    return { ok: false, reason: "wrap-sim-mismatch" };
  }

  const spec: InferredStack = {
    stackMode: "HORIZONTAL",
    stackSpacing: spacing,
    stackPrimaryAlignItems: "MIN",
    stackCounterAlignItems: wrapCounterAlign,
    stackPrimarySizing: "FIXED",
    stackCounterSizing: "FIXED",
    stackHorizontalPadding: round2(padLeft),
    stackVerticalPadding: stackPadTop,
    stackPaddingRight: round2(padRight),
    stackPaddingBottom: stackPadBottom,
    stackWrap: "WRAP",
    stackCounterSpacing: counterSpacing,
  };

  // Counter-axis hug: rows content height equals the frame height.
  const contentHeight =
    stackPadTop +
    stackPadBottom +
    rowHeights.reduce((n, h) => n + h, 0) +
    counterSpacing * (rows.length - 1);
  if (
    isContentDrivenSize(element, style, "height") &&
    Math.abs(parentSize.height - contentHeight) <= GEOMETRY_TOLERANCE
  ) {
    spec.stackCounterSizing = "RESIZE_TO_FIT";
  }

  return { ok: true, value: { stack: spec, childOverrides: new Map() } };
}

/**
 * Plain block flow as a VERTICAL stack: block-level children stacked top to
 * bottom with uniform (margin-driven) spacing.
 *
 * Vertical paddings are measured (the first/last child margins fold into
 * them, and margin collapse is already baked into the rects); horizontal
 * paddings come from CSS. The counter alignment is whichever of MIN /
 * CENTER / MAX reproduces the measured geometry — CENTER covers
 * `margin: 0 auto` centering.
 */
function inferBlockStack(
  input: StackInferenceInput
):
  | { ok: true; value: StackInference }
  | { ok: false; reason: LayoutInferBailReason } {
  const { element, style, flow, childRects, parentSize } = input;

  for (const child of flow) {
    if (!isElementFlowItem(child)) {
      return { ok: false, reason: "block-inline-child" };
    }
    const childStyle = window.getComputedStyle(child);
    if (!BLOCK_LEVEL_DISPLAYS.has(childStyle.display)) {
      return { ok: false, reason: "block-inline-child" };
    }
    if (childStyle.float !== "none") {
      return { ok: false, reason: "float-child" };
    }
  }

  const spacing = uniformGap(childRects, false);
  if (spacing === null) {
    return { ok: false, reason: "non-uniform-gap" };
  }

  const first = childRects[0] as Rect;
  const last = childRects.at(-1) as Rect;
  const padTop = first.y;
  const padBottom = parentSize.height - (last.y + last.height);
  if (padTop < -GEOMETRY_TOLERANCE || padBottom < -GEOMETRY_TOLERANCE) {
    return { ok: false, reason: "content-overflow" };
  }

  const padLeft = edge(style.borderLeftWidth) + edge(style.paddingLeft);
  const padRight = edge(style.borderRightWidth) + edge(style.paddingRight);

  for (const align of ["MIN", "CENTER", "MAX"] as const) {
    const spec: InferredStack = {
      stackMode: "VERTICAL",
      stackSpacing: spacing,
      stackPrimaryAlignItems: "MIN",
      stackCounterAlignItems: align,
      stackPrimarySizing: "FIXED",
      stackCounterSizing: "FIXED",
      stackHorizontalPadding: round2(padLeft),
      stackVerticalPadding: round2(Math.max(padTop, 0)),
      stackPaddingRight: round2(padRight),
      stackPaddingBottom: round2(Math.max(padBottom, 0)),
    };
    if (!verifyGeometry(spec, parentSize, childRects)) {
      continue;
    }

    const elementFlow = flow.filter(isElementFlowItem);
    applySizingModes({
      element,
      style,
      spec,
      parent: parentSize,
      children: elementFlow,
      childRects: elementFlow.map((child) => {
        const i = flow.indexOf(child);
        return childRects[i] as Rect;
      }),
      isRow: false,
    });

    // Block children with `width: auto` fill the content box — exactly
    // Figma's STRETCH on the counter axis of a vertical stack.
    const childOverrides = new Map<Element, InferredChildStack>();
    const innerWidth = parentSize.width - padLeft - padRight;
    flow.forEach((child, i) => {
      if (!isElementFlowItem(child)) {
        return;
      }
      if (
        hasContentSizedKeyword(child, "width") &&
        Math.abs((childRects[i] as Rect).width - innerWidth) <=
          GEOMETRY_TOLERANCE
      ) {
        childOverrides.set(child, { stackChildAlignSelf: "STRETCH" });
      }
    });

    return { ok: true, value: { stack: spec, childOverrides } };
  }

  return { ok: false, reason: "verify-geometry-failed" };
}

/** Uniform inter-child gap along the given axis, or null when non-uniform.
 * Measured from rects, so CSS gaps and margins (incl. collapse) are covered;
 * negative values are fine — Figma supports them. */
function uniformGap(
  childRects: ReadonlyArray<Rect>,
  isRow: boolean
): number | null {
  const gaps: Array<number> = [];
  for (let i = 1; i < childRects.length; i += 1) {
    const prev = childRects[i - 1] as Rect;
    const next = childRects[i] as Rect;
    gaps.push(
      isRow ? next.x - (prev.x + prev.width) : next.y - (prev.y + prev.height)
    );
  }
  if (gaps.length === 0) {
    return 0;
  }
  // Prefer average spacing when gaps are nearly equal (subpixel / margin
  // collapse noise). Large spreads stay absolute so structure is preserved.
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  if (max - min > GAP_SPREAD_TOLERANCE) {
    return null;
  }
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return round2(mean);
}

/**
 * Upgrade FIXED to RESIZE_TO_FIT (hug) per axis when the CSS declares a
 * content-driven size AND the measured frame size equals the content size —
 * so Figma's paste-time hug is provably a no-op.
 *
 * Primary hug is never emitted for SPACE_BETWEEN containers or when a child
 * grows: in both cases the measured spacing/child sizes embed the free
 * space, making "content == frame" hold vacuously.
 */
function applySizingModes(options: {
  element: Element;
  style: CSSStyleDeclaration;
  spec: InferredStack;
  parent: { width: number; height: number };
  children: ReadonlyArray<Element>;
  childRects: ReadonlyArray<Rect>;
  isRow: boolean;
}) {
  const { element, style, spec, parent, children, childRects, isRow } = options;
  const spacing = spec.stackSpacing;
  const count = childRects.length;
  const primaryContent =
    childRects.reduce((n, r) => n + (isRow ? r.width : r.height), 0) +
    spacing * (count - 1) +
    (isRow
      ? spec.stackHorizontalPadding + spec.stackPaddingRight
      : spec.stackVerticalPadding + spec.stackPaddingBottom);
  const crossContent =
    Math.max(...childRects.map((r) => (isRow ? r.height : r.width))) +
    (isRow
      ? spec.stackVerticalPadding + spec.stackPaddingBottom
      : spec.stackHorizontalPadding + spec.stackPaddingRight);

  const primaryDriven = isContentDrivenSize(
    element,
    style,
    isRow ? "width" : "height"
  );
  const crossDriven = isContentDrivenSize(
    element,
    style,
    isRow ? "height" : "width"
  );
  const primarySize = isRow ? parent.width : parent.height;
  const crossSize = isRow ? parent.height : parent.width;

  const hasGrower = children.some(
    (child) => Number.parseFloat(window.getComputedStyle(child).flexGrow) > 0
  );
  const distributesFreeSpace =
    spec.stackPrimaryAlignItems === "SPACE_BETWEEN" || hasGrower;

  if (
    primaryDriven &&
    !distributesFreeSpace &&
    Math.abs(primarySize - primaryContent) <= GEOMETRY_TOLERANCE
  ) {
    spec.stackPrimarySizing = "RESIZE_TO_FIT";
  }
  if (crossDriven && Math.abs(crossSize - crossContent) <= GEOMETRY_TOLERANCE) {
    spec.stackCounterSizing = "RESIZE_TO_FIT";
  }
}

/**
 * Per-child fill/stretch overrides.
 *
 * Grow: flex-grow children map to Figma's fill-container only when their
 * measured sizes match Figma's model (fill children split the leftover space
 * equally, with no flex-basis notion). Otherwise they stay fixed at their
 * final size — geometry is identical either way; only resize behavior
 * differs.
 *
 * Stretch: children whose resolved align-self is stretch, with no explicit
 * cross size, and whose measured cross size fills the container.
 */
function inferChildOverrides(options: {
  element: Element;
  children: ReadonlyArray<Element>;
  childRects: ReadonlyArray<Rect>;
  parentStyle: CSSStyleDeclaration;
  spec: InferredStack;
  parentSize: { width: number; height: number };
  isRow: boolean;
}): Map<Element, InferredChildStack> {
  const { children, childRects, parentStyle, spec, parentSize, isRow } =
    options;
  const overrides = new Map<Element, InferredChildStack>();

  const inner =
    (isRow ? parentSize.width : parentSize.height) -
    (isRow
      ? spec.stackHorizontalPadding + spec.stackPaddingRight
      : spec.stackVerticalPadding + spec.stackPaddingBottom);
  const innerCross =
    (isRow ? parentSize.height : parentSize.width) -
    (isRow
      ? spec.stackVerticalPadding + spec.stackPaddingBottom
      : spec.stackHorizontalPadding + spec.stackPaddingRight);

  const primaryOf = (rect: Rect) => (isRow ? rect.width : rect.height);
  const crossOf = (rect: Rect) => (isRow ? rect.height : rect.width);

  const styles = children.map((child) => window.getComputedStyle(child));
  const growers = children.filter(
    (_, i) => Number.parseFloat((styles[i] as CSSStyleDeclaration).flexGrow) > 0
  );

  if (growers.length > 0) {
    const fixedTotal = children.reduce(
      (n, child, i) =>
        growers.includes(child) ? n : n + primaryOf(childRects[i] as Rect),
      0
    );
    const fillShare =
      (inner - fixedTotal - spec.stackSpacing * (children.length - 1)) /
      growers.length;
    const matchesFigmaFill = children.every(
      (child, i) =>
        !growers.includes(child) ||
        Math.abs(primaryOf(childRects[i] as Rect) - fillShare) <=
          GEOMETRY_TOLERANCE
    );
    if (matchesFigmaFill) {
      for (const child of growers) {
        overrides.set(child, { stackChildPrimaryGrow: 1 });
      }
    }
  }

  children.forEach((child, i) => {
    const childStyle = styles[i] as CSSStyleDeclaration;
    const alignSelf =
      childStyle.alignSelf === "auto" || childStyle.alignSelf === "normal"
        ? parentStyle.alignItems
        : childStyle.alignSelf;
    const stretches = alignSelf === "stretch" || alignSelf === "normal";
    const crossProp = isRow ? "height" : "width";
    if (
      stretches &&
      hasContentSizedKeyword(child, crossProp) &&
      Math.abs(crossOf(childRects[i] as Rect) - innerCross) <=
        GEOMETRY_TOLERANCE
    ) {
      overrides.set(child, {
        ...overrides.get(child),
        stackChildAlignSelf: "STRETCH",
      });
    }
  });

  return overrides;
}

const CONTENT_SIZED_KEYWORDS = new Set([
  "auto",
  "min-content",
  "max-content",
  "fit-content",
]);

/**
 * Whether the CSS declares this axis as content-sized (`auto`,
 * `fit-content`, ...) rather than a length/percentage. Uses the Typed OM
 * (`computedStyleMap`), which preserves keywords that `getComputedStyle`
 * resolves to used pixel values; browsers without it get `false`, degrading
 * to FIXED sizing everywhere.
 */
function hasContentSizedKeyword(
  element: Element,
  property: "width" | "height"
): boolean {
  if (typeof element.computedStyleMap !== "function") {
    return false;
  }
  const value = element.computedStyleMap().get(property);
  // The keyword class must come from the element's own realm: for elements
  // inside iframes, an instanceof against this window's CSSKeywordValue is
  // always false.
  const KeywordValue = element.ownerDocument?.defaultView?.CSSKeywordValue;
  return (
    KeywordValue !== undefined &&
    value instanceof KeywordValue &&
    CONTENT_SIZED_KEYWORDS.has(value.value)
  );
}

/**
 * Whether `auto` on this axis actually means shrink-to-content:
 * - `width: auto` on a block fills the parent; on a flex item it is
 *   content-sized along the parent's main axis but STRETCH on the cross axis
 *   (unless align-self opts out). Shrink-wrap contexts (inline-flex, floats,
 *   absolute positioning) are content-sized.
 * - `height: auto` is content-driven in normal flow; inside a flex row it is
 *   the cross axis and stretches by default, like width in a column.
 */
function isContentDrivenSize(
  element: Element,
  style: CSSStyleDeclaration,
  property: "width" | "height"
): boolean {
  if (!hasContentSizedKeyword(element, property)) {
    return false;
  }

  const parent = element.parentElement;
  const parentStyle = parent ? window.getComputedStyle(parent) : null;
  const parentIsFlex = parentStyle?.display.includes("flex") ?? false;

  if (parentIsFlex && parentStyle) {
    const parentIsRow = parentStyle.flexDirection.startsWith("row");
    const isMainAxis = (property === "width") === parentIsRow;
    if (isMainAxis) {
      return true;
    }
    // Cross axis: `auto` means stretch unless align-self opts out.
    const alignSelf = style.alignSelf;
    const resolved =
      alignSelf === "auto" || alignSelf === "normal"
        ? parentStyle.alignItems
        : alignSelf;
    return resolved !== "stretch" && resolved !== "normal";
  }

  if (property === "height") {
    return true; // Content-driven in normal flow.
  }
  return (
    style.display === "inline-flex" ||
    style.position === "absolute" ||
    style.position === "fixed" ||
    style.float !== "none"
  );
}

/**
 * Split children into layout participants (`flow`: elements + non-empty text)
 * and absolutely positioned elements. Text nodes participate so flex/grid
 * captions like `· label` can still become stacks when geometry verifies.
 */

/**
 * True when numeric z-index among flow elements would change paint/layout
 * order relative to DOM order. Relative/sticky with z-auto is ignored.
 */
function flowHasNumericZIndexReorder(flow: ReadonlyArray<FlowItem>): boolean {
  type Keyed = { index: number; z: number; positioned: boolean };
  const keyed: Array<Keyed> = [];
  flow.forEach((item, index) => {
    if (!isElementFlowItem(item)) {
      keyed.push({ index, z: 0, positioned: false });
      return;
    }
    const style = window.getComputedStyle(item);
    const position = style.position;
    const isPositioned =
      position === "absolute" ||
      position === "relative" ||
      position === "fixed" ||
      position === "sticky";
    const zRaw = style.zIndex;
    const hasNumericZ = zRaw !== "auto" && zRaw !== "";
    const z = hasNumericZ ? Number.parseInt(zRaw, 10) || 0 : 0;
    // Only numeric z-index on positioned elements participates in reorder.
    keyed.push({
      index,
      z: isPositioned && hasNumericZ ? z : 0,
      positioned: isPositioned && hasNumericZ,
    });
  });
  if (!keyed.some((k) => k.positioned)) {
    return false;
  }
  // Sort like stacking among those with numeric z; others keep DOM order
  // relative to each other (stable).
  const sorted = [...keyed].sort((a, b) => {
    if ((a.positioned || b.positioned) && a.z !== b.z) {
      return a.z - b.z;
    }
    return a.index - b.index;
  });
  return sorted.some((k, i) => k.index !== i);
}

/**
 * Cluster wrap children into rows. Prefer shared recovered row-top when
 * heights differ under center/max alignment: items belong to the same row
 * when their vertical ranges overlap substantially.
 */
function groupWrapRows(childRects: ReadonlyArray<Rect>): Array<Array<number>> {
  if (childRects.length === 0) {
    return [];
  }
  const rows: Array<Array<number>> = [];
  let current: Array<number> = [0];
  let rowTop = (childRects[0] as Rect).y;
  let rowBottom = (childRects[0] as Rect).y + (childRects[0] as Rect).height;

  for (let i = 1; i < childRects.length; i += 1) {
    const rect = childRects[i] as Rect;
    const overlaps =
      rect.y < rowBottom - GEOMETRY_TOLERANCE &&
      rect.y + rect.height > rowTop + GEOMETRY_TOLERANCE;
    // Also treat nearly-equal tops as same row (MIN align).
    const sameTop = Math.abs(rect.y - rowTop) <= GEOMETRY_TOLERANCE;
    if (overlaps || sameTop) {
      current.push(i);
      rowTop = Math.min(rowTop, rect.y);
      rowBottom = Math.max(rowBottom, rect.y + rect.height);
    } else {
      rows.push(current);
      current = [i];
      rowTop = rect.y;
      rowBottom = rect.y + rect.height;
    }
  }
  rows.push(current);
  return rows;
}

function collectChildren(
  element: Element
):
  | { ok: true; flow: Array<FlowItem>; absolute: Array<Element> }
  | { ok: false; reason: LayoutInferBailReason } {
  const flow: Array<FlowItem> = [];
  const absolute: Array<Element> = [];

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim()) {
        flow.push(node as Text);
      }
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    const child = node as Element;
    const style = window.getComputedStyle(child);
    if (style.display === "none") {
      continue;
    }
    if (style.position === "absolute" || style.position === "fixed") {
      absolute.push(child);
      continue;
    }
    if (style.order !== "0") {
      return { ok: false, reason: "order-nonzero" };
    }
    flow.push(child);
  }
  return { ok: true, flow, absolute };
}

/**
 * Reconstruct where Figma's auto-layout would place each child and compare
 * with the browser's actual geometry. Positions are relative to the parent
 * border box, matching how the converter positions children.
 */
function verifyGeometry(
  spec: InferredStack,
  parent: { width: number; height: number },
  childRects: ReadonlyArray<Rect>
): boolean {
  const isRow = spec.stackMode === "HORIZONTAL";
  const padLeading = isRow
    ? spec.stackHorizontalPadding
    : spec.stackVerticalPadding;
  const padTrailing = isRow ? spec.stackPaddingRight : spec.stackPaddingBottom;
  const padCross = isRow
    ? spec.stackVerticalPadding
    : spec.stackHorizontalPadding;
  const padCrossTrailing = isRow
    ? spec.stackPaddingBottom
    : spec.stackPaddingRight;

  const primarySize = (rect: Rect) => (isRow ? rect.width : rect.height);
  const crossSize = (rect: Rect) => (isRow ? rect.height : rect.width);

  const inner =
    (isRow ? parent.width : parent.height) - padLeading - padTrailing;
  const innerCross =
    (isRow ? parent.height : parent.width) - padCross - padCrossTrailing;
  const totalChildren = childRects.reduce((n, r) => n + primarySize(r), 0);
  const count = childRects.length;

  let spacing = spec.stackSpacing;
  let cursor = padLeading;
  switch (spec.stackPrimaryAlignItems) {
    case "CENTER":
      cursor += (inner - totalChildren - spacing * (count - 1)) / 2;
      break;
    case "MAX":
      cursor += inner - totalChildren - spacing * (count - 1);
      break;
    case "SPACE_BETWEEN":
      spacing = count > 1 ? (inner - totalChildren) / (count - 1) : 0;
      break;
    default:
      break;
  }

  for (const rect of childRects) {
    const expectedPrimary = cursor;
    let expectedCross = padCross;
    if (spec.stackCounterAlignItems === "CENTER") {
      expectedCross += (innerCross - crossSize(rect)) / 2;
    } else if (spec.stackCounterAlignItems === "MAX") {
      expectedCross += innerCross - crossSize(rect);
    }

    const actualPrimary = isRow ? rect.x : rect.y;
    const actualCross = isRow ? rect.y : rect.x;
    if (
      Math.abs(actualPrimary - expectedPrimary) > GEOMETRY_TOLERANCE ||
      Math.abs(actualCross - expectedCross) > GEOMETRY_TOLERANCE
    ) {
      return false;
    }
    cursor += primarySize(rect) + spacing;
  }

  return true;
}

function edge(value: string): number {
  return Number.parseFloat(value || "0") || 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
