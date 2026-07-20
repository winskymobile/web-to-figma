import { parseBorderFromComputedStyle } from "../../styles/border";
import { createSolidPaint, cssColorToFigmaColor } from "../../styles/color";
import { cssBackgroundToFigmaPaints } from "../../styles/gradient";
import { parseOpacity } from "../../styles/opacity";
import { cssBoxShadowToFigmaEffects } from "../../styles/shadow";
import type {
  FigmaFrameNodeChange,
  FigmaGuid,
  FigmaPaint,
  FigmaTransform,
} from "../../types";

export type PseudoKind = "before" | "after";

export type PseudoSkipReason =
  | "inactive"
  | "display-none"
  | "not-absolute"
  | "generated-text"
  | "no-ink"
  | "masked"
  | "unresolved-geometry";

export type PseudoConvertResult =
  | { ok: true; nodeChange: FigmaFrameNodeChange; zIndex: number }
  | {
      ok: false;
      reason: PseudoSkipReason;
      /** Present when geometry resolved (e.g. masked candidate for raster). */
      box?: { x: number; y: number; width: number; height: number };
      zIndex?: number;
      style?: CSSStyleDeclaration;
    };

/** Parse CSS z-index; auto/invalid → 0 for paint-order classification. */
export function parsePseudoZIndex(style: CSSStyleDeclaration): number {
  const raw = style.zIndex.trim();
  if (!raw || raw === "auto") {
    return 0;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

type Box = { x: number; y: number; width: number; height: number };

function px(value: string): number | null {
  const v = value.trim();
  if (!v || v === "auto") {
    return null;
  }
  if (v.endsWith("%")) {
    return null;
  }
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function isTransparentColor(value: string): boolean {
  const parsed = cssColorToFigmaColor(value);
  return !parsed || parsed.opacity <= 0.001 || parsed.color.a <= 0.001;
}

function hasActiveMask(style: CSSStyleDeclaration): boolean {
  const mask =
    style.maskImage ||
    style.getPropertyValue("mask-image") ||
    style.getPropertyValue("-webkit-mask-image");
  return Boolean(mask && mask !== "none" && mask.trim() !== "");
}

function contentIsDecorativeEmpty(content: string): boolean {
  const c = content.trim();
  // CSSOM serializes empty content as "" or ''.
  if (c === '""' || c === "''") {
    return true;
  }
  // Quoted whitespace-only still counts as an empty decorative box.
  if (
    (c.startsWith('"') && c.endsWith('"')) ||
    (c.startsWith("'") && c.endsWith("'"))
  ) {
    return c.slice(1, -1).trim().length === 0;
  }
  return false;
}

function contentIsNone(content: string): boolean {
  const c = content.trim().toLowerCase();
  return !c || c === "none" || c === "normal";
}

function hasPaintableInk(style: CSSStyleDeclaration): boolean {
  if (!isTransparentColor(style.backgroundColor)) {
    return true;
  }
  if (style.backgroundImage && style.backgroundImage !== "none") {
    return true;
  }
  const widths = [
    style.borderTopWidth,
    style.borderRightWidth,
    style.borderBottomWidth,
    style.borderLeftWidth,
  ].map((w) => Number.parseFloat(w || "0") || 0);
  if (widths.some((w) => w > 0)) {
    return true;
  }
  if (style.boxShadow && style.boxShadow !== "none") {
    return true;
  }
  return false;
}

export function resolveAbsolutePseudoBox(
  style: CSSStyleDeclaration,
  hostSize: { width: number; height: number }
): Box | null {
  const top = px(style.top);
  const right = px(style.right);
  const bottom = px(style.bottom);
  const left = px(style.left);
  let width = px(style.width);
  let height = px(style.height);

  if (width === null && left !== null && right !== null) {
    width = hostSize.width - left - right;
  }
  if (height === null && top !== null && bottom !== null) {
    height = hostSize.height - top - bottom;
  }

  let x: number | null = left;
  if (x === null && width !== null && right !== null) {
    x = hostSize.width - right - width;
  }
  let y: number | null = top;
  if (y === null && height !== null && bottom !== null) {
    y = hostSize.height - bottom - height;
  }

  if (width === null && left === 0 && right === 0) {
    width = hostSize.width;
    x = 0;
  }
  if (height === null && top === 0 && bottom === 0) {
    height = hostSize.height;
    y = 0;
  }

  if (
    x === null ||
    y === null ||
    width === null ||
    height === null ||
    width < 0.5 ||
    height < 0.5
  ) {
    return null;
  }

  return { x, y, width, height };
}

function styleTransformToMatrix(
  transform: string,
  position: { x: number; y: number },
  size: { width: number; height: number }
): FigmaTransform {
  if (!transform || transform === "none") {
    return {
      m00: 1,
      m01: 0,
      m02: position.x,
      m10: 0,
      m11: 1,
      m12: position.y,
    };
  }

  let matrix: DOMMatrixReadOnly;
  try {
    matrix = new DOMMatrixReadOnly(transform);
  } catch {
    return {
      m00: 1,
      m01: 0,
      m02: position.x,
      m10: 0,
      m11: 1,
      m12: position.y,
    };
  }

  const isIdentity =
    Math.abs(matrix.a - 1) < 1e-6 &&
    Math.abs(matrix.b) < 1e-6 &&
    Math.abs(matrix.c) < 1e-6 &&
    Math.abs(matrix.d - 1) < 1e-6;
  if (isIdentity) {
    return {
      m00: 1,
      m01: 0,
      m02: position.x + matrix.e,
      m10: 0,
      m11: 1,
      m12: position.y + matrix.f,
    };
  }

  const aabbCx = position.x + size.width / 2;
  const aabbCy = position.y + size.height / 2;
  const localCx = size.width / 2;
  const localCy = size.height / 2;
  const tX = aabbCx - (matrix.a * localCx + matrix.c * localCy);
  const tY = aabbCy - (matrix.b * localCx + matrix.d * localCy);
  return {
    m00: matrix.a,
    m01: matrix.c,
    m02: tX,
    m10: matrix.b,
    m11: matrix.d,
    m12: tY,
  };
}

export function convertDecorativePseudo(
  host: Element,
  kind: PseudoKind,
  options: {
    createGuid: () => FigmaGuid;
    parentGuid: FigmaGuid;
    childIndex: number;
  }
): PseudoConvertResult {
  const view = host.ownerDocument?.defaultView ?? window;
  const style = view.getComputedStyle(host, `::${kind}`);
  const content = style.content;

  if (contentIsNone(content)) {
    return { ok: false, reason: "inactive" };
  }
  if (style.display === "none") {
    return { ok: false, reason: "display-none" };
  }
  if (style.position !== "absolute" && style.position !== "fixed") {
    return { ok: false, reason: "not-absolute" };
  }
  if (!contentIsDecorativeEmpty(content)) {
    return { ok: false, reason: "generated-text" };
  }
  if (!(hasPaintableInk(style) || hasActiveMask(style))) {
    return { ok: false, reason: "no-ink" };
  }

  const zIndex = parsePseudoZIndex(style);
  const hostRect = host.getBoundingClientRect();
  const box = resolveAbsolutePseudoBox(style, {
    width: hostRect.width,
    height: hostRect.height,
  });
  if (!box) {
    return { ok: false, reason: "unresolved-geometry" };
  }
  if (hasActiveMask(style)) {
    return { ok: false, reason: "masked", box, zIndex, style };
  }
  if (!hasPaintableInk(style)) {
    return { ok: false, reason: "no-ink" };
  }

  const width = Math.max(box.width, 0.5);
  const height = Math.max(box.height, 0.5);
  const position = { x: box.x, y: box.y };

  const backgroundColor = cssColorToFigmaColor(style.backgroundColor);
  const backgroundImage = style.backgroundImage;
  const fillPaints: Array<FigmaPaint> = [];
  if (backgroundColor) {
    fillPaints.push(
      createSolidPaint(backgroundColor.color, backgroundColor.opacity)
    );
  }
  if (backgroundImage && backgroundImage !== "none") {
    fillPaints.push(
      ...cssBackgroundToFigmaPaints(backgroundImage, {
        width,
        height,
      })
    );
  }

  const borderProperties = parseBorderFromComputedStyle(style, {
    width,
    height,
  });
  const shadowEffects = cssBoxShadowToFigmaEffects(style.boxShadow);
  const opacity = parseOpacity(style.opacity);

  if (fillPaints.length === 0 && shadowEffects.length > 0) {
    fillPaints.push(createSolidPaint({ r: 1, g: 1, b: 1, a: 0.01 }, 0.01));
  }

  const hostName = host.tagName.toLowerCase();
  // Allocate only after eligibility so inactive pseudos do not burn localIDs.
  const guid = options.createGuid();

  const nodeChange: FigmaFrameNodeChange = {
    guid,
    phase: "CREATED",
    parentIndex: {
      guid: options.parentGuid,
      position: options.childIndex.toString(),
    },
    type: "FRAME",
    name: `${hostName}::${kind}`,
    visible: true,
    opacity,
    frameMaskDisabled: true,
    size: { x: width, y: height },
    transform: styleTransformToMatrix(style.transform, position, {
      width,
      height,
    }),
    stackMode: "NONE",
    fillPaints,
    strokeAlign: "INSIDE",
    strokeJoin: "MITER",
    ...borderProperties,
    effects: shadowEffects,
    stackHorizontalPadding: 0,
    stackVerticalPadding: 0,
    stackPaddingRight: 0,
    stackPaddingBottom: 0,
    stackPositioning: "ABSOLUTE",
  };

  return { ok: true, nodeChange, zIndex };
}
