import { createFigmaConverter, type FontLoader } from "@figit/dom-to-figma";

import { createCjkAwareFontLoader } from "./cjk-font-loader";
import { createPreviewConverterStore } from "./converter-store";
import { createPageFontLoader } from "./page-font-loader";

export function createPreviewFontLoader(
  getDocument: () => Document | null | undefined
): FontLoader {
  const cjkFallback = createCjkAwareFontLoader();
  return createPageFontLoader({
    fallbackLoader: cjkFallback,
    getDocument: () => getDocument() ?? document,
  });
}

const converterStore = createPreviewConverterStore((getDocument) => {
  const fontLoader = createPreviewFontLoader(getDocument);
  // Match upstream default: infer Figma auto-layout when possible.
  return createFigmaConverter({
    layout: "auto",
    fontLoader,
  });
});

export function setPreviewDocument(doc: Document | null) {
  converterStore.setDocument(doc);
}

/**
 * Compatibility access for synchronous callers. New async conversions must use
 * `withPreviewConverter` so document/cache state stays leased until completion.
 */
export function getConverter() {
  return converterStore.getConverter();
}

export function withPreviewConverter<Result>(
  operation: (
    converter: ReturnType<typeof createFigmaConverter>
  ) => Result | Promise<Result>
) {
  return converterStore.withConverter(operation);
}
