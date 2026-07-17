import type { FigmaColor, FigmaPaint, FigmaTransform } from "../types";
import { cssColorToFigmaColor } from "./color";

type GradientStop = {
  color: FigmaColor;
  position: number;
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
  // bare 0..1 or 0..100 number without color keywords
  if (/^-?[\d.]+$/.test(t)) {
    return true;
  }
  return false;
}

/**
 * Parse a gradient stop. Supports modern colors with internal spaces:
 * `oklch(0.7 0.1 30) 50%`, `rgba(255, 0, 0, 0.5) 0.25`.
 */
function parseGradientStop(
  stopString: string,
  index: number,
  totalStops: number
): GradientStop | null {
  const trimmed = stopString.trim();
  if (!trimmed) {
    return null;
  }

  // Walk from the end: last top-level token may be a position.
  let colorString = trimmed;
  let position: number | null = null;

  // Find last space outside parentheses
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
        // Length positions need the gradient line length; fall back to even spacing.
        position = null;
      } else {
        const n = Number.parseFloat(maybePos);
        // CSS allows 0-1 or sometimes 0-100 without unit in computed styles rarely
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
 * Keywords `to <side-or-corner>` convert to the opposite of the destination
 * (gradient line points toward the keyword direction).
 */
function parseLinearGradientAngle(angleString: string): number {
  const trimmedAngleString = angleString.trim().toLowerCase();

  if (trimmedAngleString.startsWith("to ")) {
    const direction = trimmedAngleString.slice(3).trim().replace(/\s+/g, " ");
    // Normalize corner order variants: "right top" → "top right"
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
 * Map a CSS linear-gradient angle to Figma's gradient transform.
 *
 * Figma's default GRADIENT_LINEAR runs left → right in unit space (CSS 90deg).
 * CSS 0deg points up and increases clockwise.
 *
 * Matrix maps the unit gradient vector onto the node; translation keeps the
 * gradient centered on the layer.
 */
function calculateGradientTransform(cssAngleDegrees: number): FigmaTransform {
  // Convert CSS angle to math angle for a left→right base:
  // CSS 90° (right) → 0 rad rotation of the LTR base.
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

function normalizeStops(stops: Array<GradientStop>): Array<GradientStop> {
  if (stops.length === 0) {
    return stops;
  }

  // Ensure monotonic positions (CSS allows missing positions).
  const out = stops.map((s) => ({ ...s, color: { ...s.color } }));
  for (let i = 1; i < out.length; i += 1) {
    const prev = out[i - 1];
    const cur = out[i];
    if (prev && cur && cur.position < prev.position) {
      cur.position = prev.position;
    }
  }

  // Transparent black stops often come from `transparent` — borrow RGB from
  // the nearest visible neighbor so Figma interpolates alpha only.
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
        // Prefer previous visible, else next, else first visible.
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

function parseLinearGradient(cssGradient: string): FigmaPaint | null {
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

  const stops: Array<GradientStop> = [];
  for (let i = 0; i < colorStops.length; i += 1) {
    const stopString = colorStops[i];
    if (!stopString) {
      continue;
    }
    const stop = parseGradientStop(stopString, i, colorStops.length);
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
    transform: calculateGradientTransform(angle),
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
  // First arg may be shape/size/position, not a color stop.
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
    const stop = parseGradientStop(stopString, i, colorStops.length);
    if (stop) {
      stops.push(stop);
    }
  }
  if (stops.length < 2) {
    return null;
  }

  // Default Figma radial covers the unit box from center.
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

/**
 * Split a background-image list into individual layers (top-level commas).
 */
function splitBackgroundLayers(cssBackground: string): Array<string> {
  return splitTopLevel(cssBackground);
}

/**
 * Converts a CSS background / background-image value to Figma paints.
 * Handles one or more linear/radial gradients (first paint = topmost layer
 * when multiple are present — Figma paints draw first item on top when
 * listed last? Figma fillPaints: first is bottom. CSS backgrounds: first is
 * top. So reverse so visual order matches.)
 */
export function cssBackgroundToFigmaPaints(
  cssBackground: string
): Array<FigmaPaint> {
  if (!cssBackground || cssBackground === "none") {
    return [];
  }

  const layers = splitBackgroundLayers(cssBackground);
  const paints: Array<FigmaPaint> = [];

  for (const layer of layers) {
    const lower = layer.toLowerCase();
    if (lower.includes("linear-gradient")) {
      const paint = parseLinearGradient(layer);
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
  // Reverse so the first CSS gradient is the topmost Figma fill.
  return paints.reverse();
}
