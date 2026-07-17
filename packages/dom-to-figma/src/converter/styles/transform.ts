import type { Position } from "../dom";
import type { FigmaTransform } from "../types";

/**
 * Parse CSS transform into a 2D Figma node matrix.
 *
 * Figma node transform is:
 *   | m00 m01 m02 |     | a c e |
 *   | m10 m11 m12 |  =  | b d f |
 * with translation (m02, m12) as the unrotated top-left of the node.
 *
 * CSS `getBoundingClientRect` returns the post-transform AABB; default
 * transform-origin is center. We use the browser matrix for rotation/scale
 * and place the unrotated origin so the transformed center matches the AABB.
 */
export function cssTransformToFigmaMatrix(
  element: Element,
  position: Position,
  aabbSize: { width: number; height: number }
): FigmaTransform {
  const style = window.getComputedStyle(element);
  const transform = style.transform;

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

  const view = element.ownerDocument?.defaultView ?? window;
  let matrix: DOMMatrixReadOnly;
  try {
    matrix = new view.DOMMatrixReadOnly(transform);
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

  // Identity (or pure translate already in position) → keep simple placement
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

  // Prefer pre-transform layout box for node size/origin when available
  let layoutW =
    element instanceof HTMLElement && element.offsetWidth > 0
      ? element.offsetWidth
      : aabbSize.width;
  let layoutH =
    element instanceof HTMLElement && element.offsetHeight > 0
      ? element.offsetHeight
      : aabbSize.height;

  if (
    element instanceof HTMLElement &&
    (element.offsetWidth <= 0 || element.offsetHeight <= 0)
  ) {
    const scaleX = Math.hypot(matrix.a, matrix.b) || 1;
    const scaleY = Math.hypot(matrix.c, matrix.d) || 1;
    if (scaleX > 1e-6 && scaleY > 1e-6) {
      layoutW = aabbSize.width / scaleX;
      layoutH = aabbSize.height / scaleY;
    }
  }

  // AABB center in parent space
  const aabbCx = position.x + aabbSize.width / 2;
  const aabbCy = position.y + aabbSize.height / 2;

  // Unrotated top-left such that the transformed layout-box center matches AABB center.
  // For rotation about local origin (ox, oy):
  //   center_local = (layoutW/2, layoutH/2)
  //   transformed center = M * (center - origin) + origin + T
  // We absorb CSS translate into matching centers via top-left placement.
  // Place unrotated top-left so the layout-box center maps to the AABB center
  // under Figma's p' = L*p + T (linear part about top-left).
  const localCx = layoutW / 2;
  const localCy = layoutH / 2;
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

/**
 * Untransformed layout size for Figma node box (prefer offsetWidth/Height).
 * Falls back to AABB when layout size is unavailable.
 */
export function getLayoutSize(
  element: Element,
  aabb: { width: number; height: number }
): { width: number; height: number } {
  const style = window.getComputedStyle(element);
  const hasTransform = style.transform && style.transform !== "none";
  if (!hasTransform) {
    return { width: aabb.width, height: aabb.height };
  }

  if (
    element instanceof HTMLElement &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  ) {
    return { width: element.offsetWidth, height: element.offsetHeight };
  }

  try {
    const matrix = new DOMMatrixReadOnly(style.transform);
    const scaleX = Math.hypot(matrix.a, matrix.b) || 1;
    const scaleY = Math.hypot(matrix.c, matrix.d) || 1;
    if (scaleX > 1e-6 && scaleY > 1e-6) {
      return {
        width: aabb.width / scaleX,
        height: aabb.height / scaleY,
      };
    }
  } catch {
    // ignore
  }
  return { width: aabb.width, height: aabb.height };
}
