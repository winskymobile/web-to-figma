import type { FigmaColor, FigmaPaint, FigmaTransform } from "../types";
import { cssColorToFigmaColor } from "./color";

type GradientStop = {
  color: FigmaColor;
  position: number;
};

export type GradientBoxSize = {
  width: number;
  height: number;
};

/**
 * Split a CSS function argument list on top-level commas only
 * (ignores commas inside nested parentheses).
 */
function splitTopLevel(args: string): Array<string> {
  const parts: Array<string> = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    } else if (ch === "," && depth === 0) {
      parts.push(args.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = args.slice(start).trim();
  if (tail) {
    parts.push(tail);
  }
  return parts.filter(Boolean);
}

/**
 * Extract the innermost balanced content of the first `fnName(...)` occurrence.
 */
function extractFunctionArgs(source: string, fnName: string): string | null {
  const needle = `${fnName}(`;
  const start = source.toLowerCase().indexOf(needle.toLowerCase());
  if (start === -1) {
    return null;
  }
  let depth = 0;
  const openAt = start + needle.length - 1;
  for (let i = openAt; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openAt + 1, i).trim();
      }
    }
  }
  return null;
}

function isAngleToken(token: string): boolean {
  const t = token.trim().toLowerCase();
  return (
    t.startsWith("to ") ||
    t.endsWith("deg") ||
    t.endsWith("rad") ||
    t.endsWith("grad") ||
    t.endsWith("turn")
  );
}

function isPositionToken(token: string): boolean {
  const t = token.trim();
  if (!t) {
    return false;
  }
  if (t.endsWith("%")) {
    return !Number.isNaN(Number.parseFloat(t));
  }
  if (t.endsWith("px") || t.endsWith("em") || t.endsWith("rem")) {
    return !Number.isNaN(Number.parseFloat(t));
  }
  if (/^-?[\d.]+$/.test(t)) {
    return true;
  }
  return false;
}

/**
 * CSS gradient line length for a rectangular box (CSS Images Level 3).
 * θ: 0deg = up, clockwise. In y-down: direction (sin θ, −cos θ).
 * Length = |w·sin θ| + |h·cos θ|.
 */
export function cssGradientLineLength(
  cssAngleDegrees: number,
  box: GradientBoxSize
): number {
  const w = Math.max(box.width, 0);
  const h = Math.max(box.height, 0);
  const rad = (cssAngleDegrees * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const len = Math.abs(w * sin) + Math.abs(h * cos);
  return Math.max(len, 1e-6);
}

/**
 * Parse a gradient stop. Supports modern colors with internal spaces.
 * Length positions require `lineLength` (from box + angle); otherwise fall back
 * to even spacing by index.
 */
function parseGradientStop(
  stopString: string,
  index: number,
  totalStops: number,
  lineLength: number | null
): GradientStop | null {
  const trimmed = stopString.trim();
  if (!trimmed) {
    return null;
  }

  let colorString = trimmed;
  let position: number | null = null;

  let depth = 0;
  let lastSpace = -1;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    } else if (ch === " " && depth === 0) {
      lastSpace = i;
    }
  }

  if (lastSpace !== -1) {
    const maybePos = trimmed.slice(lastSpace + 1).trim();
    if (isPositionToken(maybePos)) {
      colorString = trimmed.slice(0, lastSpace).trim();
      if (maybePos.endsWith("%")) {
        position = Number.parseFloat(maybePos) / 100;
      } else if (
        maybePos.endsWith("px") ||
        maybePos.endsWith("em") ||
        maybePos.endsWith("rem")
      ) {
        const px = Number.parseFloat(maybePos);
        if (lineLength !== null && lineLength > 0 && Number.isFinite(px)) {
          position = px / lineLength;
        } else {
          position = null;
        }
      } else {
        const n = Number.parseFloat(maybePos);
        position = n > 1 ? n / 100 : n;
      }
    }
  }

  if (position === null || Number.isNaN(position)) {
    position = totalStops <= 1 ? 0 : index / (totalStops - 1);
  }
  position = Math.max(0, Math.min(1, position));

  try {
    const result = cssColorToFigmaColor(colorString);
    const color: FigmaColor = result
      ? {
          r: result.color.r,
          g: result.color.g,
          b: result.color.b,
          a: result.opacity,
        }
      : { r: 0, g: 0, b: 0, a: 0 };

    return { color, position };
  } catch {
    return null;
  }
}

/**
 * CSS linear-gradient angles: 0deg = up, clockwise positive.
 */
