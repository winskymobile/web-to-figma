import type { Font } from "fontkit";
import { create } from "fontkit";
import type { ConverterDiagnostic } from "../../../../diagnostics";
import type { OpenTypeFont } from "../../types";
import type { FontMetrics } from "./metrics";
import { extractFontMetrics } from "./metrics";

/**
 * Font properties used to request a font file. The loader is free to apply
 * fallbacks (closest available weight, drop italic when not available, etc.)
 * and reports the resolved values back via `FontFile`.
 */
export type FontProperties = {
  family: string;
  weight: number;
  italic: boolean;
  /** Optional resolution intent; third-party loaders may ignore this hint. */
  purpose?: "symbol-fallback";
};

/**
 * Result of loading a font file. `bytes` is the raw font file (TTF, OTF,
 * WOFF, or WOFF2 — fontkit detects the format). The optional `resolved*`
 * fields let the loader signal that a fallback was applied.
 *
 * `resolvedFamily` is set when the loader substituted a different family
 * (e.g. page CSS asked for `-apple-system` but bytes are Noto Sans SC).
 * The converter prefers that family for Figma `fontName` so labels match
 * the embedded outlines instead of CSS system keywords.
 */
export type FontFile = {
  bytes: ArrayBuffer;
  resolvedWeight?: number;
  resolvedItalic?: boolean;
  resolvedFamily?: string;
  /** Degradations observed while resolving these bytes. */
  diagnostics?: ReadonlyArray<ConverterDiagnostic>;
};

/**
 * A function that resolves font properties to a font file. The loader owns
 * any catalog or fallback logic; the converter only consumes the bytes.
 */
export type FontLoader = (request: FontProperties) => Promise<FontFile>;

export type LoadedFont = {
  font: OpenTypeFont;
  metrics: FontMetrics;
  /** What was requested. */
  properties: FontProperties;
  /** What was actually loaded (after the loader's fallbacks). */
  actualWeight?: number;
  actualItalic: boolean;
  /** Family name for Figma fontName (embedded / resolved face). */
  actualFamily: string;
  fontStyleName: string;
  postScriptName: string;
  /** Loader degradations retained across cache hits. */
  diagnostics: ReadonlyArray<ConverterDiagnostic>;
};

const WEIGHT_TO_STYLE_NAME: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

