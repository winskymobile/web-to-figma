import type { DiagnosticReporter } from "../../diagnostics";
import type { Position, Size } from "../../dom";
import { getElementSize, getTextSize, isTextNode } from "../../dom";
import type { FontCache } from "../../font-cache";
import { createSolidPaint, cssColorToFigmaColor } from "../../styles/color";
import { cssBackgroundToFigmaPaints } from "../../styles/gradient";
import { parseOpacity } from "../../styles/opacity";
import { cssTransformToFigmaMatrix } from "../../styles/transform";
import type {
  FigmaBlob,
  FigmaGuid,
  FigmaPaint,
  FigmaTextAlignHorizontal,
  FigmaTextCase,
  FigmaTextDecoration,
  FigmaTextNodeChange,
} from "../../types";
import { buildBaselines } from "./builders/baselines";
import { buildCharacterOffsets } from "./builders/character-offsets";
import { processTextDecorations } from "./builders/decorations";
import { parseTextProperties } from "./primitives/css/parser";
import { processGlyphs } from "./primitives/glyph/processor";
import { processTextLayout } from "./primitives/layout/processor";

const cssToFigmaTextAlignHorizontalMap: Record<
  string,
  FigmaTextAlignHorizontal
> = {
  left: "LEFT",
  center: "CENTER",
  right: "RIGHT",
  justify: "JUSTIFIED",
};

const fontWeightToWidthBufferMap: Record<number, number> = {
  100: 0,
  200: 0,
  300: 0,
  400: 2,
  500: 2,
  600: 2,
  700: 3,
  800: 4,
  900: 5,
};

function getWidthBuffer(fontWeight: number, fontSize: number) {
  const fontWeightBuffer = fontWeightToWidthBufferMap[fontWeight] ?? 0;
  return fontSize > 60 ? fontWeightBuffer + 1 : fontWeightBuffer;
}

const cssToFigmaTextDecorationMap: Record<string, FigmaTextDecoration> = {
  none: "NONE",
  underline: "UNDERLINE",
};

const cssToFigmaTextCaseMap: Record<string, FigmaTextCase> = {
  none: "ORIGINAL",
  uppercase: "UPPER",
  lowercase: "LOWER",
  capitalize: "TITLE",
};

function applyCssTextTransform(text: string, transform: string): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/(^|\s)(\S)/g, (_, sp, c) => sp + c.toUpperCase());
    default:
      return text;
  }
}

// Detects whether the browser laid out the text on a single visual line.
// Each visual line produces at least one client rect; we group by `top`
// (tolerating sub-pixel jitter) to count distinct lines.
function isTextOnSingleLine(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);

  const rects = Array.from(range.getClientRects()).filter(
    (r) => r.width && r.height
  );

  const topJitterTolerance = 1;
  const lineTops: Array<number> = [];
  for (const rect of rects) {
    if (
      !lineTops.some((top) => Math.abs(top - rect.top) < topJitterTolerance)
    ) {
      lineTops.push(rect.top);
    }
  }
  return lineTops.length <= 1;
}

type Params = {
  guid: FigmaGuid;
  parentGuid: FigmaGuid;
  childIndex: number;
  position: Position;
  size?: Size;
  textContent?: string;
  /** Per-character style ids + table for rich-inline hosts (scheme C). */
  characterStyles?: {
    characterStyleIDs: Array<number>;
    styleOverrideTable: Array<{
      styleID: number;
      fillPaints: Array<FigmaPaint>;
    }>;
  };
  registerBlob: (blob: FigmaBlob) => number;
  inheritedProperties?: {
    textGradient?: Array<FigmaPaint>;
  };
  fontCache: FontCache;
  reportDiagnostic: DiagnosticReporter;
};

/** Station / Figma default for non-symbol system stacks. */
const DEFAULT_EXPORT_FAMILY = "Noto Sans SC";

/**
 * True when the text node is a single standalone symbol, punctuation, or emoji
 * grapheme (e.g. "→", "✓", "✅"). Letters, digits, CJK, and multi-char runs false.
 *
 * Emoji may be multiple code points (emoji + VS16 / ZWJ sequences). We treat
 * the whole trimmed string as one grapheme cluster via Intl.Segmenter when
 * available, else fall back to Array.from length checks with emoji heuristics.
 */
