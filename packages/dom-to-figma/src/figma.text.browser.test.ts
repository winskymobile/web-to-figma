import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ALT_TEST_FONT_FAMILY,
  createInterFontLoader,
  createTestFontLoader,
  loadInterIntoBrowser,
  loadTestFontIntoBrowser,
  TEST_FONT_FAMILY,
} from "./__fixtures__/loaders";
import { createFigmaConverter } from "./figma";

const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 80;
const SHA1_BYTE_COUNT = 20;

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

  it("derives glyph data from real font bytes (non-zero fontDigest, glyph entries)", async () => {
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

    const fontMeta = textChange.derivedTextData?.fontMetaData?.[0];
    expect(fontMeta?.fontDigest).toHaveLength(SHA1_BYTE_COUNT);
    expect(fontMeta?.fontDigest?.some((byte) => byte !== 0)).toBe(true);

    const glyphs = textChange.derivedTextData?.glyphs ?? [];
    expect(glyphs).toHaveLength(3);
    for (const glyph of glyphs) {
      expect(glyph.fontSize).toBe(16);
      expect(glyph.advance).toBeGreaterThan(0);
    }
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
