/**
 * Kerning Processing Primitives
 *
 * Comprehensive kerning system for OpenType fonts.
 * Handles both legacy kern table and modern GPOS table kerning.
 *
 * @module KerningPrimitives
 */

import { fontUnitsToPixels } from "../../primitives/font/metrics";

import type { FontMetrics, OpenTypeFont, OpenTypeGlyph } from "../../types";

// GPOS Table Types
type GPOSFeature = {
  tag: string;
  feature: {
    lookupListIndexes: Array<number>;
  };
};

type GPOSLookup = {
  lookupType: number;
  subtables: Array<GPOSSubtable>;
};

type GPOSSubtable = {
  posFormat?: number;
  format?: number;
  coverage?: {
    glyphs: Array<number>;
  };
  pairSets?: Array<GPOSPairSet>;
  classDef1?: GPOSClassDef;
  classDef2?: GPOSClassDef;
  ClassDef1?: GPOSClassDef;
  ClassDef2?: GPOSClassDef;
  classRecords?: Array<GPOSClassRecord>;
  Class1Record?: Array<GPOSClassRecord>;
};

type GPOSPairSet = Array<GPOSPairRecord>;

type GPOSPairRecord = {
  secondGlyph: number;
  value1?: {
    xAdvance?: number;
  };
  firstGlyph?: {
    xAdvance?: number;
  };
};

type GPOSClassRecord = {
  Class2Record?: Array<GPOSClass2Record>;
  [key: number]: GPOSClass2Record | Array<GPOSClass2Record> | undefined;
};

type GPOSClass2Record = {
  Value1?: {
    XAdvance?: number;
    xAdvance?: number;
  };
  value1?: {
    xAdvance?: number;
  };
  xAdvance?: number;
};

type GPOSClassDef = {
  format?: number;
  startGlyph?: number;
  endGlyph?: number;
  classes?: Array<number>;
  ranges?: Array<{
    start: number;
    end: number;
    classId: number;
  }>;
  classDefs?: Record<string, number>;
};

type GPOSTable = {
  features?: Array<GPOSFeature>;
  lookups?: Array<GPOSLookup>;
};

/** Result of kerning calculation with metadata */
export type KerningResult = {
  /** Kerning value in font units */
  value: number;
  /** Kerning value scaled to pixels */
  pixelValue: number;
  /** Source of the kerning data */
  source: "legacy" | "gpos-format1" | "gpos-format2" | "none";
};

/**
 * Main kerning function - tries all available methods
 *
 * @param font - OpenType.js font object
 * @param leftGlyph - Left glyph in the pair
 * @param rightGlyph - Right glyph in the pair
 * @param metrics - Font metrics for scaling
 * @param fontSize - Font size in pixels
 * @returns Kerning adjustment in pixels
 *
 * @example
 * ```typescript
 * const kerning = getKerning(font, leftGlyph, rightGlyph, metrics, 16);
 * console.log(`Kerning adjustment: ${kerning}px`);
 * ```
 */
export function getKerning(
  font: OpenTypeFont & { tables: { gpos?: GPOSTable } },
  leftGlyph: OpenTypeGlyph,
  rightGlyph: OpenTypeGlyph,
  metrics: FontMetrics,
  fontSize: number
): number {
  try {
    // Try legacy kern table first (fastest)
    let kerningResult = getLegacyKerning(font, leftGlyph, rightGlyph);

    // If no legacy kerning, try GPOS
    if (kerningResult.value === 0 && font.tables.gpos) {
      kerningResult = getGPOSKerning(font, leftGlyph, rightGlyph);
    }

    return fontUnitsToPixels(kerningResult.value, fontSize, metrics.unitsPerEm);
  } catch {
    return 0; // Silently fail for kerning errors
  }
}

/**
 * Get kerning from legacy kern table
 *
 * @param font - OpenType.js font object
 * @param leftGlyph - Left glyph in the pair
 * @param rightGlyph - Right glyph in the pair
 * @returns Kerning result from legacy table
 *
 * @internal
 */
function getLegacyKerning(
  font: OpenTypeFont & { tables: { gpos?: GPOSTable } },
  leftGlyph: OpenTypeGlyph,
  rightGlyph: OpenTypeGlyph
): KerningResult {
  try {
    const kerningValue = font.getKerningValue(leftGlyph, rightGlyph) || 0;
    return {
      value: kerningValue,
      pixelValue: 0, // Will be calculated by caller
      source: kerningValue !== 0 ? "legacy" : "none",
    };
  } catch {
    return { value: 0, pixelValue: 0, source: "none" };
  }
}

/**
 * Get kerning from GPOS table (modern OpenType kerning)
 *
 * @param font - OpenType.js font object
 * @param leftGlyph - Left glyph in the pair
 * @param rightGlyph - Right glyph in the pair
 * @returns Kerning result from GPOS table
 *
 * @internal
 */
