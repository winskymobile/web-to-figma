import { afterEach, describe, expect, it } from "vitest";
import { HEBAO_INDEX_HTML } from "./__fixtures__/hebao-index.html";
import { createTestFontLoader } from "./__fixtures__/loaders";
import { tryInferAutoLayout } from "./converter/layout/infer";
import { createFigmaConverter } from "./figma";

afterEach(() => {
  document.body.innerHTML = "";
});

function loadHebao() {
  const style = HEBAO_INDEX_HTML.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const body =
    HEBAO_INDEX_HTML.match(/<body>([\s\S]*?)<script>/)?.[1] ??
    HEBAO_INDEX_HTML.match(/<body>([\s\S]*?)<\/body>/)?.[1] ??
    "";
  document.documentElement.innerHTML = `<head><style>${style}</style></head><body style="margin:0;width:430px">${body}</body>`;
  const page = document.querySelector(".page") as HTMLElement | null;
  if (page) {
    page.style.width = "430px";
  }
  // Force layout so measured boxes are up to date before inference.
  const _layout = document.body.offsetHeight;
  if (_layout < 0) {
    throw new Error("unexpected layout height");
  }
}

describe("hebao index auto-layout targets", () => {
  it("route-strip pills, quick-nav, path-line, and outer frames become stacks", async () => {
    loadHebao();

    const routeStrip = tryInferAutoLayout(
      document.querySelector(".route-strip") as Element
    );
    expect(routeStrip.ok).toBe(true);
    if (routeStrip.ok) {
      expect(routeStrip.value.stack.stackMode).toBe("HORIZONTAL");
      expect(routeStrip.value.stack.stackWrap).toBe("WRAP");
    }

    for (const span of document.querySelectorAll(".route-strip span")) {
      const r = tryInferAutoLayout(span);
      expect(r.ok, "route-strip span").toBe(true);
      if (r.ok) {
        expect(r.value.stack.stackMode).toBe("HORIZONTAL");
        expect(r.value.stack.stackCounterAlignItems).toBe("CENTER");
      }
    }

    const quickNav = tryInferAutoLayout(
      document.querySelector(".quick-nav") as Element
    );
    expect(quickNav.ok).toBe(true);
    if (quickNav.ok) {
      expect(quickNav.value.stack.stackMode).toBe("HORIZONTAL");
    }

    for (const a of document.querySelectorAll(".quick-nav a")) {
      const r = tryInferAutoLayout(a);
      expect(r.ok, "quick-nav a").toBe(true);
      if (r.ok) {
        expect(r.value.stack.stackMode).toBe("HORIZONTAL");
        expect(r.value.stack.stackPrimaryAlignItems).toBe("CENTER");
        expect(r.value.stack.stackCounterAlignItems).toBe("CENTER");
      }
    }

    for (const path of document.querySelectorAll(".path-line")) {
      const r = tryInferAutoLayout(path);
      expect(
        r.ok,
        `path-line ${(path as HTMLElement).innerText.slice(0, 20)}`
      ).toBe(true);
      if (r.ok) {
        expect(r.value.stack.stackMode).toBe("HORIZONTAL");
        expect(r.value.stack.stackCounterAlignItems).toBe("CENTER");
      }
    }

    for (const fig of document.querySelectorAll("figure")) {
      const r = tryInferAutoLayout(fig);
      expect(r.ok, "figure").toBe(true);
      if (r.ok) {
        expect(r.value.stack.stackMode).toBe("VERTICAL");
      }
    }

    // End-to-end convert of route-strip + path-line roots
    const figma = createFigmaConverter({
      layout: "auto",
      fontLoader: createTestFontLoader(),
    });
    for (const sel of [".route-strip", ".path-line", ".quick-nav"]) {
      const el = document.querySelector(sel) as HTMLElement;
      const rect = el.getBoundingClientRect();
      const result = await figma.convert({
        element: el,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      });
      const root = result.document.nodeChanges.find(
        (c: any) => c.guid?.localID === 3
      ) as any;
      expect(root?.stackMode, sel).not.toBe("NONE");
      expect(root?.stackMode, sel).toBe("HORIZONTAL");
    }
  });
});
