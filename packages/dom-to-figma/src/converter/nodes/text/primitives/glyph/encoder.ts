/**
 * Glyph Encoding Primitives
 *
 * Low-level SVG path to Figma glyph byte format conversion utilities.
 * Handles the encoding of vector path data into Figma's binary glyph format.
 *
 * @module GlyphEncodingPrimitives
 */

import type { GlyphBounds, PathCommand } from "../../types";

/**
 * SVG path parsing configuration
 */
export type PathParsingOptions = {
  /** Precision for coordinate parsing (decimal places) */
  precision?: number;
  /** Whether to validate path commands */
  validate?: boolean;
};

/**
 * Glyph encoding configuration
 */
export type EncodingOptions = {
  /** Whether to normalize coordinates to 0-1 range */
  normalize?: boolean;
  /** Custom bounds for normalization (calculated if not provided) */
  bounds?: GlyphBounds;
  /** Units per EM for font coordinate conversion */
  unitsPerEm?: number;
  /** Font metrics for coordinate transformation */
  fontMetrics?: {
    ascender: number;
    descender: number;
    xHeight: number;
    capHeight: number;
  };
};

/**
 * Parse SVG path string into structured commands
 *
 * Converts an SVG path data string into an array of structured path commands
 * with proper coordinate handling and relative/absolute command processing.
 *
 * @param pathData - SVG path data string (e.g., "M10 20L30 40Z")
 * @param options - Parsing configuration options
 * @returns Array of structured path commands
 *
 * @example
 * ```typescript
 * const commands = parseSvgPath("M10 20L30 40C50 60 70 80 90 100Z");
 * console.log(commands.length); // Number of path commands
 * ```
 */
function parseSvgPath(
  pathData: string,
  options: PathParsingOptions = {}
): Array<PathCommand> {
  const { validate = true } = options;
  const commands: Array<PathCommand> = [];

  // Enhanced regex to handle path commands with their parameters
  const regex = /([CLMQZclmqz])([^CLMQZclmqz]*)/g;
  let currentX = 0;
  let currentY = 0;

  let match = regex.exec(pathData);
  while (match !== null) {
    const cmd = match[1];
    if (!cmd) {
      continue;
    }

    // Handle negative numbers that might be concatenated (e.g., "593-1490")
    // Replace minus signs preceded by digits with space+minus
    const argsString = (match[2] ?? "").trim().replace(/(\d)-/g, "$1 -");

    const args = argsString
      .split(/[\s,]+/)
      .filter((s) => s && s !== "")
      .map(Number.parseFloat)
      .filter((n) => !Number.isNaN(n));

    const isRelative = cmd === cmd.toLowerCase();
    const cmdUpper = cmd.toUpperCase();

    try {
      const command = parseCommand(
        cmdUpper,
        args,
        isRelative,
        currentX,
        currentY
      );
      if (command) {
        commands.push(command);

        // Update current position for relative commands
        if (command.type !== "Z" && command.values.length >= 2) {
          const values = command.values;
          currentX = values.at(-2) ?? currentX;
          currentY = values.at(-1) ?? currentY;
        }
      }
    } catch (error) {
      if (validate) {
        console.warn(
          `Invalid path command '${cmd}' with args [${args.join(", ")}]:`,
          error
        );
      }
    }

    match = regex.exec(pathData);
  }

  return commands;
}

/**
 * Parse individual path command with coordinate handling
 *
 * @param cmdUpper - Command type in uppercase
 * @param args - Numeric arguments for the command
 * @param isRelative - Whether the command uses relative coordinates
 * @param currentX - Current X position for relative calculations
 * @param currentY - Current Y position for relative calculations
 * @returns Parsed path command or null if invalid
 *
 * @internal
 */