function parseLinearGradientAngle(angleString: string): number {
  const trimmedAngleString = angleString.trim().toLowerCase();

  if (trimmedAngleString.startsWith("to ")) {
    const direction = trimmedAngleString.slice(3).trim().replace(/\s+/g, " ");
    const parts = new Set(direction.split(" "));
    const has = (s: string) => parts.has(s);
    if (has("top") && has("right")) {
      return 45;
    }
    if (has("bottom") && has("right")) {
      return 135;
    }
    if (has("bottom") && has("left")) {
      return 225;
    }
    if (has("top") && has("left")) {
      return 315;
    }
    if (has("top")) {
      return 0;
    }
    if (has("right")) {
      return 90;
    }
    if (has("bottom")) {
      return 180;
    }
    if (has("left")) {
      return 270;
    }
    return 180;
  }

  if (trimmedAngleString.endsWith("deg")) {
    return Number.parseFloat(trimmedAngleString);
  }
  if (trimmedAngleString.endsWith("rad")) {
    return Number.parseFloat(trimmedAngleString) * (180 / Math.PI);
  }
  if (trimmedAngleString.endsWith("grad")) {
    return Number.parseFloat(trimmedAngleString) * 0.9;
  }
  if (trimmedAngleString.endsWith("turn")) {
    return Number.parseFloat(trimmedAngleString) * 360;
  }

  return 180;
}

/**
 * Centered unit-box rotation (legacy / no box size).
 * Figma default LTR; CSS 90° → identity rotation of that base.
 */
function calculateCenteredGradientTransform(
  cssAngleDegrees: number
): FigmaTransform {
  const radians = ((cssAngleDegrees - 90) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    m00: cos,
    m01: sin,
    m02: 0.5 - 0.5 * cos - 0.5 * sin,
    m10: -sin,
    m11: cos,
    m12: 0.5 + 0.5 * sin - 0.5 * cos,
  };
}

/**
 * Covering-line transform: map unit (0,0)→(1,0) onto the CSS gradient line
 * segment across the box, in normalized layer coordinates.
 */
export function calculateCoveringGradientTransform(
  cssAngleDegrees: number,
  box: GradientBoxSize
): FigmaTransform {
  const w = Math.max(box.width, 1e-6);
  const h = Math.max(box.height, 1e-6);
  const rad = (cssAngleDegrees * Math.PI) / 180;
  // y-down unit direction for CSS angle
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const lineLen = Math.abs(w * dx) + Math.abs(h * dy);
  const L = Math.max(lineLen, 1e-6);
  const ux = dx;
  const uy = dy;

  const cx = w / 2;
  const cy = h / 2;
  const startX = cx - ux * (L / 2);
  const startY = cy - uy * (L / 2);
  const endX = cx + ux * (L / 2);
  const endY = cy + uy * (L / 2);

  const sx = startX / w;
  const sy = startY / h;
  const ex = endX / w;
  const ey = endY / h;

  const m00 = ex - sx;
  const m10 = ey - sy;
  // Orthogonal in normalized space (rotate 90° CCW of the main vector).
  const m01 = -m10;
  const m11 = m00;

  return {
    m00,
    m01,
    m02: sx,
    m10,
    m11,
    m12: sy,
  };
}

function calculateGradientTransform(
  cssAngleDegrees: number,
  box: GradientBoxSize | null
): FigmaTransform {
  if (
    box &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  ) {
    return calculateCoveringGradientTransform(cssAngleDegrees, box);
  }
  return calculateCenteredGradientTransform(cssAngleDegrees);
}

function normalizeStops(stops: Array<GradientStop>): Array<GradientStop> {
  if (stops.length === 0) {
    return stops;
  }

  const out = stops.map((s) => ({ ...s, color: { ...s.color } }));
  for (let i = 1; i < out.length; i += 1) {
    const prev = out[i - 1];
    const cur = out[i];
    if (prev && cur && cur.position < prev.position) {
      cur.position = prev.position;
    }
  }

  const visible = out.filter((s) => s.color.a > 0);
  if (visible.length > 0) {
    const firstVisible = visible[0]?.color;
    for (let i = 0; i < out.length; i += 1) {
      const stop = out[i];
      if (!stop) {
        continue;
      }
      if (
        stop.color.a === 0 &&
        stop.color.r === 0 &&
        stop.color.g === 0 &&
        stop.color.b === 0
      ) {
        let ref = firstVisible;
        for (let j = i - 1; j >= 0; j -= 1) {
          const prev = out[j];
          if (prev && prev.color.a > 0) {
            ref = prev.color;
            break;
          }
        }
        if (ref === firstVisible) {
          for (let j = i + 1; j < out.length; j += 1) {
            const next = out[j];
            if (next && next.color.a > 0) {
              ref = next.color;
              break;
            }
          }
        }
        if (ref) {
          stop.color = { r: ref.r, g: ref.g, b: ref.b, a: 0 };
        }
      }
    }
  }

  return out;
}

