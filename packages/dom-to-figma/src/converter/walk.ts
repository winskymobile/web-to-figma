import type { ElementKind } from "./classify";
import { defaultClassify } from "./classify";
import type { ConversionResult, InheritedProperties } from "./convert";
import { convertElement } from "./convert";
import type { DiagnosticReporter } from "./diagnostics";
import type { TextLineSegment } from "./dom";
import {
  getElementPositionRelativeToParent,
  getTextPositionRelativeToParent,
  getTextSize,
  isElementNode,
  isSvgElement,
  isTextEmpty,
  isTextNode,
  sortNodesByStackingOrder,
  splitMidLineWrappedText,
} from "./dom";
import type { FontCache } from "./font-cache";
import type { ImageCache } from "./image-cache";
import type { InferredChildStack } from "./layout/infer";
import { convertDecorativePseudo } from "./nodes/pseudo/converter";
import { rasterizeMaskedPseudo } from "./nodes/pseudo/raster";
import { nodeToTextNodeChange } from "./nodes/text";
import type { FigmaBlob, FigmaGuid, FigmaNodeChange } from "./types";

export type Classify = (
  element: Element,
  defaultKind: ElementKind
) => ElementKind;

/** `"auto"` infers Figma auto-layout for flex containers; `"absolute"` keeps
 * every frame absolutely positioned (the historical behavior). */
export type ConverterLayout = "absolute" | "auto";

export type WalkContext = {
  classify?: Classify;
  layout?: ConverterLayout;
  createGuid: () => FigmaGuid;
  registerBlob: (blob: FigmaBlob) => number;
  fontCache: FontCache;
  imageCache: ImageCache;
  reportDiagnostic: DiagnosticReporter;
  appendChanges: (changes: ReadonlyArray<FigmaNodeChange>) => void;
};

const EMPTY_INHERITED: InheritedProperties = {};
const VIEWBOX_SEPARATOR = /[\s,]+/;

export async function walkRoot(
  root: Element,
  parentGuid: FigmaGuid,
  ctx: WalkContext,
  rootSize?: { width: number; height: number }
) {
  await walkNode(root, parentGuid, 0, EMPTY_INHERITED, ctx, {
    isAutoLayout: false,
    rootFill: rootSize,
  });
}

type ParentStackInfo = {
  isAutoLayout: boolean;
  childSpecs?: ReadonlyMap<Element, InferredChildStack>;
  /** Reversed flex parent: emit children in visual (reversed DOM) order. */
  reverse?: boolean;
  /** Only on the root walk: the paste-template frame size. */
  rootFill?: { width: number; height: number };
};

const NO_PARENT_STACK: ParentStackInfo = { isAutoLayout: false };

type BuiltPseudo = {
  kind: "before" | "after";
  zIndex: number;
  nodeChange: FigmaNodeChange;
};

/** Convert absolute decorative ::before/::after; rasterize masked paint when needed. */
async function collectDecorativePseudos(
  node: Element,
  parentGuid: FigmaGuid,
  ctx: WalkContext
): Promise<Array<BuiltPseudo>> {
  const built: Array<BuiltPseudo> = [];
  for (const pseudoKind of ["before", "after"] as const) {
    const converted = convertDecorativePseudo(node, pseudoKind, {
      createGuid: ctx.createGuid,
      parentGuid,
      childIndex: 0,
    });
    if (converted.ok) {
      built.push({
        kind: pseudoKind,
        zIndex: converted.zIndex,
        nodeChange: converted.nodeChange,
      });
      continue;
    }

    if (
      converted.reason === "masked" &&
      converted.box &&
      converted.zIndex !== undefined
    ) {
      const raster = await rasterizeMaskedPseudo({
        host: node,
        kind: pseudoKind,
        box: converted.box,
        guid: ctx.createGuid(),
        parentGuid,
        childIndex: 0,
        registerBlob: ctx.registerBlob,
        zIndex: converted.zIndex,
      });
      if (raster) {
        built.push({
          kind: pseudoKind,
          zIndex: converted.zIndex,
          nodeChange: raster,
        });
        ctx.reportDiagnostic({
          code: "decoration-rasterized",
          severity: "warning",
          reason: "masked",
          message: `Rasterized ::${pseudoKind} on ${safeNodeLabel(node)} (mask).`,
        });
        continue;
      }
    }

    if (
      converted.reason === "masked" ||
      converted.reason === "unresolved-geometry" ||
      converted.reason === "generated-text"
    ) {
      ctx.reportDiagnostic({
        code: "pseudo-skipped",
        severity: "warning",
        reason: converted.reason,
        message: `Skipped ::${pseudoKind} on ${safeNodeLabel(node)} (${converted.reason}).`,
      });
    }
  }
  return built;
}

