import { afterEach, describe, expect, test, vi } from "vitest";
import { createCjkAwareFontLoader } from "./cjk-font-loader";
import { setPreviewDocument, withPreviewConverter } from "./converter";
import { createPageFontLoader } from "./page-font-loader";
import { preparePreviewFontsForConvert } from "./prepare-preview-fonts";

const FALLBACK_STACK = '"Noto Sans SC", Inter, sans-serif';

const mountedFrames: Array<HTMLIFrameElement> = [];

async function mountIframe(srcdoc: string): Promise<HTMLIFrameElement> {
  const frame = document.createElement("iframe");
  const loaded = new Promise<void>((resolve) => {
    frame.addEventListener("load", () => resolve(), { once: true });
  });
  frame.srcdoc = srcdoc;
  document.body.appendChild(frame);
  mountedFrames.push(frame);
  await loaded;
  return frame;
}

afterEach(() => {
  setPreviewDocument(null);
  vi.restoreAllMocks();
  for (const frame of mountedFrames.splice(0)) {
    frame.remove();
  }
});

describe("preview iframe fonts", () => {
  test("selectively remaps a system stack and restores its inline style", async () => {
    const frame = await mountIframe(`
      <!doctype html>
      <html>
        <head>
          <style>
            @font-face {
              font-family: "Page Brand";
              src: url("data:font/woff2;base64,AQID") format("woff2");
            }
          </style>
        </head>
        <body>
          <p id="system" style="font-family: Arial, sans-serif">System</p>
          <p id="custom" style="font-family: 'Page Brand', serif">Custom</p>
        </body>
      </html>
    `);
    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    expect(frameWindow).not.toBeNull();
    expect(frameDocument).not.toBeNull();

    const system = frameDocument!.querySelector<HTMLElement>("#system")!;
    const custom = frameDocument!.querySelector<HTMLElement>("#custom")!;
    const FrameHTMLElement = (frameWindow as Window & typeof globalThis)
      .HTMLElement;
    expect(system instanceof HTMLElement).toBe(false);
    expect(system instanceof FrameHTMLElement).toBe(true);

    const originalSystemFamily = system.style.fontFamily;
    const originalCustomFamily = custom.style.fontFamily;
    const prepared = await preparePreviewFontsForConvert(frameDocument!, {
      loadFaces: false,
    });

    expect(system.style.fontFamily).toBe(FALLBACK_STACK);
    expect(custom.style.fontFamily).toBe(originalCustomFamily);

    prepared.restore();

    expect(system.style.fontFamily).toBe(originalSystemFamily);
    expect(custom.style.fontFamily).toBe(originalCustomFamily);
  });

  test("discovers a parseable font-face rule from iframe CSSOM", async () => {
    const frame = await mountIframe(`
      <!doctype html>
      <html>
        <head>
          <style>
            @font-face {
              font-family: "Iframe Brand";
              font-style: normal;
              font-weight: 400;
              src: url("data:font/woff2;base64,AQID") format("woff2");
            }
          </style>
        </head>
        <body></body>
      </html>
    `);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();

    const fallbackBytes = Uint8Array.from([9]).buffer;
    const loader = createPageFontLoader({
      fallbackLoader: async () => ({ bytes: fallbackBytes }),
      getDocument: () => frameDocument,
    });

    const loaded = await loader({
      family: "Iframe Brand",
      weight: 400,
      italic: false,
    });

    expect(Array.from(new Uint8Array(loaded.bytes))).toEqual([1, 2, 3]);
  });

  test("reports a matched page font fetch failure while preserving fallback diagnostics", async () => {
    const frame = await mountIframe(`
      <!doctype html>
      <html>
        <head>
          <style>
            @font-face {
              font-family: "Unavailable Brand";
              font-style: normal;
              font-weight: 400;
              src: url("https://fonts.example.invalid/unavailable.woff2") format("woff2");
            }
          </style>
        </head>
        <body></body>
      </html>
    `);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new TypeError("CORS blocked")
    );
    const fallbackBytes = Uint8Array.from([7, 8, 9]).buffer;
    const fallbackDiagnostic = {
      code: "missing-glyph" as const,
      severity: "warning" as const,
      message: "fallback already degraded",
      character: "\u0378",
    };
    const loader = createPageFontLoader({
      fallbackLoader: async () => ({
        bytes: fallbackBytes,
        diagnostics: [fallbackDiagnostic],
      }),
      getDocument: () => frameDocument,
    });

    const loaded = await loader({
      family: "Unavailable Brand",
      weight: 400,
      italic: false,
    });

    expect(Array.from(new Uint8Array(loaded.bytes))).toEqual([7, 8, 9]);
    expect(loaded.diagnostics).toEqual([
      fallbackDiagnostic,
      expect.objectContaining({
        code: "page-font-fetch-failed",
        severity: "warning",
      }),
    ]);
  });

  test("injects full Inter files for preview symbol fallback", async () => {
    const frame = await mountIframe(`
      <!doctype html>
      <html><head></head><body><p>Symbols → ✓</p></body></html>
    `);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();

    const prepared = await preparePreviewFontsForConvert(frameDocument!, {
      loadFaces: false,
    });
    const injectedCss = frameDocument!.querySelector<HTMLStyleElement>(
      "#web-to-figma-font-unify"
    )?.textContent;

    expect(injectedCss).toContain(
      "https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/Inter-Regular.woff2"
    );
    expect(injectedCss).toContain(
      "https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/Inter-Italic.woff2"
    );
    expect(injectedCss).toContain(
      "https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/Inter-BoldItalic.woff2"
    );
    expect(injectedCss).toContain("font-style: italic");
    expect(injectedCss).not.toContain("fontsource/fonts/inter@5");
    prepared.restore();
  });

  test("waits for both normal and italic Inter preview faces", async () => {
    const frame = await mountIframe(`
      <!doctype html>
      <html><head></head><body><p>Preview</p></body></html>
    `);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();
    const loadSpy = vi
      .spyOn(frameDocument!.fonts, "load")
      .mockResolvedValue([]);

    const prepared = await preparePreviewFontsForConvert(frameDocument!);
    const requestedFaces = loadSpy.mock.calls.map(([font]) => font);

    expect(requestedFaces).toContain('400 16px "Inter"');
    expect(requestedFaces).toContain('italic 400 16px "Inter"');
    prepared.restore();
  });

  test("loads explicit Inter requests from the pinned full static face", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(Uint8Array.from([4, 5, 6]).buffer, { status: 200 })
      );
    const loader = createCjkAwareFontLoader();

    const loaded = await loader({
      family: "Inter",
      weight: 400,
      italic: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/Inter-Regular.woff2"
    );
    expect(Array.from(new Uint8Array(loaded.bytes))).toEqual([4, 5, 6]);
    expect(loaded.resolvedWeight).toBe(400);
    expect(loaded.resolvedItalic).toBe(false);
  });

  test("retries an explicit Inter request after a transient fetch failure", async () => {
    const expectedBytes = Uint8Array.from([10, 11, 12]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(expectedBytes.buffer, { status: 200 })
      );
    const loader = createCjkAwareFontLoader();
    const request = {
      family: "Inter",
      weight: 400,
      italic: false,
    } as const;

    await expect(loader(request)).rejects.toThrow("503");
    const recovered = await loader(request);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Array.from(new Uint8Array(recovered.bytes))).toEqual(
      Array.from(expectedBytes)
    );
  });

  test.each([
    {
      requestedWeight: 600,
      italic: false,
      resolvedWeight: 700,
      filename: "Inter-Bold.woff2",
    },
    {
      requestedWeight: 800,
      italic: false,
      resolvedWeight: 900,
      filename: "Inter-Black.woff2",
    },
    {
      requestedWeight: 400,
      italic: true,
      resolvedWeight: 400,
      filename: "Inter-Italic.woff2",
    },
    {
      requestedWeight: 700,
      italic: true,
      resolvedWeight: 700,
      filename: "Inter-BoldItalic.woff2",
    },
  ])("maps Inter $requestedWeight italic=$italic to $filename", async ({
    requestedWeight,
    italic,
    resolvedWeight,
    filename,
  }) => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(Uint8Array.from([13]).buffer, { status: 200 })
      );
    const loader = createCjkAwareFontLoader();

    const loaded = await loader({
      family: "Inter",
      weight: requestedWeight,
      italic,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/${filename}`
    );
    expect(loaded.resolvedWeight).toBe(resolvedWeight);
    expect(loaded.resolvedItalic).toBe(italic);
  });

  test("keeps a page Inter subset separate from the full symbol fallback in the production converter", async () => {
    const pageInterUrl =
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-400-normal.woff2";
    const fullInterUrl =
      "https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/Inter-Regular.woff2";
    const frame = await mountIframe(`
      <!doctype html>
      <html>
        <head>
          <style>
            @font-face {
              font-family: "Inter";
              font-style: normal;
              font-weight: 400;
              src: url("${pageInterUrl}") format("woff2");
            }
          </style>
        </head>
        <body>
          <div id="symbols" style="width:320px;height:80px;font-family:'Inter',sans-serif;font-size:24px">A→✓</div>
        </body>
      </html>
    `);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();
    const element = frameDocument!.querySelector<HTMLElement>("#symbols");
    expect(element).not.toBeNull();

    const originalFetch = globalThis.fetch.bind(globalThis);
    const requestedUrls: Array<string> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      requestedUrls.push(String(input));
      return originalFetch(input, init);
    });

    setPreviewDocument(frameDocument);
    const result = await withPreviewConverter((converter) =>
      converter.convert({
        element: element!,
        width: 320,
        height: 80,
      })
    );

    const textChange = result.document.nodeChanges.find(
      (change) => change.type === "TEXT"
    );
    if (textChange?.type !== "TEXT") {
      throw new Error("expected TEXT node");
    }
    const glyphs = textChange.derivedTextData?.glyphs ?? [];
    expect(requestedUrls).toContain(pageInterUrl);
    expect(requestedUrls).toContain(fullInterUrl);
    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.code === "missing-glyph"
      )
    ).toEqual([]);
    expect(glyphs).toHaveLength(3);
    const [letter, arrow, check] = glyphs;
    expect(letter?.commandsBlob).not.toBe(arrow?.commandsBlob);
    expect(letter?.commandsBlob).not.toBe(check?.commandsBlob);
    expect(arrow?.commandsBlob).not.toBe(check?.commandsBlob);
    for (const glyph of glyphs) {
      expect(
        result.document.blobs[glyph.commandsBlob]?.bytes.length
      ).toBeGreaterThan(1);
    }
  });
});
