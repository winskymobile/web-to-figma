import { createFigmaConverter } from "@figit/dom-to-figma";

import { createCjkAwareFontLoader } from "./cjk-font-loader";
import { createPageFontLoader } from "./page-font-loader";

let previewDocument: Document | null = null;

export function setPreviewDocument(doc: Document | null) {
  previewDocument = doc;
}

export function getConverter() {
  // Rebuild each time is expensive; keep singleton but rebind page fonts
  // via getDocument() so each convert scans the current preview iframe.
  return getOrCreate();
}

let instance: ReturnType<typeof createFigmaConverter> | null = null;

function getOrCreate() {
  if (!instance) {
    const cjkFallback = createCjkAwareFontLoader();
    const fontLoader = createPageFontLoader({
      fallbackLoader: cjkFallback,
      getDocument: () => previewDocument ?? document,
    });
    // Match upstream default: infer Figma auto-layout when possible.
    instance = createFigmaConverter({
      layout: "auto",
      fontLoader,
    });
  }
  return instance;
}