function partitionPseudos(built: ReadonlyArray<BuiltPseudo>): {
  behind: Array<BuiltPseudo>;
  front: Array<BuiltPseudo>;
} {
  const kindRank = (k: "before" | "after") => (k === "before" ? 0 : 1);
  const sortKey = (a: BuiltPseudo, b: BuiltPseudo) =>
    a.zIndex - b.zIndex || kindRank(a.kind) - kindRank(b.kind);
  return {
    behind: built.filter((p) => p.zIndex < 0).sort(sortKey),
    front: built.filter((p) => p.zIndex >= 0).sort(sortKey),
  };
}

/** Inline text hosts that wrap mid-line emit split segments against the parent. */
async function tryEmitInlineTextHost(
  node: Element,
  kind: string,
  parentGuid: FigmaGuid,
  childIndex: number,
  inheritedProperties: InheritedProperties,
  ctx: WalkContext
): Promise<number | null> {
  if (kind !== "text" || !node.parentElement) {
    return null;
  }
  const only =
    node.childNodes.length === 1 && node.firstChild ? node.firstChild : null;
  if (!(only && isTextNode(only))) {
    return null;
  }
  const segments = splitMidLineWrappedText(only, {
    siblingContext: node,
    relativeTo: node.parentElement,
  });
  if (!segments) {
    return null;
  }
  return await emitTextSegments(
    only,
    segments,
    parentGuid,
    childIndex,
    inheritedProperties,
    ctx
  );
}

/** Returns the number of node changes emitted for this DOM node (text nodes
 * can split into several). */
async function walkNode(
  node: Node,
  parentGuid: FigmaGuid,
  childIndex: number,
  inheritedProperties: InheritedProperties,
  ctx: WalkContext,
  parentStack: ParentStackInfo = NO_PARENT_STACK
): Promise<number> {
  try {
    if (isTextNode(node)) {
      return await renderTextNode(
        node,
        parentGuid,
        childIndex,
        inheritedProperties,
        ctx,
        parentStack.isAutoLayout
      );
    }
    if (!isElementNode(node)) {
      return 0;
    }

    const defaultKind = defaultClassify(node);
    const kind = ctx.classify ? ctx.classify(node, defaultKind) : defaultKind;

    if (kind === "skip") {
      return 0;
    }

    const inlineCount = await tryEmitInlineTextHost(
      node,
      kind,
      parentGuid,
      childIndex,
      inheritedProperties,
      ctx
    );
    if (inlineCount !== null) {
      return inlineCount;
    }

    const guid = ctx.createGuid();
    const position = getElementPositionRelativeToParent(node);

    const result = await convertElement(node, kind, {
      guid,
      parentGuid,
      childIndex,
      position,
      inheritedProperties,
      layout: ctx.layout,
      parentIsAutoLayout: parentStack.isAutoLayout,
      childStackSpec: parentStack.childSpecs?.get(node),
      rootFill: parentStack.rootFill,
      registerBlob: ctx.registerBlob,
      fontCache: ctx.fontCache,
      imageCache: ctx.imageCache,
      createGuid: ctx.createGuid,
      reportDiagnostic: ctx.reportDiagnostic,
    });

    ctx.appendChanges(result.changes);

    let childIndexCursor = 0;
    const canHostPseudos =
      result.hasChildren || kind === "frame" || kind === "group";
    const builtPseudos = canHostPseudos
      ? await collectDecorativePseudos(node, guid, ctx)
      : [];
    const { behind, front } = partitionPseudos(builtPseudos);

    const emitPseudo = (item: BuiltPseudo) => {
      const parentIndex = item.nodeChange.parentIndex;
      if (!parentIndex) {
        return;
      }
      item.nodeChange.parentIndex = {
        guid: parentIndex.guid,
        position: childIndexCursor.toString(),
      };
      ctx.appendChanges([item.nodeChange]);
      childIndexCursor += 1;
    };

    for (const item of behind) {
      emitPseudo(item);
    }

    if (result.hasChildren) {
      childIndexCursor += await walkChildren(
        node,
        guid,
        nextInheritedProperties(node, inheritedProperties, result),
        ctx,
        {
          isAutoLayout: result.isAutoLayout ?? false,
          childSpecs: result.childStackSpecs,
          reverse: result.reverseChildren,
        },
        childIndexCursor
      );
    }

    for (const item of front) {
      emitPseudo(item);
    }

    return 1;
  } catch {
    ctx.reportDiagnostic({
      code: "node-conversion-failed",
      severity: "error",
      message: `Failed to convert ${safeNodeLabel(node)} node.`,
    });
    return 0;
  }
}

