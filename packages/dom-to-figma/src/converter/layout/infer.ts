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

type StackJustifyValue = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
type StackAlignValue = "MIN" | "CENTER" | "MAX";
type StackSizingValue = "FIXED" | "RESIZE_TO_FIT";

/** Max deviation (px) between reconstructed and measured child positions.
 * Looser than the oracle-strict 0.6 so more leaf flex/block containers become
 * auto-layout; outliers that still don't fit become stackPositioning ABSOLUTE
 * instead of discarding the whole stack. */
const GEOMETRY_TOLERANCE = 4;
/** Max spread (max−min) among inter-child gaps still treated as one stack gap. */
const GAP_SPREAD_TOLERANCE = 6;

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
  // Approximate baseline as start — better to keep a stack than bail entirely.
  baseline: "MIN",
  "first baseline": "MIN",
  "last baseline": "MIN",
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
 * flow (VERTICAL when spacing is uniform). Absolutely positioned children
 * ride along with `stackPositioning: "ABSOLUTE"` instead of blocking the
 * container. Children that conflict with the stack (irregular spacing,
 * non-flow layout) are kept inside the frame with `stackPositioning:
 * "ABSOLUTE"` so the parent can still be auto-layout. Hard bails remain for
 * direct text-node flow and unsupported display types.
 */
export function inferAutoLayout(element: Element): InferredAutoLayout | null {
  const style = window.getComputedStyle(element);
  const display = style.display;
  const isFlex = display === "flex" || display === "inline-flex";
  const isBlock = display === "block" || display === "flow-root";
  const isGrid = display === "grid" || display === "inline-grid";
  if (!(isFlex || isBlock || isGrid)) {
    return null;
  }

  const collected = collectChildren(element);
  if (!collected) {
    return null;
  }
  const { flow, absolute } = collected;
  // Leaf chips/buttons often have only text nodes (no element children).
  // Still emit an auto-layout frame so the bottom shell is a stack.
  if (flow.length === 0) {
    // Text-only / empty leaves need flex or block to host a stack shell.
    if (!(isFlex || isBlock) && absolute.length === 0) {
      return null;
    }
    const leaf = inferLeafShellStack(element, style, isFlex);
    if (!leaf) {
      return null;
    }
    for (const child of absolute) {
      leaf.childOverrides.set(child, { stackPositioning: "ABSOLUTE" });
    }
    return {
      stack: leaf.stack,
      children: leaf.childOverrides,
      reverseChildren: leaf.reverseChildren,
    };
  }

  const parentRect = element.getBoundingClientRect();
  // Skip zero-size shells
  if (parentRect.width < 0.5 || parentRect.height < 0.5) {
    return null;
  }

  const childRects: Array<Rect> = flow.map((child) => {
    const rect = child.getBoundingClientRect();
    return {
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height,
    };
  });
  const parentSize = { width: parentRect.width, height: parentRect.height };

  const input: StackInferenceInput = {
    element,
    style,
    flow,
    childRects,
    parentSize,
  };

  // Prefer exact geometry. Outliers only when a clear majority still stacks;
  // never park "centered" flow children as absolute — use stack alignment.
  let inferred: StackInference | null = null;
  if (isFlex) {
    if (style.flexWrap === "nowrap") {
      inferred = inferFlexStack(input) ?? inferFlexStackWithOutliers(input);
    } else {
      inferred = inferWrapStack(input, "flex");
    }
  } else if (isBlock) {
    inferred = inferBlockStack(input) ?? inferBlockStackWithOutliers(input);
  } else {
    inferred =
      inferBlockStack(input) ??
      inferWrapStack(input, "grid") ??
      inferBlockStackWithOutliers(input);
  }
  if (!inferred) {
    return null;
  }

  // Only CSS absolute/fixed (and order≠0) stay absolute in the parent stack.
  for (const child of absolute) {
    inferred.childOverrides.set(child, {
      ...inferred.childOverrides.get(child),
      stackPositioning: "ABSOLUTE",
    });
  }

  return {
    stack: inferred.stack,
    children: inferred.childOverrides,
    reverseChildren: inferred.reverseChildren,
  };
}