function parseCommand(
  cmdUpper: string,
  args: Array<number>,
  isRelative: boolean,
  currentX: number,
  currentY: number
): PathCommand | null {
  const resolveCoordinate = (value: number, current: number): number =>
    isRelative ? value + current : value;

  switch (cmdUpper) {
    case "M": // Move to
      if (args.length >= 2) {
        const x = resolveCoordinate(args[0] ?? 0, currentX);
        const y = resolveCoordinate(args[1] ?? 0, currentY);
        return { type: "M", values: [x, y] };
      }
      break;

    case "L": // Line to
      if (args.length >= 2) {
        const x = resolveCoordinate(args[0] ?? 0, currentX);
        const y = resolveCoordinate(args[1] ?? 0, currentY);
        return { type: "L", values: [x, y] };
      }
      break;

    case "C": // Cubic Bézier curve
      if (args.length >= 6) {
        const x1 = resolveCoordinate(args[0] ?? 0, currentX);
        const y1 = resolveCoordinate(args[1] ?? 0, currentY);
        const x2 = resolveCoordinate(args[2] ?? 0, currentX);
        const y2 = resolveCoordinate(args[3] ?? 0, currentY);
        const x = resolveCoordinate(args[4] ?? 0, currentX);
        const y = resolveCoordinate(args[5] ?? 0, currentY);
        return { type: "C", values: [x1, y1, x2, y2, x, y] };
      }
      break;

    case "Q": // Quadratic Bézier curve
      if (args.length >= 4) {
        const x1 = resolveCoordinate(args[0] ?? 0, currentX);
        const y1 = resolveCoordinate(args[1] ?? 0, currentY);
        const x = resolveCoordinate(args[2] ?? 0, currentX);
        const y = resolveCoordinate(args[3] ?? 0, currentY);
        return { type: "Q", values: [x1, y1, x, y] };
      }
      break;

    case "Z": // Close path
      return { type: "Z", values: [] };

    default: {
      break;
    }
  }

  return null;
}

/**
 * Calculate bounding box of path commands
 *
 * Determines the minimum and maximum X/Y coordinates of all points
 * in the path commands to create a bounding rectangle.
 *
 * @param commands - Array of path commands
 * @returns Bounding box with min/max coordinates and dimensions
 *
 * @example
 * ```typescript
 * const bounds = calculateBounds(commands);
 * console.log(`Glyph size: ${bounds.width}x${bounds.height}`);
 * ```
 */
