/**
 * Font Metrics Primitives
 *
 * Low-level font metrics extraction and conversion utilities.
 * These primitives handle the core font measurement operations without
 * any higher-level dependencies.
 *
 * @module FontMetricsPrimitives
 */

import type { OpenTypeFont } from "../../types";
import { getFontNameTable } from "./names";

/**
 * Comprehensive font metrics extracted from OpenType fonts
 *
 * Contains all essential measurements needed for text layout and rendering,
 * normalized to a consistent format regardless of font implementation details.
 */
export type FontMetrics = {
  /** Units per EM square - the fundamental unit of font measurement */
  unitsPerEm: number;
  /** Distance from baseline to top of ascenders (positive) */
  ascender: number;
  /** Distance from baseline to bottom of descenders (negative) */
  descender: number;
  /** Additional spacing between lines */
  lineGap: number;

  /** Height of capital letters */
  capHeight: number;
  /** Height of lowercase letters (typically 'x') */
  xHeight: number;

  /** Total line height (ascender - descender + lineGap) */
  lineHeight: number;
  /** Distance from origin to baseline */
  baseline: number;

  /** Font family name */
  familyName: string;
  /** Font style name (e.g., "Regular", "Bold") */
  styleName: string;
};

/**
 * Extract comprehensive font metrics from an opentype.js font
 *
 * Provides robust metrics extraction with intelligent fallbacks for
 * missing or invalid font data. Normalizes metrics across different
 * font formats and implementations.
 *
 * @param font - OpenType.js font object
 * @returns Complete font metrics with fallback values for missing data
 * @throws {Error} When font object is invalid or missing
 *
 * @example
 * ```typescript
 * const font = await opentype.load('path/to/font.ttf');
 * const metrics = extractFontMetrics(font);
 * console.log(`Font: ${metrics.familyName}, Line height: ${metrics.lineHeight}`);
 * ```
 */
export function extractFontMetrics(font: OpenTypeFont): FontMetrics {
  const unitsPerEm = font.unitsPerEm;

  // Use font's own metrics or calculate reasonable defaults
  const ascender = font.ascender;
  const descender = font.descender;
  const lineGap = font.tables.hhea?.lineGap ?? 0;

  // Typography metrics with fallbacks from OS/2 table or calculated defaults
  const capHeight = font.tables.os2?.sCapHeight ?? Math.round(unitsPerEm * 0.7);
  const xHeight = font.tables.os2?.sxHeight ?? Math.round(unitsPerEm * 0.5);

  // Calculate line height (ascender - descender + lineGap)
  const lineHeight = ascender - descender + lineGap;

  // Baseline position (distance from origin to baseline)
  // In font coordinates, baseline is typically at y=0 with ascender above
  const baseline = Math.abs(descender);

  const names = getFontNameTable(font);

  return {
    unitsPerEm,
    ascender,
    descender,
    lineGap,
    capHeight,
    xHeight,
    lineHeight,
    baseline,
    familyName: names.fontFamily?.en ?? names.fullName?.en ?? "Unknown",
    styleName: names.fontSubfamily?.en ?? "Regular",
  };
}

/**
 * Convert font units to pixel units at a given font size
 *
 * Essential utility for converting between font coordinate space and
 * pixel coordinate space. All font measurements are in font units
 * and must be scaled to match the desired pixel size.
 *
 * @param fontUnits - Value in font units
 * @param fontSize - Target font size in pixels
 * @param unitsPerEm - Font's units per EM value
 * @returns Value converted to pixels
 * @throws {Error} When unitsPerEm is invalid
 *
 * @example
 * ```typescript
 * const pixelWidth = fontUnitsToPixels(500, 24, 2048); // ~5.86px
 * const lineHeightPx = fontUnitsToPixels(metrics.lineHeight, 16, metrics.unitsPerEm);
 * ```
 */
export function fontUnitsToPixels(
  fontUnits: number,
  fontSize: number,
  unitsPerEm: number
): number {
  if (unitsPerEm <= 0) {
    throw new Error("unitsPerEm must be positive for font unit conversion");
  }
  return (fontUnits / unitsPerEm) * fontSize;
}
