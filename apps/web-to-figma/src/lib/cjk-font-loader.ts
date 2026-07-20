import type { FontFile, FontLoader, FontProperties } from "@figit/dom-to-figma";
import { createFontsourceLoader } from "@figit/dom-to-figma";
import { getFullInterFaceUrl, resolveSharedFontWeight } from "./inter-font";

/**
 * Prefer Noto Sans SC for CJK text so glyphs/metrics match preparePreviewFonts.
 * When the converter explicitly requests a latin face (e.g. Inter for arrows /
 * checkmarks missing from the SC subset), load the version-pinned full Inter
 * static face rather than a unicode-range Fontsource subset.
 */

const CJK_FAMILY = "Noto Sans SC";
const CJK_SUBSET = "chinese-simplified";

const LATIN_FAMILIES = new Set(
  ["inter", "roboto", "open sans", "noto sans", "arial", "helvetica"].map((s) =>
    s.toLowerCase()
  )
);

function isSystemFontKeyword(familyKey: string): boolean {
  return (
    familyKey === "-apple-system" ||
    familyKey === "system-ui" ||
    familyKey === "blinkmacsystemfont" ||
    familyKey === "segoe ui" ||
    familyKey === "ui-sans-serif" ||
    familyKey === "ui-serif" ||
    familyKey === "ui-monospace" ||
    familyKey === "sans-serif" ||
    familyKey === "serif" ||
    familyKey === "monospace" ||
    familyKey.startsWith("pingfang") ||
    familyKey.startsWith("hiragino") ||
    familyKey.includes("yahei") ||
    familyKey === "simhei" ||
    familyKey === "simsun"
  );
}

export function createCjkAwareFontLoader(): FontLoader {
  const cjkLoader = createFontsourceLoader({
    subset: CJK_SUBSET,
    fallbackFamily: null,
  });
  const latinLoader = createFontsourceLoader({
    subset: "latin",
    fallbackFamily: "Inter",
  });

  return async (request: FontProperties): Promise<FontFile> => {
    const weight = resolveSharedFontWeight(request.weight);
    const familyKey = request.family.trim().toLowerCase();
    // System stacks never have embeddable files — always use CJK/Inter fallbacks.
    const wantLatin =
      !isSystemFontKeyword(familyKey) &&
      (familyKey === "inter" ||
        LATIN_FAMILIES.has(familyKey) ||
        familyKey.includes("inter"));

    if (wantLatin) {
      if (familyKey.includes("inter")) {
        const file = await loadFullInter(weight, request.italic);
        return {
          ...file,
          // Always label bare "Inter"; weight is only in style via loader.
          resolvedFamily: "Inter",
        };
      }
      const file = await latinLoader({
        family: request.family,
        weight,
        italic: request.italic,
      });
      return {
        ...file,
        resolvedWeight: weight,
        resolvedFamily: "Inter",
      };
    }

    try {
      const file = await cjkLoader({
        family: CJK_FAMILY,
        weight,
        italic: false,
      });
      return {
        bytes: file.bytes,
        resolvedWeight: weight,
        resolvedItalic: false,
        // Always expose the station CJK family so Figma fontName stays
        // "Noto Sans SC" even when the OT name table differs slightly.
        resolvedFamily: CJK_FAMILY,
      };
    } catch {
      const file = await loadFullInter(weight, request.italic);
      return {
        ...file,
        resolvedFamily: "Inter",
      };
    }
  };
}

async function loadFullInter(
  requestedWeight: number,
  italic: boolean
): Promise<FontFile> {
  const resolvedWeight = resolveSharedFontWeight(requestedWeight);
  const url = getFullInterFaceUrl(resolvedWeight, italic);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Full Inter fetch failed (${response.status})`);
  }
  return {
    bytes: await response.arrayBuffer(),
    resolvedWeight,
    resolvedItalic: italic,
  };
}
