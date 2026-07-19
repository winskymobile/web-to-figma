import type {
  ConverterDiagnostic,
  FontLoader,
  FontProperties,
} from "@figit/dom-to-figma";

/**
 * Prefer fonts declared via @font-face on the preview document (or page).
 * Falls back to `fallbackLoader` when no match / fetch fails.
 */

const FALLBACK_WEIGHT = 400;

const PARSEABLE_FORMATS = new Set([
  "truetype",
  "opentype",
  "woff",
  "woff2",
  "embedded-opentype",
]);

const FONT_URL_PATTERN =
  /url\(\s*['"]?([^'"\s)]+)['"]?\s*\)(?:\s+format\(\s*['"]?([^'"\s)]+)['"]?\s*\))?/g;

const PARSEABLE_EXTENSION = /\.(ttf|otf|woff2?|eot)(\?|#|$)/i;

const KEYWORD_TO_WEIGHT: Record<string, number> = {
  normal: 400,
  bold: 700,
  lighter: 300,
  bolder: 700,
};

type PageFontEntry = {
  family: string;
  weightMin: number;
  weightMax: number;
  italic: boolean;
  url: string;
};

const FONT_FACE_RULE_TYPE = 5;

export type CreatePageFontLoaderOptions = {
  fallbackLoader: FontLoader;
  /** Document to scan for @font-face (defaults to window.document). */
  getDocument?: () => Document | null | undefined;
};

export function createPageFontLoader({
  fallbackLoader,
  getDocument,
}: CreatePageFontLoaderOptions): FontLoader {
  let entries: ReadonlyArray<PageFontEntry> | null = null;
  let scannedDoc: Document | null = null;

  return async (request: FontProperties) => {
    // Symbol resolution is deliberately independent of page faces. A page may
    // declare a latin-only Inter subset under the same family name, so both the
    // page lookup and the primary-font cache lane must be bypassed here.
    if (request.purpose === "symbol-fallback") {
      return fallbackLoader(request);
    }

    const doc = getDocument?.() ?? document;
    if (entries === null || scannedDoc !== doc) {
      entries = collectPageFontFaces(doc);
      scannedDoc = doc;
    }

    const match = findBestMatch(entries, request);
    if (!match) {
      return fallbackLoader(request);
    }

    try {
      const bytes = await fetchFontBytes(match.url);
      return {
        bytes,
        resolvedWeight: clamp(request.weight, match.weightMin, match.weightMax),
        resolvedItalic: match.italic,
      };
    } catch {
      const fallback = await fallbackLoader(request);
      const diagnostic: ConverterDiagnostic = {
        code: "page-font-fetch-failed",
        severity: "warning",
        message: `Failed to fetch the matched page font "${match.family}"; used the configured fallback.`,
      };
      return {
        ...fallback,
        diagnostics: [...(fallback.diagnostics ?? []), diagnostic],
      };
    }
  };
}

/** Force re-scan on next request (call after loading a new HTML preview). */
export function invalidatePageFontCache(
  loader: FontLoader & { __invalidate?: () => void }
) {
  loader.__invalidate?.();
}

function collectPageFontFaces(doc: Document): Array<PageFontEntry> {
  const collected: Array<PageFontEntry> = [];
  const baseHref = doc.baseURI || doc.location?.href || "";
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin sheets are opaque; skip.
      continue;
    }
    if (!rules) {
      continue;
    }
    const sheetHref =
      typeof sheet.href === "string" && sheet.href ? sheet.href : baseHref;
    for (const rule of Array.from(rules)) {
      if (isFontFaceRule(rule)) {
        const entry = parseFontFaceRule(rule, sheetHref);
        if (entry) {
          collected.push(entry);
        }
      }
    }
  }
  return collected;
}

function isFontFaceRule(rule: CSSRule): rule is CSSFontFaceRule {
  return rule.type === FONT_FACE_RULE_TYPE && "style" in rule;
}

