import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ALT_TEST_FONT_FAMILY,
  createInterFontLoader,
  createTestFontLoader,
  loadInterIntoBrowser,
  loadTestFontIntoBrowser,
  TEST_FONT_FAMILY,
} from "./__fixtures__/loaders";
import type { FontFile, FontLoader, FontProperties } from "./figma";
import { createFigmaConverter } from "./figma";

const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 80;
const FULL_INTER_REGULAR_URL =
  "https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/Inter-Regular.woff2";

let fullInterRegular: Promise<ArrayBuffer> | undefined;

function createFullInterFallbackLoader(): FontLoader {
  const primaryLoader = createTestFontLoader();
  return async (request): Promise<FontFile> => {
    if (request.family.trim().toLowerCase() !== "inter") {
      return primaryLoader(request);
    }

    fullInterRegular ??= fetch(FULL_INTER_REGULAR_URL).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch pinned full Inter fixture (${response.status}): ${FULL_INTER_REGULAR_URL}`
        );
      }
      return response.arrayBuffer();
    });

    return {
      bytes: await fullInterRegular,
      resolvedWeight: 400,
      resolvedItalic: false,
      resolvedFamily: "Inter",
    };
  };
}

const mountElement = (html: string): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper.firstElementChild as HTMLElement;
};

beforeAll(async () => {
  await loadTestFontIntoBrowser();
  await loadInterIntoBrowser();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("text rendering with bundled font", () => {
  it("emits a TEXT node with characters, font family, and computed font size", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:24px;color:rgb(0,0,0)">Hello world</div>`
    );

    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    expect(textChange).toBeDefined();
    expect(textChange?.type).toBe("TEXT");
    if (textChange?.type !== "TEXT") {
      return;
    }
    expect(textChange.characters).toBe("Hello world");
    expect(textChange.fontSize).toBe(24);
    expect(textChange.fontName?.family).toBe(TEST_FONT_FAMILY);
    expect(textChange.fontName?.style).toBe("Regular");
  });

  it("derives glyph data from real font bytes", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px">abc</div>`
    );

    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }

    // fontLineHeight is the font's intrinsic line-height ratio
    // ((asc - desc + gap) / upm), not the user's CSS line-height. Real fonts
    // always have an em ratio >= 1.0 (the box covers a full em plus leading);
    // 2.0 is a comfortable upper bound for display faces.
    const fontMeta = textChange.derivedTextData?.fontMetaData?.[0];
    expect(fontMeta?.fontLineHeight).toBeGreaterThanOrEqual(1);
    expect(fontMeta?.fontLineHeight).toBeLessThan(2);
    // Match Figma's wire format: empty postscript on the meta key, real
    // postscript on the top-level fontName.
    expect(fontMeta?.key.postscript).toBe("");
    expect(textChange.fontName?.postscript).not.toBe("");

    const glyphs = textChange.derivedTextData?.glyphs ?? [];
    expect(glyphs).toHaveLength(3);
    for (const glyph of glyphs) {
      expect(glyph.fontSize).toBe(16);
      expect(glyph.advance).toBeGreaterThan(0);
    }

    // Baselines use [start, end) half-open ranges — endCharacter equals
    // the character count, not count - 1.
    const baseline = textChange.derivedTextData?.baselines?.[0];
    expect(baseline?.firstCharacter).toBe(0);
    expect(baseline?.endCharacter).toBe(3);
  });

  it("emits the fixed Figma wire fields on every TEXT node", async () => {
    // Pin the constants we send unconditionally on the wire. These match
    // what Figma writes itself when copying a TEXT node — see the
    // text-correctness-fixes changeset for the full rationale.
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px">abc</div>`
    );

    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }

    // We deliberately leave textAutoResize unset — see the converter for
    // the rationale. Emitting WIDTH_AND_HEIGHT here would un-wrap
    // multi-line text on Figma's re-derivation pass and clip against
    // the parent frame.
    expect(textChange.textAutoResize).toBeUndefined();
    // Pinned to match Figma's own clipboard output.
    expect(textChange.textBidiVersion).toBe(1);
    expect(textChange.textExplicitLayoutVersion).toBe(1);
    expect(textChange.textUserLayoutVersion).toBe(4);
    // CSS `font-variant-ligatures: normal` enables common+contextual only.
    expect(textChange.fontVariantCommonLigatures).toBe(true);
    expect(textChange.fontVariantContextualLigatures).toBe(true);
    expect(textChange.fontVariantDiscretionaryLigatures).toBe(false);
    // We no longer compute a SHA-1 of the font bytes — see changeset.
    const fontMeta = textChange.derivedTextData?.fontMetaData?.[0];
    expect(fontMeta?.fontDigest).toBeUndefined();
  });

  it("splits multi-line text into per-line baselines with non-overlapping [start, end) ranges", async () => {
    // Force the browser to wrap by clamping the container to roughly one
    // word's worth of width. The baselines pipeline only enters its
    // multi-line branch when the browser itself produced multiple lines.
    const element = mountElement(
      `<div style="width:40px;height:200px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px;line-height:20px">abc def ghi</div>`
    );

    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }

    const baselines = textChange.derivedTextData?.baselines ?? [];
    const totalGlyphs = textChange.derivedTextData?.glyphs?.length ?? 0;
    expect(baselines.length).toBeGreaterThanOrEqual(2);

    // Half-open intervals partition the glyph index space: each line's
    // endCharacter is the next line's firstCharacter, and the last line
    // ends at the total glyph count. With the previous off-by-one bug, the
    // gap between consecutive baselines would be 1 instead of 0.
    expect(baselines[0]?.firstCharacter).toBe(0);
    for (let i = 1; i < baselines.length; i += 1) {
      expect(baselines[i]?.firstCharacter).toBe(baselines[i - 1]?.endCharacter);
    }
    expect(baselines.at(-1)?.endCharacter).toBe(totalGlyphs);
  });

  it("propagates font weight into the resolved style name", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px;font-weight:700">Bold text</div>`
    );

    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }
    expect(textChange.fontName?.style).toBe("Bold");
  });
});