type StackInferenceInput = {
  element: Element;
  style: CSSStyleDeclaration;
  flow: ReadonlyArray<Element>;
  childRects: ReadonlyArray<Rect>;
  parentSize: { width: number; height: number };
};

type StackInference = {
  stack: InferredStack;
  childOverrides: Map<Element, InferredChildStack>;
  reverseChildren?: boolean;
};

function inferFlexStack(input: StackInferenceInput): StackInference | null {
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

  let cssJustify = JUSTIFY_MAP[style.justifyContent] ?? "MIN";
  const cssAlign = ALIGN_MAP[style.alignItems] ?? "MIN";
  // In reversed flow the main-axis start/end swap in visual terms.
  if (reversed && cssJustify === "MIN") {
    cssJustify = "MAX";
  } else if (reversed && cssJustify === "MAX") {
    cssJustify = "MIN";
  }

  const cssGap = readCssGap(style, isRow);
  const spacing = cssGap ?? uniformGap(childRects, isRow);
  if (spacing === null) {
    return null;
  }

  const cssPad = {
    left: round2(edge(style.borderLeftWidth) + edge(style.paddingLeft)),
    top: round2(edge(style.borderTopWidth) + edge(style.paddingTop)),
    right: round2(edge(style.borderRightWidth) + edge(style.paddingRight)),
    bottom: round2(edge(style.borderBottomWidth) + edge(style.paddingBottom)),
  };

  // Try CSS alignment first, then geometry-derived center/start/end so
  // centered flex items stay in-flow (not absolute outliers).
  const justifyCandidates = uniqueAligns(
    cssJustify,
    "MIN",
    "CENTER",
    "MAX",
    "SPACE_BETWEEN"
  );
  const alignCandidates = uniqueAligns(cssAlign, "MIN", "CENTER", "MAX");

  for (const justify of justifyCandidates) {
    for (const align of alignCandidates) {
      const pads = padsForFlexAlignment(
        childRects,
        parentSize,
        isRow,
        justify,
        align,
        spacing,
        cssPad
      );
      const spec: InferredStack = {
        stackMode: isRow ? "HORIZONTAL" : "VERTICAL",
        stackSpacing: spacing,
        stackPrimaryAlignItems: justify,
        stackCounterAlignItems: align,
        stackPrimarySizing: "FIXED",
        stackCounterSizing: "FIXED",
        stackHorizontalPadding: pads.left,
        stackVerticalPadding: pads.top,
        stackPaddingRight: pads.right,
        stackPaddingBottom: pads.bottom,
        ...(reversed && { stackReverseZIndex: true }),
      };

      if (!verifyGeometry(spec, parentSize, childRects)) {
        continue;
      }

      applySizingModes({
        element,
        style,
        spec,
        parent: parentSize,
        children: flow,
        childRects,
        isRow,
      });

      return {
        stack: spec,
        childOverrides: inferChildOverrides({
          element,
          children: flow,
          childRects,
          parentStyle: style,
          spec,
          parentSize,
          isRow,
        }),
        reverseChildren: reversed || undefined,
      };
    }
  }

  return null;
}

function uniqueAligns<T extends string>(
  preferred: T,
  ...rest: Array<T>
): Array<T> {
  const out: Array<T> = [preferred];
  for (const v of rest) {
    if (!out.includes(v)) {
      out.push(v);
    }
  }
  return out;
}