function parseLinearGradient(
  cssGradient: string,
  box: GradientBoxSize | null
): FigmaPaint | null {
  const content =
    extractFunctionArgs(cssGradient, "linear-gradient") ??
    extractFunctionArgs(cssGradient, "repeating-linear-gradient");
  if (!content) {
    return null;
  }

  const parts = splitTopLevel(content);
  if (parts.length === 0) {
    return null;
  }

  let angle = 180;
  let colorStops = parts;

  if (parts[0] && isAngleToken(parts[0])) {
    angle = parseLinearGradientAngle(parts[0]);
    colorStops = parts.slice(1);
  }

  const lineLength =
    box && box.width > 0 && box.height > 0
      ? cssGradientLineLength(angle, box)
      : null;

  const stops: Array<GradientStop> = [];
  for (let i = 0; i < colorStops.length; i += 1) {
    const stopString = colorStops[i];
    if (!stopString) {
      continue;
    }
    const stop = parseGradientStop(
      stopString,
      i,
      colorStops.length,
      lineLength
    );
    if (stop) {
      stops.push(stop);
    }
  }

  if (stops.length < 2) {
    return null;
  }

  const normalized = normalizeStops(stops);

  return {
    type: "GRADIENT_LINEAR",
    stops: normalized,
    opacity: 1,
    visible: true,
    blendMode: "NORMAL",
    transform: calculateGradientTransform(angle, box),
  };
}

/**
 * Parse radial-gradient into a Figma radial paint when possible.
 * Position/shape keywords are simplified (circle/ellipse at center).
 */
function parseRadialGradient(cssGradient: string): FigmaPaint | null {
  const content =
    extractFunctionArgs(cssGradient, "radial-gradient") ??
    extractFunctionArgs(cssGradient, "repeating-radial-gradient");
  if (!content) {
    return null;
  }

  const parts = splitTopLevel(content);
  if (parts.length === 0) {
    return null;
  }

  let colorStops = parts;
  const first = parts[0]?.trim().toLowerCase() ?? "";
  if (
    first.startsWith("circle") ||
    first.startsWith("ellipse") ||
    first.startsWith("closest-") ||
    first.startsWith("farthest-") ||
    first.startsWith("at ") ||
    first.includes(" at ")
  ) {
    colorStops = parts.slice(1);
  }

  const stops: Array<GradientStop> = [];
  for (let i = 0; i < colorStops.length; i += 1) {
    const stopString = colorStops[i];
    if (!stopString) {
      continue;
    }
    const stop = parseGradientStop(stopString, i, colorStops.length, null);
    if (stop) {
      stops.push(stop);
    }
  }
  if (stops.length < 2) {
    return null;
  }

  const transform: FigmaTransform = {
    m00: 1,
    m01: 0,
    m02: 0,
    m10: 0,
    m11: 1,
    m12: 0,
  };

  return {
    type: "GRADIENT_RADIAL",
    stops: normalizeStops(stops),
    opacity: 1,
    visible: true,
    blendMode: "NORMAL",
    transform,
  };
}

function splitBackgroundLayers(cssBackground: string): Array<string> {
  return splitTopLevel(cssBackground);
}

/**
 * Converts a CSS background / background-image value to Figma paints.
 * Optional `box` enables length stop normalization and covering-line transforms.
 */
export function cssBackgroundToFigmaPaints(
  cssBackground: string,
  box?: GradientBoxSize | null
): Array<FigmaPaint> {
  if (!cssBackground || cssBackground === "none") {
    return [];
  }

  const size =
    box && box.width > 0 && box.height > 0
      ? { width: box.width, height: box.height }
      : null;

  const layers = splitBackgroundLayers(cssBackground);
  const paints: Array<FigmaPaint> = [];

  for (const layer of layers) {
    const lower = layer.toLowerCase();
    if (lower.includes("linear-gradient")) {
      const paint = parseLinearGradient(layer, size);
      if (paint) {
        paints.push(paint);
      }
    } else if (lower.includes("radial-gradient")) {
      const paint = parseRadialGradient(layer);
      if (paint) {
        paints.push(paint);
      }
    }
  }

  // CSS: first layer is on top. Figma: last fill is on top.
  return paints.reverse();
}