describe("text rendering with Inter", () => {
  it("emits a TEXT node with one glyph per character", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${ALT_TEST_FONT_FAMILY}',sans-serif;font-size:16px">office affinity</div>`
    );

    const figma = createFigmaConverter({ fontLoader: createInterFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }
    expect(textChange.characters).toBe("office affinity");
    expect(textChange.fontName?.family).toBe(ALT_TEST_FONT_FAMILY);

    // One glyph per character — no ligature collapsing. The pipeline keys
    // blobs by character (see processGlyphs), so any shaped output would be
    // silently corrupted.
    const glyphs = textChange.derivedTextData?.glyphs ?? [];
    expect(glyphs).toHaveLength("office affinity".length);
  });
});

describe("font fallback diagnostics", () => {
  it("requests an italic symbol-fallback face for italic text", async () => {
    const requests: Array<FontProperties> = [];
    const delegate = createFullInterFallbackLoader();
    const fontLoader: FontLoader = (request) => {
      requests.push({ ...request });
      return delegate(request);
    };
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:24px;font-style:italic">A→</div>`
    );

    const figma = createFigmaConverter({ fontLoader });
    await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    expect(requests).toContainEqual({
      family: "Inter",
      weight: 400,
      italic: true,
      purpose: "symbol-fallback",
    });
  });

  it("reports cached loader degradation once per conversion", async () => {
    const pageFontDiagnostic = {
      code: "page-font-fetch-failed" as const,
      severity: "warning" as const,
      message: "Page font fetch failed; configured fallback used.",
    };
    const fixtureLoader = createTestFontLoader();
    const fontLoader: FontLoader = async (request) => {
      const file = await fixtureLoader(request);
      return request.family === TEST_FONT_FAMILY
        ? { ...file, diagnostics: [pageFontDiagnostic] }
        : file;
    };
    const figma = createFigmaConverter({ fontLoader });
    const firstElement = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px"><span>first</span><span>second</span></div>`
    );

    const firstResult = await figma.convert({
      element: firstElement,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    expect(firstResult.diagnostics).toEqual([pageFontDiagnostic]);

    // The face comes from the converter cache, but its degradation still
    // belongs in the fresh report for this conversion.
    const secondElement = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px">third</div>`
    );
    const secondResult = await figma.convert({
      element: secondElement,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    expect(secondResult.diagnostics).toEqual([pageFontDiagnostic]);
  });

  it("uses distinct real Inter outlines for arrow and checkmark fallback glyphs", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:24px">A→✓</div>`
    );

    const figma = createFigmaConverter({
      fontLoader: createFullInterFallbackLoader(),
    });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }

    const glyphs = textChange.derivedTextData?.glyphs ?? [];
    expect(glyphs).toHaveLength(3);
    const [letter, arrow, check] = glyphs;
    expect(letter?.commandsBlob).not.toBe(arrow?.commandsBlob);
    expect(letter?.commandsBlob).not.toBe(check?.commandsBlob);
    expect(arrow?.commandsBlob).not.toBe(check?.commandsBlob);

    for (const glyph of glyphs) {
      const blob = result.document.blobs[glyph.commandsBlob];
      expect(blob?.bytes.length).toBeGreaterThan(1);
    }

    expect(
      result.diagnostics.filter(
        (diagnostic) =>
          diagnostic.code === "missing-glyph" &&
          (diagnostic.character === "→" || diagnostic.character === "✓")
      )
    ).toEqual([]);
  });

  it("reports a truly missing glyph once and uses an empty blob instead of A", async () => {
    // U+0378 is unassigned and maps to glyph id 0 in both bundled Open Sans
    // and pinned full Inter. (Inter's private-use area contains real icons.)
    const missingCharacter = "\u0378";
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:24px">A${missingCharacter}</div>`
    );

    const figma = createFigmaConverter({
      fontLoader: createFullInterFallbackLoader(),
    });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }

    const glyphs = textChange.derivedTextData?.glyphs ?? [];
    expect(glyphs).toHaveLength(2);
    const [letter, missing] = glyphs;
    expect(missing?.commandsBlob).not.toBe(letter?.commandsBlob);
    expect(
      result.document.blobs[letter?.commandsBlob ?? -1]?.bytes.length
    ).toBeGreaterThan(1);
    expect(result.document.blobs[missing?.commandsBlob ?? -1]?.bytes).toEqual([
      0,
    ]);

    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.code === "missing-glyph"
      )
    ).toEqual([
      expect.objectContaining({
        code: "missing-glyph",
        severity: "warning",
        character: missingCharacter,
      }),
    ]);
  });
});
