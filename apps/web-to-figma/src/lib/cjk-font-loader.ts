import type { FontFile, FontLoader, FontProperties } from "@figit/dom-to-figma";
import { createFontsourceLoader } from "@figit/dom-to-figma";

/**
 * Prefer Noto Sans SC for CJK text so glyphs/metrics match preparePreviewFonts.
 * When the converter explicitly requests a latin face (e.g. Inter for arrows /
 * checkmarks missing from the SC subset), load that face instead of Noto.
 */

const CJK_FAMILY = "Noto Sans SC";
const CJK_SUBSET = "chinese-simplified";

const LATIN_FAMILIES = new Set(
  ["inter", "roboto", "open sans", "noto sans", "arial", "helvetica"].map((s) =>
    s.toLowerCase()
  )
);

export function createCjkAwareFontLoader(): FontLoader {
  const cjkLoader = createFontsourceLoader({
    subset: CJK_SUBSET,
    fallbackFamily: null,
  });
  const latinLoader = createFontsourceLoader({
    subset: "latin",
    fallbackFamily: "Inter",
  });

  const cache = new Map<string, Promise<FontFile>>();

  return (request: FontProperties): Promise<FontFile> => {
    const weight = snapWeight(request.weight);
    const familyKey = request.family.trim().toLowerCase();
    const wantLatin =
      familyKey === "inter" ||
      LATIN_FAMILIES.has(familyKey) ||
      familyKey.includes("inter");

    const cacheKey = `${wantLatin ? "latin" : "cjk"}:${familyKey}:${weight}:${request.italic ? 1 : 0}`;

    let pending = cache.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        if (wantLatin) {
          const file = await latinLoader({
            family: familyKey.includes("inter") ? "Inter" : request.family,
            weight,
            italic: request.italic,
          });
          return {
            ...file,
            resolvedWeight: weight,
            resolvedFamily:
              request.family.trim().toLowerCase() === "inter"
                ? undefined
                : "Inter",
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
            resolvedFamily:
              request.family.trim().toLowerCase() === CJK_FAMILY.toLowerCase()
                ? undefined
                : CJK_FAMILY,
          };
        } catch {
          const file = await latinLoader({
            family: "Inter",
            weight,
            italic: request.italic,
          });
          return {
            ...file,
            resolvedFamily: "Inter",
          };
        }
      })();
      cache.set(cacheKey, pending);
    }
    return pending;
  };
}

function snapWeight(weight: number): number {
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  let best = 400;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of steps) {
    const d = Math.abs(s - weight);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}