function isSingleSymbolOrEmojiText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  // ZWJ / multi-code-point emoji sequences as one visual emoji.
  if (
    /^\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic}|\uFE0F)*$/u.test(
      trimmed
    )
  ) {
    return true;
  }

  let graphemes: Array<string>;
  try {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    graphemes = [...segmenter.segment(trimmed)].map((s) => s.segment);
  } catch {
    graphemes = Array.from(trimmed);
  }

  if (graphemes.length !== 1) {
    return false;
  }

  const ch = graphemes[0] ?? trimmed;

  // CJK / kana / hangul keep the CJK primary (including lone "中").
  if (
    /^[\u3040-\u30ff\u3130-\u318f\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]$/u.test(
      ch
    )
  ) {
    return false;
  }

  // Single letter or number is not a symbol/emoji for this policy.
  if (/^\p{L}$|^\p{N}$/u.test(ch)) {
    return false;
  }

  // Punctuation / symbol (→ ✓ • …)
  if (/^\p{S}$|^\p{P}$/u.test(ch)) {
    return true;
  }

  // Emoji / pictographic (+ optional VS16)
  if (
    /\p{Extended_Pictographic}/u.test(ch) ||
    /\p{Emoji_Presentation}/u.test(ch)
  ) {
    return true;
  }

  // Common emoji that may only match as symbol components after VS16
  if (/\uFE0F/.test(ch) && /\p{S}/u.test(ch.replace(/\uFE0F/g, ""))) {
    return true;
  }

  return false;
}

/**
 * CSS primary families that should export as Noto Sans SC (not page system
 * keywords like PingFang / -apple-system that Figma cannot resolve stably).
 * Explicit custom faces (Open Sans, brand @font-face, Inter body, …) stay.
 */

/**
 * One user-perceived character (letter, digit, CJK, symbol, or emoji grapheme).
 */
function isSingleGraphemeText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (isSingleSymbolOrEmojiText(trimmed)) {
    return true;
  }
  let graphemes: Array<string>;
  try {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    graphemes = [...segmenter.segment(trimmed)].map((s) => s.segment);
  } catch {
    graphemes = Array.from(trimmed);
  }
  return graphemes.length === 1;
}

function cssLooksCentered(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v === "normal" || v === "stretch" || v === "auto") {
    return false;
  }
  // place-items / place-content may be "center" or "center center"
  return v.split(/\s+/).includes("center");
}

/** Self or parent expresses centering (place-items, flex/grid align, text-align). */
function hasCenterIntent(element: Element): boolean {
  const view = element.ownerDocument?.defaultView ?? window;
  const check = (el: Element | null): boolean => {
    if (!el) {
      return false;
    }
    const s = view.getComputedStyle(el);
    const placeItems = s.placeItems || s.getPropertyValue("place-items") || "";
    const placeContent =
      s.placeContent || s.getPropertyValue("place-content") || "";
    if (
      cssLooksCentered(placeItems) ||
      cssLooksCentered(placeContent) ||
      cssLooksCentered(s.alignItems) ||
      cssLooksCentered(s.justifyItems) ||
      cssLooksCentered(s.justifyContent) ||
      cssLooksCentered(s.alignContent) ||
      s.textAlign === "center"
    ) {
      return true;
    }
    return false;
  };
  if (check(element)) {
    return true;
  }
  return check(element.parentElement);
}