async function walkChildren(
  element: Element,
  parentGuid: FigmaGuid,
  inheritedProperties: InheritedProperties,
  ctx: WalkContext,
  parentStack: ParentStackInfo = NO_PARENT_STACK,
  startChildIndex = 0
): Promise<number> {
  // Auto-layout parents: Figma stacks lay out in *emission* order, so keep
  // DOM order (or reverse for flex-direction reverse). Sorting by stacking
  // order here reorders siblings in the layer tree and breaks hierarchy.
  // Absolute parents: stacking order preserves paint/z without affecting
  // positions (each child is absolutely placed).
  const childNodes = Array.from(element.childNodes);
  const sortedNodes = parentStack.isAutoLayout
    ? childNodes
    : sortNodesByStackingOrder(childNodes);
  if (parentStack.reverse) {
    // Reversed flex parent: emit visual order; stackReverseZIndex restores paint.
    sortedNodes.reverse();
  }

  let childNodeIndex = startChildIndex;
  let emitted = 0;
  for (const node of sortedNodes) {
    const n = await walkNode(
      node,
      parentGuid,
      childNodeIndex,
      inheritedProperties,
      ctx,
      parentStack
    );
    childNodeIndex += n;
    emitted += n;
  }
  return emitted;
}

async function renderTextNode(
  textNode: Text,
  parentGuid: FigmaGuid,
  childIndex: number,
  inheritedProperties: InheritedProperties,
  ctx: WalkContext,
  parentIsAutoLayout = false
): Promise<number> {
  if (isTextEmpty(textNode)) {
    return 0;
  }
  if (!textNode.parentElement) {
    return 0;
  }

  // A text node that continues a sibling's line and wraps cannot be one
  // Figma text box (its indented first line isn't representable): emit one
  // box per rendered line instead.
  const segments = splitMidLineWrappedText(textNode);
  if (segments) {
    return await emitTextSegments(
      textNode,
      segments,
      parentGuid,
      childIndex,
      inheritedProperties,
      ctx
    );
  }

  const guid = ctx.createGuid();
  const change = await nodeToTextNodeChange(textNode, {
    guid,
    parentGuid,
    childIndex,
    position: getTextPositionRelativeToParent(textNode),
    // Exact size inside stacks: box edges drive sibling positions there.
    size: getTextSize(textNode, parentIsAutoLayout),
    textContent: (textNode.textContent || "").trim(),
    registerBlob: ctx.registerBlob,
    inheritedProperties,
    fontCache: ctx.fontCache,
    reportDiagnostic: ctx.reportDiagnostic,
  });

  ctx.appendChanges([change]);
  return 1;
}

async function emitTextSegments(
  textNode: Text,
  segments: ReadonlyArray<TextLineSegment>,
  parentGuid: FigmaGuid,
  childIndex: number,
  inheritedProperties: InheritedProperties,
  ctx: WalkContext
): Promise<number> {
  let emitted = 0;
  for (const segment of segments) {
    const change = await nodeToTextNodeChange(textNode, {
      guid: ctx.createGuid(),
      parentGuid,
      childIndex: childIndex + emitted,
      position: segment.position,
      size: segment.size,
      textContent: segment.text,
      registerBlob: ctx.registerBlob,
      inheritedProperties,
      fontCache: ctx.fontCache,
      reportDiagnostic: ctx.reportDiagnostic,
    });
    ctx.appendChanges([change]);
    emitted += 1;
  }
  return emitted;
}

function safeNodeLabel(node: Node): string {
  if (isElementNode(node)) {
    return node.tagName;
  }
  return node.nodeName || "unknown";
}

function nextInheritedProperties(
  element: Element,
  prev: InheritedProperties,
  result: ConversionResult
): InheritedProperties {
  let svgViewbox = prev.svgViewbox;
  if (isSvgElement(element)) {
    const parsed = element
      .getAttribute("viewBox")
      ?.split(VIEWBOX_SEPARATOR)
      .map(Number);
    if (parsed) {
      svgViewbox = {
        width: parsed[2] ?? 0,
        height: parsed[3] ?? 0,
      };
    }
  }

  return {
    textGradient: result.frameTextGradient ?? prev.textGradient,
    svgViewbox,
  };
}