/** Nearest CSS weight key for Figma style name (e.g. 650 → Bold). */
function snapWeightToStyleBucket(weight: number): number {
  const keys = Object.keys(WEIGHT_TO_STYLE_NAME).map(Number);
  let best = 400;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of keys) {
    const distance = Math.abs(key - weight);
    if (distance < bestDistance || (distance === bestDistance && key > best)) {
      best = key;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Strip trailing RIBBI / weight tokens from a family string so Figma shows
 * e.g. family "Inter" + style "Bold", never family "Inter Bold".
 */
const FAMILY_STYLE_SUFFIX_RE =
  /(?:\s+|-)(?:thin|extra\s*light|extralight|ultra\s*light|ultralight|light|regular|normal|book|medium|demi\s*bold|demibold|semi\s*bold|semibold|bold|extra\s*bold|extrabold|ultra\s*bold|ultrabold|black|heavy|italic|oblique|roman)(?:\s+italic|\s+oblique)?$/i;

function stripStyleSuffixFromFamily(family: string): string {
  let value = family.trim();
  // Repeatedly peel style tokens (e.g. "Inter Bold Italic").
  for (let i = 0; i < 4; i += 1) {
    const next = value.replace(FAMILY_STYLE_SUFFIX_RE, "").trim();
    if (next === value || !next) {
      break;
    }
    value = next;
  }
  return value || family.trim();
}

/**
 * Canonical Figma family labels for station export faces.
 * Weight lives only in fontName.style (Bold/Medium/…), never in family.
 */
function canonicalizeExportFamily(family: string): string {
  const key = stripStyleSuffixFromFamily(family).toLowerCase();
  if (key === "inter" || key.startsWith("inter ")) {
    return "Inter";
  }
  if (
    key === "noto sans sc" ||
    key === "noto sans cjk sc" ||
    key === "noto sans simplified chinese" ||
    key.startsWith("noto sans sc ")
  ) {
    return "Noto Sans SC";
  }
  return stripStyleSuffixFromFamily(family);
}

export async function loadFont(
  fontLoader: FontLoader,
  properties: FontProperties
): Promise<LoadedFont> {
  const file = await fontLoader(properties);

  // fontkit's `create` accepts any `Uint8Array`-backed buffer at runtime; the
  // `Buffer` parameter type in the published `.d.ts` is misleading. Browser-safe.
  const parsed = create(new Uint8Array(file.bytes) as unknown as Buffer);
  if (!isFont(parsed)) {
    throw new Error(
      "fontkit returned a font collection; collection inputs are not supported"
    );
  }
  const font = parsed;
  const metrics = extractFontMetrics(font);

  const actualWeight = file.resolvedWeight ?? properties.weight;
  const actualItalic = file.resolvedItalic ?? properties.italic;
  const fontStyleName = buildFontStyleName(actualWeight, actualItalic);
  // Figma font picker: family is bare ("Inter" / "Noto Sans SC"); weight is
  // only in `style`. Prefer loader resolvedFamily / request family over OT
  // name tables that often bake "Bold" into familyName ("Inter Bold").
  const rawFamily =
    file.resolvedFamily?.trim() ||
    properties.family?.trim() ||
    font.familyName?.trim() ||
    "Inter";
  const actualFamily = canonicalizeExportFamily(rawFamily);
  // Prefer a clean family+style postscript for Figma matching; OT postscripts
  // like "Inter-Bold" are fine, but never leave weight only in family.
  const synthesizedPostScriptName = `${actualFamily.replace(/\s+/g, "")}-${fontStyleName.replace(/\s+/g, "")}`;
  const postScriptName =
    font.postscriptName?.trim() || synthesizedPostScriptName;

  return {
    font,
    metrics,
    properties,
    actualWeight,
    actualItalic,
    actualFamily,
    fontStyleName,
    postScriptName,
    diagnostics: file.diagnostics
      ? file.diagnostics.map((diagnostic) => ({ ...diagnostic }))
      : [],
  };
}

/**
 * fontkit's `create` returns either a `Font` or a `FontCollection` (TTC/DFont).
 * We discriminate on the `type` field — collections expose `'TTC' | 'DFont'`,
 * everything else is a single font.
 */
function isFont(value: unknown): value is Font {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  return type !== "TTC" && type !== "DFont";
}

function buildFontStyleName(weight: number, italic: boolean): string {
  const bucket = snapWeightToStyleBucket(weight);
  const baseName = WEIGHT_TO_STYLE_NAME[bucket] ?? "Regular";
  if (!italic) {
    return baseName;
  }
  if (baseName === "Regular") {
    return "Italic";
  }
  return `${baseName} Italic`;
}

/**
 * Options for the default fontsource-backed loader.
 */
export type FontsourceLoaderOptions = {
  /** Subset to request. Defaults to "latin". Common alternatives: "latin-ext", "cyrillic", "greek". */
  subset?: string;
  /**
   * Family to substitute when the requested family isn't in fontsource (web-safe
   * fonts like Verdana, Tahoma, Georgia, Times New Roman, etc. — fontsource
   * mirrors Google Fonts only). The substitute must itself be on fontsource.
   * The Figma payload still claims the *requested* family name, so destinations
   * with the system font installed render it correctly — the substituted bytes
   * only feed conversion-time metrics.
   *
   * Defaults to `"Inter"`. Pass `null` to disable substitution and throw on
   * missing families instead — the converter's per-node try/catch will then
   * silently drop affected text nodes.
   */
  fallbackFamily?: string | null;
};

const FONTSOURCE_BASE_URL = "https://cdn.jsdelivr.net/fontsource/fonts";
const FONTSOURCE_VERSION = "5";
const FONTSOURCE_FALLBACK_WEIGHT = 400;
const FONTSOURCE_DEFAULT_SUBSET = "latin";
const DEFAULT_FALLBACK_FAMILY = "Inter";

/**
 * Build a `FontLoader` that pulls Google Fonts as static `.woff2` files from
 * fontsource via jsDelivr's CDN. No API key, no UA tricks, browser-friendly.
 * fontkit decompresses WOFF2 transparently.
 *
 * Falls back through a small chain when the exact (weight, italic) combo
 * isn't available: drop italic, then regular 400, then throw.
 *
 * Families that fontsource genuinely doesn't carry (Verdana, Tahoma, etc. —
 * fontsource mirrors Google Fonts only) are memoized after the first
 * exhausted-with-404s attempt, so subsequent requests for the same family
 * fail fast instead of re-hitting jsDelivr for every text node on a page.
 * Transient failures (network, 5xx) are not memoized.
 */
export function createFontsourceLoader(
  options: FontsourceLoaderOptions = {}
): FontLoader {
  const subset = options.subset ?? FONTSOURCE_DEFAULT_SUBSET;
  // `undefined` → use the default; `null` → strict-fail; a string overrides.
  const fallbackFamily =
    options.fallbackFamily === undefined
      ? DEFAULT_FALLBACK_FAMILY
      : options.fallbackFamily;
  const fallbackKey = fallbackFamily ? familyToSlug(fallbackFamily) : null;
  const knownMissingFamilies = new Set<string>();

  return async (request: FontProperties): Promise<FontFile> => {
    const familyKey = familyToSlug(request.family);
    const isFallbackRequest = fallbackKey === familyKey;

    if (knownMissingFamilies.has(familyKey)) {
      if (fallbackFamily && !isFallbackRequest) {
        return await loadAsFallback(fallbackFamily, request, subset);
      }
      throw new Error(
        `fontsource: ${request.family} is not in the catalog (cached)`
      );
    }

    const outcome = await fetchFromFontsource(request, subset);
    if (outcome.kind === "ok") {
      return {
        bytes: outcome.bytes,
        resolvedWeight: outcome.resolvedWeight,
        resolvedItalic: outcome.resolvedItalic,
      };
    }

    if (outcome.kind === "not-found") {
      knownMissingFamilies.add(familyKey);
      if (fallbackFamily && !isFallbackRequest) {
        return await loadAsFallback(fallbackFamily, request, subset);
      }
    }

    throw new Error(
      `fontsource: no variant found for ${formatRequest(request)} (subset=${subset})`
    );
  };
}

async function loadAsFallback(
  fallbackFamily: string,
  originalRequest: FontProperties,
  subset: string
): Promise<FontFile> {
  const outcome = await fetchFromFontsource(
    { ...originalRequest, family: fallbackFamily },
    subset
  );
  if (outcome.kind !== "ok") {
    throw new Error(
      `fontsource: fallback family "${fallbackFamily}" is not available (subset=${subset})`
    );
  }
  return {
    bytes: outcome.bytes,
    resolvedWeight: outcome.resolvedWeight,
    resolvedItalic: outcome.resolvedItalic,
    resolvedFamily: fallbackFamily,
  };
}

type FontsourceFetchOutcome =
  | {
      kind: "ok";
      bytes: ArrayBuffer;
      resolvedWeight: number;
      resolvedItalic: boolean;
    }
  | { kind: "not-found" }
  | { kind: "transient" };

async function fetchFromFontsource(
  request: FontProperties,
  subset: string
): Promise<FontsourceFetchOutcome> {
  let onlySawNotFound = true;
  for (const candidate of buildFallbackChain(request)) {
    const url = buildFontsourceUrl(candidate, subset);
    const result = await tryFetchFont(url);
    if (result.kind === "ok") {
      return {
        kind: "ok",
        bytes: result.bytes,
        resolvedWeight: candidate.weight,
        resolvedItalic: candidate.italic,
      };
    }
    if (result.kind !== "not-found") {
      onlySawNotFound = false;
    }
  }
  return { kind: onlySawNotFound ? "not-found" : "transient" };
}

function buildFallbackChain(request: FontProperties): Array<FontProperties> {
  const chain: Array<FontProperties> = [request];
  if (request.italic) {
    chain.push({ ...request, italic: false });
  }
  if (request.weight !== FONTSOURCE_FALLBACK_WEIGHT) {
    chain.push({
      ...request,
      weight: FONTSOURCE_FALLBACK_WEIGHT,
      italic: false,
    });
  }
  return chain;
}

function buildFontsourceUrl(props: FontProperties, subset: string): string {
  const slug = familyToSlug(props.family);
  const style = props.italic ? "italic" : "normal";
  return `${FONTSOURCE_BASE_URL}/${slug}@${FONTSOURCE_VERSION}/${subset}-${props.weight}-${style}.woff2`;
}

function familyToSlug(family: string): string {
  return family.replace(/['"]/g, "").trim().toLowerCase().replace(/\s+/g, "-");
}

const HTTP_NOT_FOUND = 404;

type FetchResult =
  | { kind: "ok"; bytes: ArrayBuffer }
  | { kind: "not-found" }
  | { kind: "transient" };

async function tryFetchFont(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url);
    if (response.status === HTTP_NOT_FOUND) {
      return { kind: "not-found" };
    }
    if (!response.ok) {
      return { kind: "transient" };
    }
    return { kind: "ok", bytes: await response.arrayBuffer() };
  } catch {
    return { kind: "transient" };
  }
}

function formatRequest(request: FontProperties): string {
  return `${request.family} ${request.weight} ${request.italic ? "italic" : "normal"}`;
}
