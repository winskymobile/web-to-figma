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
    expect(
      firstResult.diagnostics.filter((d) => d.code === "page-font-fetch-failed")
    ).toEqual([pageFontDiagnostic]);

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
    expect(
      secondResult.diagnostics.filter(
        (d) => d.code === "page-font-fetch-failed"
      )
    ).toEqual([pageFontDiagnostic]);
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

describe("rich-inline single layer (scheme C)", () => {
  it("flattens h1 with em color and br into one TEXT with newline and styles", async () => {
    const element = mountElement(
      `<div style="width:320px;color:#fff;font-family:'${TEST_FONT_FAMILY}',sans-serif">
        <h1 style="margin:0;max-width:260px;font-size:48px;line-height:1.03;font-weight:900;color:#ffffff;background:transparent;padding:0;border:0">
          注册<em style="color:#ffe36d;font-style:normal">流程</em><br />说明
        </h1>
      </div>`
    );

    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: 320,
      height: 200,
    });

    const texts = result.document.nodeChanges.filter((c) => c.type === "TEXT");
    // One layer for the title (wrapper may not add text).
    const title = texts.find((t) => (t.characters || "").includes("注册"));
    expect(title).toBeDefined();
    if (!title || title.type !== "TEXT") {
      return;
    }
    expect(title.characters).toContain("\n");
    expect(title.characters.replace(/\n/g, "|").trim()).toBe("注册流程|说明");
    // Only one TEXT that includes 注册 (not split into three).
    expect(
      texts.filter((t) => (t.characters || "").includes("注册")).length
    ).toBe(1);

    const styleIds = title.textData?.characterStyleIDs;
    expect(styleIds?.length).toBe(title.characters.length);
    const start = title.characters.indexOf("流程");
    expect(start).toBeGreaterThanOrEqual(0);
    const emphasisIds = styleIds?.slice(start, start + 2) ?? [];
    expect(emphasisIds.every((id) => id > 0)).toBe(true);
    expect(title.textData?.styleOverrideTable?.length).toBeGreaterThan(0);
    const override = title.textData?.styleOverrideTable?.[0] as
      | {
          fillPaints?: Array<{
            type?: string;
            color?: { r: number; g: number; b: number };
          }>;
        }
      | undefined;
    const fill = override?.fillPaints?.[0];
    expect(fill?.type).toBe("SOLID");
    // yellow-ish
    if (fill && "color" in fill && fill.color) {
      expect(fill.color.r).toBeGreaterThan(0.9);
      expect(fill.color.g).toBeGreaterThan(0.8);
      expect(fill.color.b).toBeLessThan(0.5);
    }
  });

  it("does not flatten heading with nested block", async () => {
    const element = mountElement(
      `<h1 style="margin:0;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:24px;background:transparent;padding:0;border:0">
        Hi<div>block</div>
      </h1>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: 320,
      height: 120,
    });
    const texts = result.document.nodeChanges.filter((c) => c.type === "TEXT");
    const merged = texts.find((t) => (t.characters || "").includes("Hiblock"));
    expect(merged).toBeUndefined();
  });
});

describe("single-symbol Inter primary + Noto default", () => {
  function createStationLikeFontLoader(): FontLoader {
    const primaryLoader = createTestFontLoader();
    const interLoader = createFullInterFallbackLoader();
    return async (request): Promise<FontFile> => {
      const family = request.family.trim().toLowerCase();
      if (family === "inter") {
        const file = await interLoader(request);
        return {
          ...file,
          resolvedWeight: request.weight,
          resolvedItalic: request.italic,
          resolvedFamily: "Inter",
        };
      }
      if (family === "noto sans sc") {
        const file = await primaryLoader(request);
        return {
          ...file,
          resolvedFamily: "Noto Sans SC",
          resolvedWeight: request.weight,
          resolvedItalic: false,
        };
      }
      return primaryLoader(request);
    };
  }

  it("labels a lone arrow as Inter", async () => {
    const element = mountElement(
      `<div style="width:40px;height:40px;font-family:system-ui,sans-serif;font-size:16px">→</div>`
    );
    const figma = createFigmaConverter({
      fontLoader: createStationLikeFontLoader(),
    });
    const result = await figma.convert({
      element,
      width: 40,
      height: 40,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.fontName?.family).toBe("Inter");
  });

  it("does not force Inter for multi-character text containing a symbol", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px">OK →</div>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.fontName?.family).toBe(TEST_FONT_FAMILY);
  });

  it("does not force Inter for CJK text with an explicit custom face", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px">中</div>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.fontName?.family).toBe(TEST_FONT_FAMILY);
  });

  it("labels system-stack body text as Noto Sans SC", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:system-ui,-apple-system,'PingFang SC',sans-serif;font-size:16px;font-weight:700">下载APP</div>`
    );
    const figma = createFigmaConverter({
      fontLoader: createStationLikeFontLoader(),
    });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.fontName).toEqual(
      expect.objectContaining({ family: "Noto Sans SC", style: "Bold" })
    );
  });

  it("labels a lone emoji as Inter", async () => {
    const element = mountElement(
      `<div style="width:40px;height:40px;font-family:system-ui,sans-serif;font-size:16px;font-weight:700">✅</div>`
    );
    const figma = createFigmaConverter({
      fontLoader: createStationLikeFontLoader(),
    });
    const result = await figma.convert({
      element,
      width: 40,
      height: 40,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.fontName?.family).toBe("Inter");
    expect(textChange?.fontName?.style).toBe("Bold");
  });

  it("maps single-symbol Inter weight to Bold for font-weight 700", async () => {
    const element = mountElement(
      `<div style="width:40px;height:40px;font-family:system-ui,sans-serif;font-size:16px;font-weight:700">→</div>`
    );
    const figma = createFigmaConverter({
      fontLoader: createStationLikeFontLoader(),
    });
    const result = await figma.convert({
      element,
      width: 40,
      height: 40,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.fontName).toEqual(
      expect.objectContaining({ family: "Inter", style: "Bold" })
    );
    // Family must be bare — weight only in Figma style picker, not "Inter Bold".
    expect(textChange?.fontName?.family).toBe("Inter");
    expect(textChange?.fontName?.family).not.toMatch(/Bold|Medium|Light/i);
  });

  it("keeps Noto Sans SC family bare when style is Bold", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:system-ui;font-size:16px;font-weight:900">注册流程</div>`
    );
    const figma = createFigmaConverter({
      fontLoader: createStationLikeFontLoader(),
    });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.fontName?.family).toBe("Noto Sans SC");
    expect(textChange?.fontName?.style).toBe("Black");
    expect(textChange?.fontName?.family).not.toMatch(/Black|Bold|SC Black/i);
  });

  it("sets Figma auto width for lone symbol/emoji TEXT", async () => {
    const element = mountElement(
      `<div style="width:40px;height:40px;font-family:system-ui,sans-serif;font-size:20px">→</div>`
    );
    const figma = createFigmaConverter({
      fontLoader: createStationLikeFontLoader(),
    });
    const result = await figma.convert({
      element,
      width: 40,
      height: 40,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.textAutoResize).toBe("WIDTH_AND_HEIGHT");
  });

  it("sets centered single glyph width equal to font size", async () => {
    const element = mountElement(
      `<div style="display:grid;place-items:center;width:42px;height:42px;font-family:system-ui,sans-serif;font-size:20px">🌧️</div>`
    );
    const figma = createFigmaConverter({
      fontLoader: createStationLikeFontLoader(),
    });
    const result = await figma.convert({
      element,
      width: 42,
      height: 42,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.size?.x).toBe(20);
    expect(textChange?.textAutoResize).toBe("WIDTH_AND_HEIGHT");
  });

  it("does not force auto width for multi-character body text", async () => {
    const element = mountElement(
      `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;font-family:'${TEST_FONT_FAMILY}',sans-serif;font-size:16px">Hello world</div>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({
      element,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    const textChange = result.document.nodeChanges.find(
      (c) => c.type === "TEXT"
    );
    expect(textChange?.textAutoResize).toBeUndefined();
  });
});