function calculateBounds(commands: Array<PathCommand>): GlyphBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cmd of commands) {
    const { values } = cmd;

    // Extract all x,y coordinate pairs from the command
    for (let i = 0; i < values.length; i += 2) {
      if (i + 1 < values.length) {
        const x = values[i];
        const y = values[i + 1];
        if (x !== undefined && y !== undefined) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
  }

  // Handle empty paths
  if (minX === Number.POSITIVE_INFINITY) {
    minX = maxX = minY = maxY = 0;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX || 1, // Ensure minimum width of 1
    height: maxY - minY || 1, // Ensure minimum height of 1
  };
}

/**
 * Encode path commands to Figma's binary glyph format
 *
 * Converts structured path commands into the byte array format expected
 * by Figma for glyph rendering. Includes coordinate normalization and
 * proper binary encoding of floating-point values.
 *
 * @param svgPath - SVG path data string
 * @param options - Encoding configuration
 * @returns Encoded byte array ready for blob registration
 *
 * @example
 * ```typescript
 * const bytes = encodeGlyphCommands("M10 20L30 40Z", {
 *   normalize: true,
 *   unitsPerEm: 2048
 * });
 * // Register with Figma: registerBlob({ bytes: Array.from(bytes) });
 * ```
 */
function encodeGlyphCommands(
  svgPath: string,
  options: EncodingOptions = {}
): Uint8Array {
  const { normalize = true } = options;
  const commands = parseSvgPath(svgPath);

  if (commands.length === 0) {
    return new Uint8Array([0]); // Just a close command for empty paths
  }

  // Calculate or use provided bounds
  const bounds = options.bounds ?? calculateBounds(commands);
  const bytes: Array<number> = [];

  /**
   * Write a 32-bit float in little-endian format
   */
  function writeFloat(value: number): void {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, true); // little-endian
    const uint8 = new Uint8Array(buffer);
    bytes.push(uint8[0] ?? 0, uint8[1] ?? 0, uint8[2] ?? 0, uint8[3] ?? 0);
  }

  /**
   * Normalize coordinate to 0-1 range if requested
   */
  function normalizeCoordinate(
    value: number | undefined,
    isX: boolean
  ): number {
    if (value === undefined) {
      return 0;
    }
    if (!normalize) {
      return value;
    }

    if (isX) {
      return (value - bounds.minX) / bounds.width;
    }
    // Flip Y coordinate: font coordinate system has Y=0 at baseline going negative down,
    // but screen coordinate system has Y=0 at top going positive down
    return 1 - (value - bounds.minY) / bounds.height;
  }

  // Encode each command according to Figma's format
  for (const cmd of commands) {
    const { type, values } = cmd;

    switch (type) {
      case "M": // Move to: command 1 + x,y
        bytes.push(1);
        writeFloat(normalizeCoordinate(values[0], true));
        writeFloat(normalizeCoordinate(values[1], false));
        break;

      case "L": // Line to: command 2 + x,y
        bytes.push(2);
        writeFloat(normalizeCoordinate(values[0], true));
        writeFloat(normalizeCoordinate(values[1], false));
        break;

      case "Q": // Quadratic curve: command 3 + x1,y1,x2,y2
        bytes.push(3);
        writeFloat(normalizeCoordinate(values[0], true));
        writeFloat(normalizeCoordinate(values[1], false));
        writeFloat(normalizeCoordinate(values[2], true));
        writeFloat(normalizeCoordinate(values[3], false));
        break;

      case "C": // Cubic curve: command 4 + x1,y1,x2,y2,x3,y3
        bytes.push(4);
        writeFloat(normalizeCoordinate(values[0], true));
        writeFloat(normalizeCoordinate(values[1], false));
        writeFloat(normalizeCoordinate(values[2], true));
        writeFloat(normalizeCoordinate(values[3], false));
        writeFloat(normalizeCoordinate(values[4], true));
        writeFloat(normalizeCoordinate(values[5], false));
        break;

      case "Z": // Close path: command 0
        bytes.push(0);
        break;

      default: {
        throw new Error(`Invalid command type: ${type}`);
      }
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Convert SVG path to Figma glyph bytes with font-aware processing
 *
 * High-level function that handles the complete conversion from SVG path
 * to Figma-ready glyph bytes, including proper font coordinate handling
 * and consistent normalization across all glyphs in a font.
 *
 * @param svgPath - SVG path data string
 * @param options - Font-aware encoding options
 * @returns Array of bytes ready for Figma blob registration
 *
 * @example
 * ```typescript
 * const glyphBytes = svgPathToGlyphBytes(svgPath, {
 *   unitsPerEm: 2048,
 *   fontMetrics: {
 *     ascender: 1638,
 *     descender: -410,
 *     xHeight: 1024,
 *     capHeight: 1434
 *   }
 * });
 * ```
 */
export function svgPathToGlyphBytes(
  svgPath: string,
  options: EncodingOptions = {}
): Array<number> {
  const { unitsPerEm = 2048 } = options;

  // Use consistent font-wide bounds for ALL glyphs to preserve relative sizing
  // This ensures different letters maintain their proper proportions
  const fontBounds: GlyphBounds = {
    minX: 0,
    minY: -unitsPerEm, // Bottom of the em square
    maxX: unitsPerEm, // Right side of the em square
    maxY: 0, // Top at baseline (fonts use inverted Y)
    width: unitsPerEm,
    height: unitsPerEm,
  };

  const bytes = encodeGlyphCommands(svgPath, {
    normalize: true,
    bounds: fontBounds,
    ...options,
  });

  return Array.from(bytes);
}