/** Derive paddings that make justify/align match measured child boxes. */
function padsForFlexAlignment(
  childRects: ReadonlyArray<Rect>,
  parentSize: { width: number; height: number },
  isRow: boolean,
  justify: StackJustifyValue,
  align: StackAlignValue,
  spacing: number,
  cssPad: { left: number; top: number; right: number; bottom: number }
): { left: number; top: number; right: number; bottom: number } {
  if (childRects.length === 0) {
    return cssPad;
  }
  const first = childRects[0] as Rect;
  const last = childRects.at(-1) as Rect;
  const primaryTotal =
    childRects.reduce((n, r) => n + (isRow ? r.width : r.height), 0) +
    spacing * (childRects.length - 1);
  const maxCross = Math.max(
    ...childRects.map((r) => (isRow ? r.height : r.width))
  );

  let padLeading: number;
  let padTrailing: number;
  if (justify === "MIN") {
    padLeading = isRow ? first.x : first.y;
    padTrailing = isRow
      ? parentSize.width - (last.x + last.width)
      : parentSize.height - (last.y + last.height);
  } else if (justify === "MAX") {
    padTrailing = isRow
      ? parentSize.width - (last.x + last.width)
      : parentSize.height - (last.y + last.height);
    padLeading = isRow
      ? parentSize.width - padTrailing - primaryTotal
      : parentSize.height - padTrailing - primaryTotal;
  } else if (justify === "CENTER") {
    const free = (isRow ? parentSize.width : parentSize.height) - primaryTotal;
    padLeading = free / 2;
    padTrailing = free / 2;
  } else {
    // SPACE_BETWEEN: use CSS padding; free space is between items
    padLeading = isRow ? cssPad.left : cssPad.top;
    padTrailing = isRow ? cssPad.right : cssPad.bottom;
  }

  // Cross-axis padding from first child's offset when all share alignment
  let padCross: number;
  let padCrossTrailing: number;
  if (align === "MIN") {
    padCross = Math.min(...childRects.map((r) => (isRow ? r.y : r.x)));
    padCrossTrailing = isRow
      ? parentSize.height - (padCross + maxCross)
      : parentSize.width - (padCross + maxCross);
  } else if (align === "MAX") {
    padCrossTrailing = Math.min(
      ...childRects.map((r) =>
        isRow
          ? parentSize.height - (r.y + r.height)
          : parentSize.width - (r.x + r.width)
      )
    );
    padCross = isRow
      ? parentSize.height - padCrossTrailing - maxCross
      : parentSize.width - padCrossTrailing - maxCross;
  } else {
    // CENTER
    const free = (isRow ? parentSize.height : parentSize.width) - maxCross;
    padCross = free / 2;
    padCrossTrailing = free / 2;
  }

  if (isRow) {
    return {
      left: round2(Math.max(0, padLeading)),
      top: round2(Math.max(0, padCross)),
      right: round2(Math.max(0, padTrailing)),
      bottom: round2(Math.max(0, padCrossTrailing)),
    };
  }
  return {
    left: round2(Math.max(0, padCross)),
    top: round2(Math.max(0, padLeading)),
    right: round2(Math.max(0, padCrossTrailing)),
    bottom: round2(Math.max(0, padTrailing)),
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
): StackInference | null {
  const { element, style, flow, childRects, parentSize } = input;

  if (source === "flex") {
    if (style.flexDirection !== "row" || style.flexWrap !== "wrap") {
      return null; // wrap-reverse / column wrap aren't modeled.
    }
    // Row-internal distribution other than left-packed changes Figma's
    // re-flow in ways the simulation below doesn't model.
    if (JUSTIFY_MAP[style.justifyContent] !== "MIN") {
      return null;
    }
    if (ALIGN_MAP[style.alignItems] !== "MIN") {
      return null;
    }
  }
  for (const child of flow) {
    if (Number.parseFloat(window.getComputedStyle(child).flexGrow) > 0) {
      return null; // fill-in-wrap is unverified against Figma.
    }
  }

  const padLeft = edge(style.borderLeftWidth) + edge(style.paddingLeft);
  const padTop = edge(style.borderTopWidth) + edge(style.paddingTop);
  const padRight = edge(style.borderRightWidth) + edge(style.paddingRight);
  const padBottom = edge(style.borderBottomWidth) + edge(style.paddingBottom);

  // Group measured rects into rows by top edge (children of a row share it
  // for the start/stretch alignments accepted above).
  const rows: Array<Array<number>> = [];
  let currentTop = Number.NEGATIVE_INFINITY;
  childRects.forEach((rect, i) => {
    if (Math.abs(rect.y - currentTop) > GEOMETRY_TOLERANCE) {
      rows.push([]);
      currentTop = rect.y;
    }
    (rows.at(-1) as Array<number>).push(i);
  });

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
    return null;
  }

  const rowTops = rows.map((r) => (childRects[r[0] as number] as Rect).y);
  const rowHeights = rows.map((r) =>
    Math.max(...r.map((i) => (childRects[i] as Rect).height))
  );
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
    return null;
  }

  // Simulate Figma's greedy packing; every child must land exactly where the
  // browser put it.
  const rightLimit = parentSize.width - padRight;
  let x = padLeft;
  let y = padTop;
  let simRowHeight = 0;
  let rowStart = true;
  for (const rect of childRects) {
    if (!rowStart && x + rect.width - rightLimit > GEOMETRY_TOLERANCE) {
      y += simRowHeight + counterSpacing;
      x = padLeft;
      simRowHeight = 0;
    }
    if (
      Math.abs(rect.x - x) > GEOMETRY_TOLERANCE ||
      Math.abs(rect.y - y) > GEOMETRY_TOLERANCE
    ) {
      return null;
    }
    x += rect.width + spacing;
    simRowHeight = Math.max(simRowHeight, rect.height);
    rowStart = false;
  }

  const spec: InferredStack = {
    stackMode: "HORIZONTAL",
    stackSpacing: spacing,
    stackPrimaryAlignItems: "MIN",
    stackCounterAlignItems: "MIN",
    stackPrimarySizing: "FIXED",
    stackCounterSizing: "FIXED",
    stackHorizontalPadding: round2(padLeft),
    stackVerticalPadding: round2(padTop),
    stackPaddingRight: round2(padRight),
    stackPaddingBottom: round2(padBottom),
    stackWrap: "WRAP",
    stackCounterSpacing: counterSpacing,
  };

  // Counter-axis hug: rows content height equals the frame height.
  const contentHeight =
    padTop +
    padBottom +
    rowHeights.reduce((n, h) => n + h, 0) +
    counterSpacing * (rows.length - 1);
  if (
    isContentDrivenSize(element, style, "height") &&
    Math.abs(parentSize.height - contentHeight) <= GEOMETRY_TOLERANCE
  ) {
    spec.stackCounterSizing = "RESIZE_TO_FIT";
  }

  return { stack: spec, childOverrides: new Map() };
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
function inferBlockStack(input: StackInferenceInput): StackInference | null {
  const { element, style, flow, childRects, parentSize } = input;

  for (const child of flow) {
    const childStyle = window.getComputedStyle(child);
    if (!BLOCK_LEVEL_DISPLAYS.has(childStyle.display)) {
      return null; // Inline flow — not representable as a stack.
    }
    if (childStyle.float !== "none") {
      return null;
    }
  }

  const spacing = uniformGap(childRects, false);
  if (spacing === null) {
    return null;
  }

  const first = childRects[0] as Rect;
  const last = childRects.at(-1) as Rect;
  const padTop = first.y;
  const padBottom = parentSize.height - (last.y + last.height);
  if (padTop < -GEOMETRY_TOLERANCE || padBottom < -GEOMETRY_TOLERANCE) {
    return null; // Content overflows the frame; a stack would clip/shift it.
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

    applySizingModes({
      element,
      style,
      spec,
      parent: parentSize,
      children: flow,
      childRects,
      isRow: false,
    });

    // Block children with `width: auto` fill the content box — exactly
    // Figma's STRETCH on the counter axis of a vertical stack.
    const childOverrides = new Map<Element, InferredChildStack>();
    const innerWidth = parentSize.width - padLeft - padRight;
    flow.forEach((child, i) => {
      if (
        hasContentSizedKeyword(child, "width") &&
        Math.abs((childRects[i] as Rect).width - innerWidth) <=
          GEOMETRY_TOLERANCE
      ) {
        childOverrides.set(child, { stackChildAlignSelf: "STRETCH" });
      }
    });

    return { stack: spec, childOverrides };
  }

  return null;
}

