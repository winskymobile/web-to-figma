import Color from "colorjs.io";

import type { FigmaColor, FigmaPaint } from "../types";

export const TRANSPARENT_COLOR_VALUES = [
  "none",
  "transparent",
  "rgba(0, 0, 0, 0)",
  "rgba(0,0,0,0)",
  "rgb(0, 0, 0, 0)",
  "hsla(0, 0%, 0%, 0)",
  "hsl(0, 0%, 0%, 0)",
];

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}

/**
 * Convert any CSS color (including oklch / lab / color()) to Figma sRGB 0–1.
 * Fully transparent named values return null; zero-alpha functional colors
 * still return RGB channels with opacity 0 (needed for gradient stops).
 */
export function cssColorToFigmaColor(cssColor: string): {
  color: FigmaColor;
  opacity: number;
} | null {
  const raw = cssColor.trim();
  if (!raw) {
    return null;
  }

  if (TRANSPARENT_COLOR_VALUES.includes(raw.toLowerCase())) {
    return null;
  }

  try {
    const color = new Color(raw);
    const srgb = color.to("srgb");
    const r = clamp01(srgb.coords[0] ?? 0);
    const g = clamp01(srgb.coords[1] ?? 0);
    const b = clamp01(srgb.coords[2] ?? 0);
    const alpha = clamp01(Number(srgb.alpha ?? color.alpha ?? 1));

    return {
      color: { r, g, b, a: 1 },
      opacity: alpha,
    };
  } catch {
    return null;
  }
}

export function createSolidPaint(color: FigmaColor, opacity = 1): FigmaPaint {
  return {
    type: "SOLID",
    color,
    visible: true,
    opacity: clamp01(opacity),
    blendMode: "NORMAL",
  };
}
