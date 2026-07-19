import { afterEach, describe, expect, it } from "vitest";
import { createTestFontLoader } from "./__fixtures__/loaders";
import type { FigmaNodeChange } from "./converter/types";
import { createFigmaConverter } from "./figma";

afterEach(() => {
  document.body.innerHTML = "";
  for (const n of document.querySelectorAll("style[data-pseudo-test]")) {
    n.remove();
  }
});

const convert = async (html: string, css: string) => {
  const style = document.createElement("style");
  style.dataset.pseudoTest = "1";
  style.textContent = css;
  document.head.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.style.width = "400px";
  wrapper.style.height = "400px";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  const element = wrapper.firstElementChild as HTMLElement;
  const layout = element.offsetHeight;
  if (layout < 0) {
    throw new Error("bad layout");
  }
  const figma = createFigmaConverter({
    layout: "absolute",
    fontLoader: createTestFontLoader(),
  });
  const rect = element.getBoundingClientRect();
  return await figma.convert({
    element,
    width: Math.ceil(rect.width) || 320,
    height: Math.ceil(rect.height) || 200,
  });
};

const byName = (changes: ReadonlyArray<FigmaNodeChange>, name: string) =>
  changes.find((c) => "name" in c && (c as { name?: string }).name === name);

describe("decorative absolute pseudos", () => {
  it("emits ::after border accent as a child frame", async () => {
    const result = await convert(
      `<div id="host" style="position:relative;width:200px;height:120px;background:#1188f2;overflow:hidden">
        <span style="position:relative;z-index:1;color:#fff">title</span>
      </div>`,
      `#host::after {
        content: "";
        position: absolute;
        right: -20px;
        bottom: -20px;
        width: 80px;
        height: 80px;
        border: 10px solid rgba(255, 227, 109, 0.8);
        border-radius: 16px;
        transform: rotate(18deg);
        pointer-events: none;
      }`
    );
    const after = byName(result.document.nodeChanges, "div::after");
    expect(after).toBeTruthy();
    expect(after).toMatchObject({
      type: "FRAME",
      stackPositioning: "ABSOLUTE",
    });
    expect((after as { size?: { x: number } }).size?.x).toBeCloseTo(80, 0);
    expect((after as { strokeWeight?: number }).strokeWeight).toBeGreaterThan(
      0
    );
  });

  it("emits full-bleed ::before gradient decoration under content", async () => {
    const result = await convert(
      `<div id="hero" style="position:relative;width:240px;height:160px;background:#0d76e7;overflow:hidden">
        <p style="position:relative;z-index:2;margin:0;color:#fff">Hello</p>
      </div>`,
      `#hero::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        opacity: 0.75;
        pointer-events: none;
        background:
          linear-gradient(135deg, transparent 0 42%, rgba(255,255,255,0.12) 42% 47%, transparent 47%),
          linear-gradient(90deg, rgba(255,255,255,0.08), transparent);
      }`
    );
    const changes = result.document.nodeChanges;
    const before = byName(changes, "div::before");
    expect(before).toBeTruthy();
    const fills = (before as { fillPaints?: Array<unknown> }).fillPaints ?? [];
    expect(fills.length).toBeGreaterThan(0);
    expect((before as { stackPositioning?: string }).stackPositioning).toBe(
      "ABSOLUTE"
    );
    const beforeIdx = Number(
      (before as { parentIndex?: { position?: string } }).parentIndex?.position
    );
    const child = changes.find(
      (c) =>
        "parentIndex" in c &&
        (c as { parentIndex?: { guid?: { localID?: number } } }).parentIndex
          ?.guid?.localID ===
          (before as { parentIndex?: { guid?: { localID?: number } } })
            .parentIndex?.guid?.localID &&
        (c as { name?: string }).name !== "div::before"
    );
    if (child) {
      const childIdx = Number(
        (child as { parentIndex?: { position?: string } }).parentIndex?.position
      );
      expect(beforeIdx).toBeLessThan(childIdx);
    }
  });

  it("emits negative z-index ::after behind content siblings", async () => {
    const result = await convert(
      `<header id="hero" style="position:relative;width:240px;height:160px;background:#0d76e7;overflow:hidden;isolation:isolate">
        <p style="position:relative;z-index:2;margin:0;color:#fff">Hello</p>
      </header>`,
      `#hero::before,
       #hero::after {
        content: "";
        position: absolute;
        z-index: -1;
        pointer-events: none;
      }
      #hero::before {
        inset: 0;
        background: linear-gradient(90deg, rgba(255,255,255,0.2), transparent);
        opacity: 0.75;
      }
      #hero::after {
        right: -20px;
        bottom: -20px;
        width: 80px;
        height: 80px;
        border: 10px solid rgba(255, 227, 109, 0.8);
        border-radius: 16px;
        transform: rotate(18deg);
      }`
    );
    const changes = result.document.nodeChanges;
    const before =
      byName(changes, "header::before") ?? byName(changes, "div::before");
    const after =
      byName(changes, "header::after") ?? byName(changes, "div::after");
    // host may be named Header
    const hostChildren = changes.filter((c) => {
      const parentLocal = (
        c as { parentIndex?: { guid?: { localID?: number } } }
      ).parentIndex?.guid?.localID;
      const afterParent = (
        after as { parentIndex?: { guid?: { localID?: number } } } | undefined
      )?.parentIndex?.guid?.localID;
      return parentLocal !== undefined && parentLocal === afterParent;
    });
    expect(after).toBeTruthy();
    expect(before).toBeTruthy();
    const idx = (n: unknown) =>
      Number(
        (n as { parentIndex?: { position?: string } }).parentIndex?.position
      );
    // both decorations behind content → indices less than at least one content child
    const content = hostChildren.find(
      (c) =>
        (c as { name?: string }).name !== "header::before" &&
        (c as { name?: string }).name !== "header::after" &&
        (c as { name?: string }).name !== "div::before" &&
        (c as { name?: string }).name !== "div::after"
    );
    expect(content).toBeTruthy();
    expect(idx(before)).toBeLessThan(idx(content));
    expect(idx(after)).toBeLessThan(idx(content));
    // before under after when both z=-1
    expect(idx(before)).toBeLessThan(idx(after));
  });

  it("skips masked decorative pseudo without inventing a node", async () => {
    const result = await convert(
      `<div id="card" style="position:relative;width:200px;height:100px;background:#fff">
        <span>x</span>
      </div>`,
      `#card::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(#000, #fff);
        -webkit-mask-image: linear-gradient(#000, transparent);
        mask-image: linear-gradient(#000, transparent);
      }`
    );
    expect(byName(result.document.nodeChanges, "div::before")).toBeFalsy();
    expect(
      result.diagnostics.some(
        (d) => d.code === "pseudo-skipped" && d.reason === "masked"
      )
    ).toBe(true);
  });
});