function isSystemOrCjkStackFamily(family: string): boolean {
  const key = family.trim().toLowerCase();
  if (!key) {
    return true;
  }
  if (
    key === "-apple-system" ||
    key === "system-ui" ||
    key === "blinkmacsystemfont" ||
    key === "segoe ui" ||
    key === "ui-sans-serif" ||
    key === "ui-serif" ||
    key === "ui-monospace" ||
    key === "sans-serif" ||
    key === "serif" ||
    key === "monospace" ||
    key === "cursive" ||
    key === "fantasy" ||
    key === "emoji" ||
    key === "math" ||
    key === "fangsong" ||
    key.startsWith("pingfang") ||
    key.startsWith("hiragino") ||
    key.includes("yahei") ||
    key === "simhei" ||
    key === "simsun" ||
    key === "songti sc" ||
    key === "heiti sc" ||
    key === "stheiti" ||
    key === "noto sans cjk sc" ||
    key === "source han sans sc" ||
    key === "droid sans fallback" ||
    key === "arial unicode ms"
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve the primary font request for Figma labeling + outline loading.
 * Single symbol/emoji → Inter; system stacks → Noto Sans SC; else CSS face.
 */
function resolvePrimaryFontRequest(
  text: string,
  font: {
    family: string;
    weight: number;
    italic: boolean;
  }
): { family: string; weight: number; italic: boolean } {
  if (isSingleSymbolOrEmojiText(text)) {
    return {
      family: "Inter",
      weight: font.weight,
      italic: font.italic,
    };
  }
  if (isSystemOrCjkStackFamily(font.family)) {
    return {
      family: DEFAULT_EXPORT_FAMILY,
      weight: font.weight,
      // Noto Sans SC station faces are upright; drop italic for stable styles.
      italic: false,
    };
  }
  return font;
}

export async function nodeToTextNodeChange(
  node: Element | Text,
  options: Params
): Promise<FigmaTextNodeChange> {
  const {
    guid,
    parentGuid,
    childIndex,
    position,
    registerBlob,
    size,
    inheritedProperties,
    textContent,
    characterStyles,
    fontCache,
    reportDiagnostic,
  } = options;
  const isTextNodeValue = isTextNode(node);

  // If the node is a text node, use the parent element for getting the computed style, otherwise use the node itself
  const element = isTextNodeValue ? node.parentElement : node;

  if (!element) {
    throw new Error("Element not found");
  }

  const computedStyle = window.getComputedStyle(element);

  const defaultTextContent = node.textContent?.trim() ?? "";
  // Caller-provided content (rich-inline flatten) keeps internal newlines/spaces.
  const rawText = textContent ?? defaultTextContent;

  const defaultSize = isTextNodeValue
    ? getTextSize(node)
    : getElementSize(element);
  const nodeSize = size ?? defaultSize;

  const baseWidth = nodeSize.width;
  const baseHeight = nodeSize.height;

  const fontSize = Number.parseFloat(computedStyle.fontSize || "16");
  const fontWeight = Number.parseInt(computedStyle.fontWeight, 10);
  const textAlign =
    cssToFigmaTextAlignHorizontalMap[computedStyle.textAlign] ?? "LEFT";
  const color = cssColorToFigmaColor(computedStyle.color);

  // Check for gradient backgrounds in text (for gradient text effects)
  const backgroundImage =
    computedStyle.backgroundImage || computedStyle.background;

  const fillPaints: Array<FigmaPaint> = [];

  // Prioritize inherited text gradient from parent with background-clip: text
  if (
    inheritedProperties?.textGradient &&
    inheritedProperties.textGradient.length > 0
  ) {
    fillPaints.push(...inheritedProperties.textGradient);
  }
  // Check for gradients first. Only apply gradient if the color is transparent (that's how text gradient works in CSS)
  else if (backgroundImage && backgroundImage !== "none" && color === null) {
    const gradientPaints = cssBackgroundToFigmaPaints(backgroundImage);
    fillPaints.push(...gradientPaints);
  }
  // Add solid color if present and no gradients found
  else if (color) {
    fillPaints.push(createSolidPaint(color.color, color.opacity));
  }

  // Check for text decoration on current element and parent elements
  let textDecoration = computedStyle.textDecorationLine || "none";

  // If no decoration found on current element, recursively check parent elements
  if (textDecoration === "none") {
    let parentElement = element.parentElement;
    while (parentElement) {
      const parentStyle = window.getComputedStyle(parentElement);
      const parentDecoration = parentStyle.textDecorationLine || "none";

      if (parentDecoration !== "none") {
        textDecoration = parentDecoration;
        break;
      }
      parentElement = parentElement.parentElement;
    }
  }

  const figmaTextDecoration =
    cssToFigmaTextDecorationMap[textDecoration] ?? "NONE";

  // Parse text transform (text case)
  const textTransform = computedStyle.textTransform || "none";
  const figmaTextCase = cssToFigmaTextCaseMap[textTransform] ?? "ORIGINAL";

  const text = applyCssTextTransform(rawText, textTransform);

  // It's generally more accurate to use the actual box height as the line height, but this doesn't work for text on multiple lines,
  // so in that case we use the computed line height.
  const computedLineHeight =
    computedStyle.lineHeight !== "normal"
      ? Number.parseFloat(computedStyle.lineHeight)
      : fontSize * 1.2;

  const lineHeight = computedLineHeight;

  // Whether the browser actually wrapped this text. If it didn't, we must not
  // wrap it in `derivedTextData` either — OpenType.js's metrics differ slightly
  // from the browser's and can spuriously break a line that fits in the DOM.
  // Hard newlines from rich-inline flatten always force multi-line layout.
  const isSingleLine = !text.includes("\n") && isTextOnSingleLine(node);

  const letterSpacing =
    computedStyle.letterSpacing !== "normal"
      ? Number.parseFloat(computedStyle.letterSpacing)
      : 0;

  const widthBuffer = getWidthBuffer(fontWeight, fontSize);

  // Centered single grapheme/emoji: use font-size as the text box width so
  // Figma auto-width / AL center has an em-square footprint (not a tight
  // measured advance that under-sizes weather icons).
  const centerSingleGlyph =
    isSingleGraphemeText(text) && hasCenterIntent(element);
  const targetWidth = centerSingleGlyph
    ? Math.max(fontSize, 1)
    : baseWidth + widthBuffer;
  const widthDelta = targetWidth - baseWidth;

  const adjustedSize = {
    width: targetWidth,
    height: baseHeight,
  };

  const adjustedPosition = {
    x: position.x - widthDelta / 2,
    // Need this max because of browser text alignment issues
    y: Math.max(0, position.y),
  };

  const { font, ...styles } = parseTextProperties(element);

  // Lone symbol/emoji → Inter primary. System/CJK stacks → Noto Sans SC.
  // Explicit custom faces keep CSS family. Weight maps via loader style buckets.
  // Multi-char runs keep Inter outline fallback for missing glyphs below.
  const primaryFont = resolvePrimaryFontRequest(text, font);

  const loadedFont = await fontCache.get(primaryFont);
  for (const diagnostic of loadedFont.diagnostics) {
    reportDiagnostic(diagnostic);
  }

  // Wrap and align within the box this node ships with, NOT the parent
  // element's width: glyph/baseline offsets bake the alignment in, and the
  // box is already positioned at the measured rect — centering against the
  // parent again would double the offset (it did: centered raw text nodes
  // rendered shifted by (parentWidth - textWidth) / 2). Line breaking is
  // unaffected: every browser break also overflows the (narrower) box, and
  // no line exceeds it. The buffer absorbs font-metric differences between
  // the browser and OpenType.js.
  // For multi-line text, wrap against the measured box width (no buffer).
  // Buffering the wrap width under-wraps CJK relative to the browser and
  // leaves lines that still overflow the Figma frame. Single-line keeps a
  // small buffer so OpenType metrics don't spuriously break a fitting line.
  const wrappingContainerWidth = isSingleLine
    ? Math.max(1, adjustedSize.width)
    : Math.max(1, nodeSize.width);

  const layout = processTextLayout(loadedFont.font, text, {
    fontSize: styles.fontSize,
    spacing: { letterSpacing: styles.letterSpacing },
    alignment: styles.textAlign,
    containerWidth: wrappingContainerWidth,
    lineHeight: styles.lineHeight,
    wrapping: {
      enabled: true,
      // Mirror browser layout: only re-wrap when the DOM already soft-wrapped.
      wordWrap: !isSingleLine,
      // Allow hard-breaking oversized tokens (esp. CJK already per-char).
      breakWords: !isSingleLine,
    },
  });

  // CJK subset faces (e.g. Noto Sans SC) often omit arrows/checkmarks.
  // Load Inter outlines for missing code points inside multi-character runs.
  // Single-symbol nodes already use Inter as primary (above).
  // Never fall back to commandsBlob 0 — that reuses another character's path.
  let symbolFallback: typeof loadedFont | null = null;
  const primaryIsInter =
    loadedFont.actualFamily.trim().toLowerCase() === "inter";
  if (!primaryIsInter) {
    try {
      symbolFallback = await fontCache.get({
        family: "Inter",
        weight: loadedFont.actualWeight ?? loadedFont.properties.weight ?? 400,
        italic: font.italic,
        purpose: "symbol-fallback",
      });
      for (const diagnostic of symbolFallback.diagnostics) {
        reportDiagnostic(diagnostic);
      }
    } catch {
      symbolFallback = null;
    }
  }

  const glyphs = processGlyphs(
    loadedFont,
    text,
    {
      fontSize: styles.fontSize,
      includeWhitespace: true,
    },
    registerBlob,
    symbolFallback ? [symbolFallback] : []
  );
  for (const character of glyphs.missingCharacters) {
    const codePoint = character.codePointAt(0);
    reportDiagnostic({
      code: "missing-glyph",
      severity: "warning",
      message: `No loaded font contains a glyph for ${codePoint === undefined ? "an unknown character" : `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`}.`,
      character,
    });
  }
  const emptyGlyphBlob =
    glyphs.missingCharacters.length > 0
      ? registerBlob({ bytes: [0] })
      : undefined;

  const baselines = buildBaselines(
    layout,
    styles.fontSize,
    styles.textAlign,
    nodeSize.width,
    loadedFont.metrics
  );

  const characterOffsets = buildCharacterOffsets(layout);

  // Process text decorations (underlines, etc.) - implement strikethrough later
  const decorationType =
    figmaTextDecoration === "UNDERLINE" ? "underline" : "none";

  const decorations = processTextDecorations(layout, loadedFont.font, text, {
    decorationType,
    fontSize: styles.fontSize,
    respectGlyphDescent: true,
  });

  // Build textData and derivedTextData
  const result = {
    textData: {
      characters: text,
      lines: [
        {
          lineType: "PLAIN" as const,
          styleId: 0,
          indentationLevel: 0,
          sourceDirectionality: "AUTO" as const,
          listStartOffset: 0,
          isFirstLineOfList: false,
        },
      ],
      ...(characterStyles
        ? {
            characterStyleIDs: characterStyles.characterStyleIDs,
            styleOverrideTable: characterStyles.styleOverrideTable,
          }
        : {}),
    },
    derivedTextData: {
      layoutSize: {
        x: layout.bounds.width,
        y: layout.bounds.height,
      },
      baselines: baselines.map((baseline, index) => {
        let lineWidth = 0;
        let baselineX = 0;
        const lineHeight = styles.lineHeight;
        let lineY = 0;
        const firstCharacter = baseline.characterStart;
        const endCharacter = baseline.characterEnd;

        if (layout.isMultiLine && layout.multiLineLayout) {
          // For multi-line text, get width from the specific line
          const line = layout.multiLineLayout.lines[index];
          lineWidth = line ? line.width : 0;
          lineY = index * lineHeight;

          // Calculate X position based on alignment
          // Use wrappingContainerWidth to match the container width used for glyph positioning
          if (styles.textAlign !== "left" && wrappingContainerWidth) {
            switch (styles.textAlign) {
              case "center":
                if (lineWidth < wrappingContainerWidth) {
                  baselineX = (wrappingContainerWidth - lineWidth) / 2;
                }
                break;
              case "right":
                baselineX = wrappingContainerWidth - lineWidth;
                break;
              default: {
                throw new Error("Invalid text align");
              }
            }
          }
        } else {
          // For single-line text, use the overall bounds width
          lineWidth = layout.bounds.width;
          lineY = 0;

          // Calculate X position based on alignment
          // Use wrappingContainerWidth to match the container width used for glyph positioning
          if (
            styles.textAlign !== "left" &&
            !layout.isMultiLine &&
            wrappingContainerWidth
          ) {
            switch (styles.textAlign) {
              case "center":
                if (lineWidth < wrappingContainerWidth) {
                  baselineX = (wrappingContainerWidth - lineWidth) / 2;
                }
                break;
              case "right":
                baselineX = wrappingContainerWidth - lineWidth;
                break;
              default: {
                throw new Error("Invalid text align");
              }
            }
          }
        }

        return {
          position: {
            x: baselineX,
            y: baseline.baseline,
          },
          width: lineWidth,
          lineY,
          lineHeight,
          lineAscent:
            (loadedFont.metrics.ascender / loadedFont.metrics.unitsPerEm) *
            styles.fontSize,
          firstCharacter,
          endCharacter,
        };
      }),
      glyphs: layout.positions.map((pos, i) => {
        const glyphData = glyphs.glyphDataMap.get(pos.character);
        // Prefer real outline; if still missing, emit empty path blob once so we
        // do not reuse index 0 (another character's outline).
        const commandsBlob =
          glyphData?.registeredBlobIndex ??
          emptyGlyphBlob ??
          registerBlob({ bytes: [0] });
        const glyphPosition = {
          commandsBlob,
          position: {
            x: pos.x,
            y: pos.y,
          },
          fontSize: styles.fontSize,
          firstCharacter: i,
          advance: pos.advance / styles.fontSize,
          rotation: 0.0,
        };

        return glyphPosition;
      }),
      fontMetaData: [
        {
          key: {
            family: loadedFont.actualFamily,
            style: loadedFont.fontStyleName,
            // Figma writes its FontMetaData entries with an empty postscript
            // even when the top-level fontName carries one. Match that so a
            // round-trip looks identical and Figma's font matching (which is
            // by family + style + weight) takes the same path on both sides.
            postscript: "",
          },
          // Intrinsic line-height ratio of the font, NOT the user's chosen
          // line-height in pixels. The user's line-height already lives on
          // `nc.lineHeight` above. See `FontMetrics.lineHeightRatio`.
          fontLineHeight: loadedFont.metrics.lineHeightRatio,
          fontStyle: loadedFont.actualItalic
            ? ("ITALIC" as const)
            : ("NORMAL" as const),
          fontWeight: loadedFont.actualWeight ?? loadedFont.properties.weight,
        },
      ],
      truncationStartIndex: -1,
      truncatedHeight: -1.0,
      logicalIndexToCharacterOffsetMap: characterOffsets,
      derivedLines: [
        {
          directionality: "LTR" as const,
        },
      ],
      ...(decorations.length > 0 && { decorations }),
    },
  };

  const nodeChange: FigmaTextNodeChange = {
    /* General Info */
    guid,
    phase: "CREATED",
    parentIndex: {
      guid: parentGuid,
      position: childIndex.toString(),
    },
    type: "TEXT",
    name: text,
    visible: true,
    opacity: parseOpacity(computedStyle.opacity),

    /* Size and Position */
    size: {
      x: adjustedSize.width,
      y: adjustedSize.height,
    },
    transform: cssTransformToFigmaMatrix(element, adjustedPosition, {
      width: adjustedSize.width,
      height: adjustedSize.height,
    }),

    /* Text */
    characters: text,

    /* Alignment */
    textAlignHorizontal: textAlign,
    textAlignVertical: "TOP",

    /* Font */
    fontSize,
    lineHeight: {
      value: lineHeight,
      units: "PIXELS",
    },
    fontName: {
      // Embedded/resolved face — never CSS keywords like `-apple-system`.
      // Lone symbols/emoji → Inter; system stacks → Noto Sans SC (style from weight).
      family: loadedFont.actualFamily,
      style: loadedFont.fontStyleName,
      postscript: loadedFont.postScriptName,
    },
    letterSpacing: {
      value: letterSpacing,
      units: "PIXELS",
    },

    /* Text Data */
    textData: result.textData,
    derivedTextData: result.derivedTextData,

    /* Stroke */
    strokeWeight: 1.0,
    strokeAlign: "OUTSIDE",
    strokeJoin: "MITER",

    /* Fill */
    fillPaints,

    /* Text Decoration */
    ...(figmaTextDecoration !== "NONE" && {
      textDecoration: figmaTextDecoration,
    }),

    /* Text Case */
    ...(figmaTextCase !== "ORIGINAL" && {
      textCase: figmaTextCase,
    }),

    /* Other */
    // CSS `font-variant-ligatures: normal` (the default) enables common and
    // contextual ligatures only. Discretionary and historical ligatures are
    // off unless the author opts in — match that here.
    fontVariantCommonLigatures: true,
    fontVariantContextualLigatures: true,
    fontVariantDiscretionaryLigatures: false,
    fontVersion: "2",
    textUserLayoutVersion: 4,
    textExplicitLayoutVersion: 1,
    textBidiVersion: 1,
    // Most text omits `textAutoResize` so Figma keeps the measured box
    // (WIDTH_AND_HEIGHT on multi-line can unwrap/clip). Lone symbol/emoji
    // icons use Figma auto-width so the host can reflow Inter / system emoji.
    ...(isSingleSymbolOrEmojiText(text) || centerSingleGlyph
      ? { textAutoResize: "WIDTH_AND_HEIGHT" as const }
      : {}),
    autoRename: true,
  };

  return nodeChange;
}
