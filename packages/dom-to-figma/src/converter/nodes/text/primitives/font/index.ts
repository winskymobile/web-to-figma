/**
 * Font Primitives Module
 *
 * Exports all font-related primitive operations for text processing.
 * These primitives handle font loading, metrics extraction, and property parsing
 * without dependencies on higher-level components.
 *
 * @module FontPrimitives
 */

// Core font operations
// Re-export common types for convenience
export type {
  FontProperties,
  FontProperties as ParsedFontProperties,
  LoadedFont,
} from "./loader";
export {
  extractFontMetrics,
  type FontMetrics,
} from "./metrics";
