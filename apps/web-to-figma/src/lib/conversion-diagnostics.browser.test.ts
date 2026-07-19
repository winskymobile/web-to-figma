import { createFigmaConverter } from "@figit/dom-to-figma";
import { afterEach, describe, expect, test } from "vitest";
import { formatConversionWarning } from "./conversion-warning";
import { createPreviewFontLoader } from "./converter";

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
  for (const frame of mountedFrames.splice(0)) {
    frame.remove();
  }
});

describe("conversion degradation reporting", () => {
  test("flows a page-font fetch fallback through ConvertResult into the App warning formatter", async () => {
    const frame = await mountIframe(`
      <!doctype html>
      <html>
        <head>
          <style>
            @font-face {
              font-family: "Inter";
              font-style: normal;
              font-weight: 400;
              src: url("data:font/woff2;base64,%%%") format("woff2");
            }
          </style>
        </head>
        <body>
          <div id="copy-target" style="width:320px;height:80px;font-family:'Inter',sans-serif;font-size:24px">A→✓</div>
        </body>
      </html>
    `);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();
    const element = frameDocument!.querySelector<HTMLElement>("#copy-target");
    expect(element).not.toBeNull();

    const converter = createFigmaConverter({
      fontLoader: createPreviewFontLoader(() => frameDocument),
    });
    const result = await converter.convert({
      element: element!,
      width: 320,
      height: 80,
    });

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "page-font-fetch-failed",
        severity: "warning",
      }),
    ]);
    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.code === "missing-glyph"
      )
    ).toEqual([]);

    const warning = formatConversionWarning(
      {
        remappedElements: 0,
        loadedFaces: 0,
        failedFaces: 0,
        preservedCustomFamilies: 0,
      },
      result.diagnostics
    );
    expect(warning).toContain("1 个转换降级或错误");
  });
});