/**
 * Best-effort flex stack: keep auto-layout on the parent, mark children that
 * don't sit on the reconstructed stack line as `stackPositioning: ABSOLUTE`
 * (in the frame but not controlled by auto-layout). Preserves visual structure
 * while maximizing bottom-level stacks.
 */
/** Auto-layout shell for leaf flex/block with only text (no element children). */
function inferLeafShellStack(
  _element: Element,
  style: CSSStyleDeclaration,
  isFlex: boolean
): StackInference | null {
  const direction = isFlex ? style.flexDirection || "row" : "column";
  const isRow = isFlex
    ? direction === "row" || direction === "row-reverse"
    : false;
  const reversed = isFlex && direction.endsWith("-reverse");
  let justify = isFlex ? (JUSTIFY_MAP[style.justifyContent] ?? "MIN") : "MIN";
  const align = isFlex ? (ALIGN_MAP[style.alignItems] ?? "CENTER") : "MIN";
  if (reversed && justify === "MIN") {
    justify = "MAX";
  } else if (reversed && justify === "MAX") {
    justify = "MIN";
  }

  const gap = isFlex ? (readCssGap(style, isRow) ?? 0) : 0;

  const stack: InferredStack = {
    stackMode: isRow ? "HORIZONTAL" : "VERTICAL",
    stackSpacing: Math.max(0, gap),
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

  return {
    stack,
    childOverrides: new Map(),
    reverseChildren: reversed || undefined,
  };
}

function inferFlexStackWithOutliers(
  input: StackInferenceInput
): StackInference | null {
  const { element, style, flow, childRects, parentSize } = input;
  if (flow.length === 0) {
    return null;
  }

  const direction = style.flexDirection;
  const isRow = direction === "row" || direction === "row-reverse";
  const reversed = direction.endsWith("-reverse");

  let justify = JUSTIFY_MAP[style.justifyContent] ?? "MIN";
  const align = ALIGN_MAP[style.alignItems] ?? "MIN";
  if (reversed && justify === "MIN") {
    justify = "MAX";
  } else if (reversed && justify === "MAX") {
    justify = "MIN";
  }

  // Work in visual order for reverse flex.
  const order = reversed
    ? flow.map((_, i) => i).reverse()
    : flow.map((_, i) => i);
  let active = order.slice();

  const padLeft = edge(style.borderLeftWidth) + edge(style.paddingLeft);
  const padTop = edge(style.borderTopWidth) + edge(style.paddingTop);
  const padRight = edge(style.borderRightWidth) + edge(style.paddingRight);
  const padBottom = edge(style.borderBottomWidth) + edge(style.paddingBottom);

  const cssGap = readCssGap(style, isRow);

  // Iteratively drop the worst outlier until geometry verifies or too few left.
  let attemptsLeft = flow.length;
  while (attemptsLeft > 0) {
    attemptsLeft -= 1;
    if (active.length === 0) {
      return null;
    }
    const activeRects = active.map((i) => childRects[i] as Rect);
    const spacing = cssGap ?? averageGap(activeRects, isRow) ?? 0;

    const spec: InferredStack = {
      stackMode: isRow ? "HORIZONTAL" : "VERTICAL",
      stackSpacing: spacing,
      stackPrimaryAlignItems: justify,
      stackCounterAlignItems: align,
      stackPrimarySizing: "FIXED",
      stackCounterSizing: "FIXED",
      stackHorizontalPadding: round2(padLeft),
      stackVerticalPadding: round2(padTop),
      stackPaddingRight: round2(padRight),
      stackPaddingBottom: round2(padBottom),
      ...(reversed && { stackReverseZIndex: true }),
    };

    if (verifyGeometry(spec, parentSize, activeRects)) {
      const absCount = flow.length - active.length;
      // Hierarchy: only park true outliers. If too many go absolute, the
      // "auto-layout" shell is misleading — refuse and leave parent absolute.
      if (
        absCount > 0 &&
        (active.length < 2 || absCount > Math.ceil(flow.length / 3))
      ) {
        // keep trying with fewer, or fail
      } else {
        const activeSet = new Set(active);
        const childOverrides = new Map<Element, InferredChildStack>();
        for (let i = 0; i < flow.length; i += 1) {
          if (!activeSet.has(i)) {
            childOverrides.set(flow[i] as Element, {
              stackPositioning: "ABSOLUTE",
            });
          }
        }

        const activeChildren = active.map((i) => flow[i] as Element);
        applySizingModes({
          element,
          style,
          spec,
          parent: parentSize,
          children: activeChildren,
          childRects: activeRects,
          isRow,
        });

        const growStretch = inferChildOverrides({
          element,
          children: activeChildren,
          childRects: activeRects,
          parentStyle: style,
          spec,
          parentSize,
          isRow,
        });
        for (const [el, ov] of growStretch) {
          childOverrides.set(el, { ...childOverrides.get(el), ...ov });
        }

        return {
          stack: spec,
          childOverrides,
          reverseChildren: reversed || undefined,
        };
      }
    }

    // Drop the child with the largest primary-axis error vs expected cursor.
    if (active.length <= 1) {
      // Single remaining child: accept as 1-item stack (padding/alignment).
      if (active.length === 1) {
        const onlyRects = active.map((i) => childRects[i] as Rect);
        const spacing0 = 0;
        const spec1: InferredStack = {
          stackMode: isRow ? "HORIZONTAL" : "VERTICAL",
          stackSpacing: spacing0,
          stackPrimaryAlignItems: justify,
          stackCounterAlignItems: align,
          stackPrimarySizing: "FIXED",
          stackCounterSizing: "FIXED",
          stackHorizontalPadding: round2(padLeft),
          stackVerticalPadding: round2(padTop),
          stackPaddingRight: round2(padRight),
          stackPaddingBottom: round2(padBottom),
          ...(reversed && { stackReverseZIndex: true }),
        };
        // Force pads from the single child's measured position if tighter.
        if (isRow) {
          spec1.stackHorizontalPadding = round2(Math.max(0, onlyRects[0]?.x));
          spec1.stackPaddingRight = round2(
            Math.max(
              0,
              parentSize.width - (onlyRects[0]?.x + onlyRects[0]?.width)
            )
          );
        } else {
          spec1.stackVerticalPadding = round2(Math.max(0, onlyRects[0]?.y));
          spec1.stackPaddingBottom = round2(
            Math.max(
              0,
              parentSize.height - (onlyRects[0]?.y + onlyRects[0]?.height)
            )
          );
        }
        if (verifyGeometry(spec1, parentSize, onlyRects)) {
          const childOverrides = new Map<Element, InferredChildStack>();
          const activeSet = new Set(active);
          for (let i = 0; i < flow.length; i += 1) {
            if (!activeSet.has(i)) {
              childOverrides.set(flow[i] as Element, {
                stackPositioning: "ABSOLUTE",
              });
            }
          }
          return {
            stack: spec1,
            childOverrides,
            reverseChildren: reversed || undefined,
          };
        }
      }
      return null;
    }

    const worst = worstPrimaryOutlierIndex(
      active,
      activeRects,
      isRow,
      justify,
      align,
      {
        padLeading: isRow ? padLeft : padTop,
        padTrailing: isRow ? padRight : padBottom,
        padCross: isRow ? padTop : padLeft,
        padCrossTrailing: isRow ? padBottom : padRight,
        spacing,
        parentSize,
      }
    );
    if (worst < 0) {
      // No single culprit — drop last item as weak heuristic.
      active = active.slice(0, -1);
    } else {
      active = active.filter((i) => i !== worst);
    }
  }

  return null;
}

function inferBlockStackWithOutliers(
  input: StackInferenceInput
): StackInference | null {
  const { element, style, flow, childRects, parentSize } = input;
  if (flow.length === 0) {
    return null;
  }

  // Only block-level non-float children can stay in the stack; others absolute.
  const eligible: Array<number> = [];
  const forcedAbs: Array<number> = [];
  flow.forEach((child, i) => {
    const childStyle = window.getComputedStyle(child);
    if (
      !BLOCK_LEVEL_DISPLAYS.has(childStyle.display) ||
      childStyle.float !== "none"
    ) {
      forcedAbs.push(i);
    } else {
      eligible.push(i);
    }
  });
  if (eligible.length === 0) {
    return null;
  }

  let active = eligible.slice();
  let attemptsLeft = flow.length;
  while (attemptsLeft > 0) {
    attemptsLeft -= 1;
    if (active.length === 0) {
      return null;
    }
    const activeRects = active.map((i) => childRects[i] as Rect);
    const spacing = averageGap(activeRects, false);
    if (spacing === null && active.length > 1) {
      // Drop largest gap jump
      let dropAt = 1;
      let worstJump = -1;
      for (let k = 1; k < activeRects.length; k += 1) {
        const prev = activeRects[k - 1];
        const cur = activeRects[k];
        if (!(prev && cur)) {
          continue;
        }
        const g = cur.y - (prev.y + prev.height);
        if (Math.abs(g) > worstJump) {
          worstJump = Math.abs(g);
          dropAt = k;
        }
      }
      active = active.filter((_, idx) => idx !== dropAt);
      continue;
    }

    const first = activeRects[0] as Rect;
    const last = activeRects.at(-1) as Rect;
    const padTop = first.y;
    const padBottom = parentSize.height - (last.y + last.height);
    if (padTop < -GEOMETRY_TOLERANCE || padBottom < -GEOMETRY_TOLERANCE) {
      // Overflowing content: drop first or last
      if (padTop < -GEOMETRY_TOLERANCE && active.length > 1) {
        active = active.slice(1);
        continue;
      }
      if (padBottom < -GEOMETRY_TOLERANCE && active.length > 1) {
        active = active.slice(0, -1);
        continue;
      }
      return null;
    }

    const padLeft = edge(style.borderLeftWidth) + edge(style.paddingLeft);
    const padRight = edge(style.borderRightWidth) + edge(style.paddingRight);
    const space = spacing ?? 0;

    for (const align of ["MIN", "CENTER", "MAX"] as const) {
      const spec: InferredStack = {
        stackMode: "VERTICAL",
        stackSpacing: space,
        stackPrimaryAlignItems: "MIN",
        stackCounterAlignItems: align,
        stackPrimarySizing: "FIXED",
        stackCounterSizing: "FIXED",
        stackHorizontalPadding: round2(padLeft),
        stackVerticalPadding: round2(Math.max(padTop, 0)),
        stackPaddingRight: round2(padRight),
        stackPaddingBottom: round2(Math.max(padBottom, 0)),
      };
      if (!verifyGeometry(spec, parentSize, activeRects)) {
        continue;
      }

      const activeSet = new Set(active);
      const childOverrides = new Map<Element, InferredChildStack>();
      for (const i of forcedAbs) {
        childOverrides.set(flow[i] as Element, {
          stackPositioning: "ABSOLUTE",
        });
      }
      for (let i = 0; i < flow.length; i += 1) {
        if (!(activeSet.has(i) || forcedAbs.includes(i))) {
          childOverrides.set(flow[i] as Element, {
            stackPositioning: "ABSOLUTE",
          });
        }
      }

      const activeChildren = active.map((i) => flow[i] as Element);
      applySizingModes({
        element,
        style,
        spec,
        parent: parentSize,
        children: activeChildren,
        childRects: activeRects,
        isRow: false,
      });

      const innerWidth = parentSize.width - padLeft - padRight;
      activeChildren.forEach((child, idx) => {
        if (
          hasContentSizedKeyword(child, "width") &&
          Math.abs((activeRects[idx] as Rect).width - innerWidth) <=
            GEOMETRY_TOLERANCE
        ) {
          childOverrides.set(child, {
            ...childOverrides.get(child),
            stackChildAlignSelf: "STRETCH",
          });
        }
      });

      const absCount = flow.length - active.length;
      if (
        absCount > 0 &&
        (active.length < 2 || absCount > Math.ceil(flow.length / 3))
      ) {
        continue;
      }

      return { stack: spec, childOverrides };
    }

    // No align worked — drop worst vertical outlier
    if (active.length <= 1) {
      return null;
    }
    const worst = worstPrimaryOutlierIndex(
      active,
      activeRects,
      false,
      "MIN",
      "MIN",
      {
        padLeading: Math.max(padTop, 0),
        padTrailing: Math.max(padBottom, 0),
        padCross: padLeft,
        padCrossTrailing: padRight,
        spacing: space,
        parentSize,
      }
    );
    active =
      worst < 0 ? active.slice(0, -1) : active.filter((i) => i !== worst);
  }
  return null;
}

function readCssGap(style: CSSStyleDeclaration, isRow: boolean): number | null {
  const raw = isRow ? style.columnGap || style.gap : style.rowGap || style.gap;
  if (!raw || raw === "normal") {
    return null;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? round2(n) : null;
}

function averageGap(
  childRects: ReadonlyArray<Rect>,
  isRow: boolean
): number | null {
  if (childRects.length <= 1) {
    return 0;
  }
  const gaps: Array<number> = [];
  for (let i = 1; i < childRects.length; i += 1) {
    const prev = childRects[i - 1] as Rect;
    const next = childRects[i] as Rect;
    gaps.push(
      isRow ? next.x - (prev.x + prev.width) : next.y - (prev.y + prev.height)
    );
  }
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  // For outlier mode allow larger spread; caller already drops outliers.
  if (max - min > GAP_SPREAD_TOLERANCE * 3) {
    return null;
  }
  return round2(gaps.reduce((s, g) => s + g, 0) / gaps.length);
}

function worstPrimaryOutlierIndex(
  active: ReadonlyArray<number>,
  activeRects: ReadonlyArray<Rect>,
  isRow: boolean,
  justify: StackJustifyValue,
  align: StackAlignValue,
  pads: {
    padLeading: number;
    padTrailing: number;
    padCross: number;
    padCrossTrailing: number;
    spacing: number;
    parentSize: { width: number; height: number };
  }
): number {
  const {
    padLeading,
    padTrailing,
    padCross,
    padCrossTrailing,
    spacing,
    parentSize,
  } = pads;
  const primarySize = (rect: Rect) => (isRow ? rect.width : rect.height);
  const crossSize = (rect: Rect) => (isRow ? rect.height : rect.width);
  const inner =
    (isRow ? parentSize.width : parentSize.height) - padLeading - padTrailing;
  const innerCross =
    (isRow ? parentSize.height : parentSize.width) -
    padCross -
    padCrossTrailing;
  const totalChildren = activeRects.reduce((n, r) => n + primarySize(r), 0);
  const count = activeRects.length;

  let useSpacing = spacing;
  let cursor = padLeading;
  switch (justify) {
    case "CENTER":
      cursor += (inner - totalChildren - useSpacing * (count - 1)) / 2;
      break;
    case "MAX":
      cursor += inner - totalChildren - useSpacing * (count - 1);
      break;
    case "SPACE_BETWEEN":
      useSpacing = count > 1 ? (inner - totalChildren) / (count - 1) : 0;
      break;
    default:
      break;
  }

  let worstIdx = -1;
  let worstErr = -1;
  for (let k = 0; k < activeRects.length; k += 1) {
    const rect = activeRects[k] as Rect;
    const expectedPrimary = cursor;
    let expectedCross = padCross;
    if (align === "CENTER") {
      expectedCross += (innerCross - crossSize(rect)) / 2;
    } else if (align === "MAX") {
      expectedCross += innerCross - crossSize(rect);
    }
    const actualPrimary = isRow ? rect.x : rect.y;
    const actualCross = isRow ? rect.y : rect.x;
    const err =
      Math.abs(actualPrimary - expectedPrimary) +
      Math.abs(actualCross - expectedCross);
    if (err > worstErr) {
      worstErr = err;
      worstIdx = active[k] as number;
    }
    cursor += primarySize(rect) + useSpacing;
  }
  return worstErr > GEOMETRY_TOLERANCE ? worstIdx : -1;
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
 * Split element children into layout participants (`flow`) and absolutely
 * positioned ones (which become `stackPositioning: "ABSOLUTE"`), or `null`
 * when the container holds something we don't model yet (text-node flow
 * items, `order`).
 */
function collectChildren(
  element: Element
): { flow: Array<Element>; absolute: Array<Element> } | null {
  // Direct text nodes are emitted as TEXT layers by the walker. They used to
  // hard-bail the whole stack (killing bottom-level chips/buttons). We ignore
  // them for element flow classification; geometry paths tolerate them via
  // outlier / all-absolute fallbacks.
  const flow: Array<Element> = [];
  const absolute: Array<Element> = [];
  for (const child of element.children) {
    const style = window.getComputedStyle(child);
    if (style.display === "none") {
      continue; // Takes no space and the walker skips it too.
    }
    if (style.position === "absolute" || style.position === "fixed") {
      absolute.push(child);
      continue;
    }
    // Non-default `order` breaks DOM≈visual order for stacks — park as
    // absolute so the rest of the container can still become auto-layout.
    if (style.order !== "0") {
      absolute.push(child);
      continue;
    }
    flow.push(child);
  }
  return { flow, absolute };
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