function getGPOSKerning(
  font: OpenTypeFont & { tables: { gpos?: GPOSTable } },
  leftGlyph: OpenTypeGlyph,
  rightGlyph: OpenTypeGlyph
): KerningResult {
  const gpos = font.tables.gpos;
  if (!gpos?.lookups) {
    return { value: 0, pixelValue: 0, source: "none" };
  }

  // Look for kern feature in GPOS
  const kernFeature = gpos.features?.find((f) => f.tag === "kern");
  if (!kernFeature) {
    return { value: 0, pixelValue: 0, source: "none" };
  }

  // Try each lookup in the kern feature
  for (const lookupIndex of kernFeature.feature.lookupListIndexes) {
    const lookup = gpos.lookups[lookupIndex];
    if (!lookup || lookup.lookupType !== 2) {
      continue; // Type 2 is pair adjustment
    }

    // Try each subtable in the lookup
    for (const subtable of lookup.subtables) {
      const format = subtable.posFormat ?? subtable.format;

      if (format === 1) {
        const result = getGPOSFormat1Kerning(subtable, leftGlyph, rightGlyph);
        if (result.value !== 0) {
          return result;
        }
      } else if (format === 2) {
        const result = getGPOSFormat2Kerning(subtable, leftGlyph, rightGlyph);
        if (result.value !== 0) {
          return result;
        }
      }
    }
  }

  return { value: 0, pixelValue: 0, source: "none" };
}

/**
 * Get kerning from GPOS Format 1 (individual glyph pairs)
 */
function getGPOSFormat1Kerning(
  subtable: GPOSSubtable,
  leftGlyph: OpenTypeGlyph,
  rightGlyph: OpenTypeGlyph
): KerningResult {
  // Check if left glyph is in coverage
  if (!subtable.coverage?.glyphs) {
    return { value: 0, pixelValue: 0, source: "none" };
  }

  const coverageIndex = subtable.coverage.glyphs.indexOf(leftGlyph.index);
  if (coverageIndex === -1 || !subtable.pairSets) {
    return { value: 0, pixelValue: 0, source: "none" };
  }

  const pairSet = subtable.pairSets[coverageIndex];
  if (!pairSet) {
    return { value: 0, pixelValue: 0, source: "none" };
  }

  // Look for the right glyph in the pair set
  for (const pairRecord of pairSet) {
    if (pairRecord.secondGlyph === rightGlyph.index) {
      const xAdvance =
        pairRecord.value1?.xAdvance ?? pairRecord.firstGlyph?.xAdvance ?? 0;

      return {
        value: xAdvance,
        pixelValue: 0, // Will be calculated by caller
        source: "gpos-format1",
      };
    }
  }

  return { value: 0, pixelValue: 0, source: "none" };
}

/**
 * Get kerning from GPOS Format 2 (class-based kerning)
 */
function getGPOSFormat2Kerning(
  subtable: GPOSSubtable,
  leftGlyph: OpenTypeGlyph,
  rightGlyph: OpenTypeGlyph
): KerningResult {
  // OpenType.js uses different property names - try both structures
  const classDef1 = subtable.classDef1 ?? subtable.ClassDef1;
  const classDef2 = subtable.classDef2 ?? subtable.ClassDef2;
  const classRecords = subtable.classRecords ?? subtable.Class1Record;

  if (!(classDef1 && classDef2 && classRecords)) {
    return { value: 0, pixelValue: 0, source: "none" };
  }

  // Get glyph classes
  const leftClass = getGlyphClass(leftGlyph.index, classDef1);
  const rightClass = getGlyphClass(rightGlyph.index, classDef2);

  // Access class records - handle both formats
  let classRecord: GPOSClass2Record | undefined;
  const leftClassRecord = classRecords[leftClass];
  if (leftClassRecord) {
    if (leftClassRecord.Class2Record) {
      // OpenType.js format
      classRecord = leftClassRecord.Class2Record[rightClass];
    } else if (Array.isArray(leftClassRecord)) {
      // Array format - cast to proper type
      classRecord = (leftClassRecord as Array<GPOSClass2Record>)[rightClass];
    }
  }

  if (!classRecord) {
    return { value: 0, pixelValue: 0, source: "none" };
  }

  // Get XAdvance value - try multiple property names
  let xAdvance = 0;
  if (classRecord.Value1?.XAdvance) {
    xAdvance = classRecord.Value1.XAdvance;
  } else if (classRecord.value1?.xAdvance) {
    xAdvance = classRecord.value1.xAdvance;
  } else if (classRecord.Value1?.xAdvance) {
    xAdvance = classRecord.Value1.xAdvance;
  } else if (classRecord.xAdvance) {
    xAdvance = classRecord.xAdvance;
  }

  return {
    value: xAdvance,
    pixelValue: 0, // Will be calculated by caller
    source: "gpos-format2",
  };
}

/**
 * Get glyph class from class definition
 * Returns 0 (default class) if glyph is not explicitly assigned to a class
 */
function getGlyphClass(
  glyphIndex: number,
  classDef: GPOSClassDef | undefined
): number {
  if (!classDef) {
    return 0;
  }

  if (classDef.format === 1) {
    // Format 1: startGlyph to endGlyph range with class array
    if (
      classDef.startGlyph !== undefined &&
      classDef.endGlyph !== undefined &&
      glyphIndex >= classDef.startGlyph &&
      glyphIndex <= classDef.endGlyph
    ) {
      const classArrayIndex = glyphIndex - classDef.startGlyph;
      return classDef.classes?.[classArrayIndex] ?? 0;
    }
  } else if (classDef.format === 2) {
    // Format 2: Range records
    for (const range of classDef.ranges ?? []) {
      if (glyphIndex >= range.start && glyphIndex <= range.end) {
        return range.classId;
      }
    }
  }

  // OpenType.js format: classDefs is an object mapping glyph index (as string key) to class number
  if (classDef.classDefs && typeof classDef.classDefs === "object") {
    return classDef.classDefs[String(glyphIndex)] ?? 0;
  }

  return 0; // Default class
}