function resolveFontUrl(url: string, baseHref: string): string {
  if (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)
  ) {
    return url;
  }
  try {
    return new URL(url, baseHref || undefined).href;
  } catch {
    return url;
  }
}

function parseFontFaceRule(
  rule: CSSFontFaceRule,
  baseHref: string
): PageFontEntry | null {
  const style = rule.style;
  const family = unquote(style.getPropertyValue("font-family"));
  const src = style.getPropertyValue("src");
  if (!(family && src)) {
    return null;
  }

  const rawUrl = pickParseableUrl(src);
  if (!rawUrl) {
    return null;
  }
  const url = resolveFontUrl(rawUrl, baseHref);

  const fontStyle = style.getPropertyValue("font-style") || "normal";
  const fontWeight = style.getPropertyValue("font-weight") || "400";
  const [weightMin, weightMax] = parseWeightRange(fontWeight);
  const italic = fontStyle === "italic" || fontStyle === "oblique";

  return { family, weightMin, weightMax, italic, url };
}

function pickParseableUrl(src: string): string | null {
  for (const source of parseSources(src)) {
    const format = source.format?.toLowerCase();
    if (format) {
      if (PARSEABLE_FORMATS.has(format)) {
        return source.url;
      }
      continue;
    }
    if (PARSEABLE_EXTENSION.test(source.url)) {
      return source.url;
    }
  }
  return null;
}

function parseSources(src: string): Array<{ url: string; format?: string }> {
  const sources: Array<{ url: string; format?: string }> = [];
  const pattern = new RegExp(FONT_URL_PATTERN.source, FONT_URL_PATTERN.flags);
  let match = pattern.exec(src);
  while (match !== null) {
    sources.push({ url: match[1]!, format: match[2] });
    match = pattern.exec(src);
  }
  return sources;
}

function parseWeightRange(weight: string): [number, number] {
  const numbers: Array<number> = [];
  for (const token of weight.trim().split(/\s+/)) {
    const value = weightTokenToNumber(token);
    if (value !== null) {
      numbers.push(value);
    }
  }
  if (numbers.length === 0) {
    return [FALLBACK_WEIGHT, FALLBACK_WEIGHT];
  }
  if (numbers.length === 1) {
    return [numbers[0]!, numbers[0]!];
  }
  return [numbers[0]!, numbers[1]!];
}

function weightTokenToNumber(token: string): number | null {
  const keyword = KEYWORD_TO_WEIGHT[token.toLowerCase()];
  if (keyword !== undefined) {
    return keyword;
  }
  const parsed = Number.parseInt(token, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function findBestMatch(
  entries: ReadonlyArray<PageFontEntry>,
  request: FontProperties
): PageFontEntry | null {
  const familyKey = request.family.toLowerCase();

  const exact = entries.find(
    (entry) =>
      entry.family.toLowerCase() === familyKey &&
      entry.italic === request.italic &&
      request.weight >= entry.weightMin &&
      request.weight <= entry.weightMax
  );
  if (exact) {
    return exact;
  }

  const sameItalic = entries
    .filter(
      (entry) =>
        entry.family.toLowerCase() === familyKey &&
        entry.italic === request.italic
    )
    .sort(
      (a, b) =>
        weightDistance(a, request.weight) - weightDistance(b, request.weight)
    );
  if (sameItalic.length > 0) {
    return sameItalic[0]!;
  }

  return (
    entries.find((entry) => entry.family.toLowerCase() === familyKey) ?? null
  );
}

function weightDistance(entry: PageFontEntry, weight: number): number {
  if (weight >= entry.weightMin && weight <= entry.weightMax) {
    return 0;
  }
  return weight < entry.weightMin
    ? entry.weightMin - weight
    : weight - entry.weightMax;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

async function fetchFontBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    credentials: "omit",
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`Font fetch failed (${response.status}) for ${url}`);
  }
  return response.arrayBuffer();
}
