import {
  getFullInterFaceUrl,
  SHARED_FONT_WEIGHTS,
  type SharedFontWeight,
} from "./inter-font";

/**
 * Align preview layout fonts with converter embedding sources.
 *
 * Strategy (phase 1):
 * - Inject shared fallbacks: Noto Sans SC (CJK) + version-pinned full Inter
 *   static faces (latin/symbols, no unicode-range subset).
 * - Remap only system/generic stacks to those fallbacks.
 * - Keep page custom families so @font-face brand fonts still reflow.
 */

const NOTO_CDN = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5";
const OVERRIDE_STYLE_ID = "web-to-figma-font-unify";
const FALLBACK_STACK = '"Noto Sans SC", "Inter", sans-serif';

/** Primary families we treat as system / generic and may remap. */
const SYSTEM_PRIMARY_RE =
  /^(?:pingfang(?:\s+sc)?|hiragino\s+sans(?:\s+gb)?|microsoft\s+yahei|microsoft\s+jhenghei|simhei|simsun|stheiti|stsong|wenquanyi.*|source\s+han\s+sans(?:\s+sc)?|noto\s+sans\s+cjk(?:\s+sc)?|system-ui|-apple-system|blinkmacsystemfont|segoe\s+ui|roboto|helvetica\s+neue|helvetica|arial|sans-serif|serif|monospace|ui-sans-serif|ui-serif|ui-monospace|emoji|fangsong)$/i;

export type PrepareFontsStats = {
  remappedElements: number;
  loadedFaces: number;
  failedFaces: number;
  preservedCustomFamilies: number;
};

export type PrepareFontsResult = {
  restore: () => void;
  stats: PrepareFontsStats;
};

type PrepareFontsOptions = {
  loadFaces?: boolean;
};

function notoFace(weight: number, subset: string): string {
  return `
@font-face {
  font-family: "Noto Sans SC";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${NOTO_CDN}/${subset}-${weight}-normal.woff2") format("woff2");
}`;
}

function interFace(weight: SharedFontWeight, italic: boolean): string {
  return `
@font-face {
  font-family: "Inter";
  font-style: ${italic ? "italic" : "normal"};
  font-weight: ${weight};
  font-display: swap;
  src: url("${getFullInterFaceUrl(weight, italic)}") format("woff2");
}`;
}

const INJECTED_FACE_CSS = [
  ...SHARED_FONT_WEIGHTS.map((weight) =>
    notoFace(weight, "chinese-simplified")
  ),
  ...SHARED_FONT_WEIGHTS.map((weight) => notoFace(weight, "latin")),
  ...SHARED_FONT_WEIGHTS.flatMap((weight) => [
    interFace(weight, false),
    interFace(weight, true),
  ]),
].join("\n");

function primaryFamily(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "");
}

function isSystemPrimary(family: string): boolean {
  if (!family) {
    return true;
  }
  return SYSTEM_PRIMARY_RE.test(family.trim());
}

function shouldRemapElement(el: Element): el is HTMLElement {
  const HTMLElementConstructor = el.ownerDocument.defaultView?.HTMLElement;
  if (
    HTMLElementConstructor
      ? !(el instanceof HTMLElementConstructor)
      : el.namespaceURI !== "http://www.w3.org/1999/xhtml"
  ) {
    return false;
  }
  const tag = el.tagName;
  if (
    tag === "SCRIPT" ||
    tag === "STYLE" ||
    tag === "NOSCRIPT" ||
    tag === "BR" ||
    tag === "HR" ||
    tag === "IMG" ||
    tag === "SVG" ||
    tag === "PATH" ||
    tag === "VIDEO" ||
    tag === "AUDIO" ||
    tag === "CANVAS" ||
    tag === "IFRAME"
  ) {
    return false;
  }
  // Skip empty non-text containers without text content for a bit of speed
  // but still remap parents that carry style for children.
  return true;
}

async function loadFace(doc: Document, css: string): Promise<"ok" | "fail"> {
  try {
    if (!doc.fonts?.load) {
      return "ok";
    }
    await Promise.race([
      doc.fonts.load(css),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("font load timeout")), 8000)
      ),
    ]);
    return "ok";
  } catch {
    return "fail";
  }
}

/**
 * Inject shared fallbacks, selectively remap system stacks, wait for faces.
 */
export async function preparePreviewFontsForConvert(
  doc: Document,
  { loadFaces = true }: PrepareFontsOptions = {}
): Promise<PrepareFontsResult> {
  const stats: PrepareFontsStats = {
    remappedElements: 0,
    loadedFaces: 0,
    failedFaces: 0,
    preservedCustomFamilies: 0,
  };

  const head = doc.head ?? doc.documentElement;
  if (!head) {
    return { restore: () => undefined, stats };
  }

  doc.getElementById(OVERRIDE_STYLE_ID)?.remove();

  const style = doc.createElement("style");
  style.id = OVERRIDE_STYLE_ID;
  // Only define faces + a soft body fallback when body itself is system-level.
  // No universal * !important override.
  style.textContent = `${INJECTED_FACE_CSS}
`;
  head.appendChild(style);

  const root = doc.body ?? doc.documentElement;
  const candidates = root
    ? [root, ...Array.from(root.querySelectorAll<Element>("*"))]
    : [];

  for (const el of candidates) {
    if (!shouldRemapElement(el)) {
      continue;
    }
    let computedFamily = "";
    try {
      computedFamily = doc.defaultView?.getComputedStyle(el).fontFamily ?? "";
    } catch {
      continue;
    }
    const primary = primaryFamily(computedFamily);
    if (!isSystemPrimary(primary)) {
      stats.preservedCustomFamilies += 1;
      continue;
    }

    // Prefer not to rewrite elements that already resolved to Noto/Inter.
    if (
      primary.toLowerCase() === "noto sans sc" ||
      primary.toLowerCase() === "inter"
    ) {
      continue;
    }

    el.dataset.lsOrigFont = el.style.fontFamily || "";
    el.dataset.lsFontRemapped = "1";
    el.style.fontFamily = FALLBACK_STACK;
    stats.remappedElements += 1;
  }

  // If html/body had no explicit custom face, ensure base stack is fallback.
  if (doc.documentElement && !doc.documentElement.dataset.lsFontRemapped) {
    const htmlPrimary = primaryFamily(
      doc.defaultView?.getComputedStyle(doc.documentElement).fontFamily ?? ""
    );
    if (isSystemPrimary(htmlPrimary)) {
      doc.documentElement.dataset.lsOrigFont =
        doc.documentElement.style.fontFamily || "";
      doc.documentElement.dataset.lsFontRemapped = "1";
      doc.documentElement.style.fontFamily = FALLBACK_STACK;
      stats.remappedElements += 1;
    }
  }

  const loads: Array<Promise<"ok" | "fail">> = [];
  if (loadFaces) {
    for (const weight of SHARED_FONT_WEIGHTS) {
      loads.push(loadFace(doc, `${weight} 16px "Noto Sans SC"`));
      loads.push(loadFace(doc, `${weight} 16px "Inter"`));
      loads.push(loadFace(doc, `italic ${weight} 16px "Inter"`));
    }
    // Also nudge fonts.ready
    if (doc.fonts?.ready) {
      loads.push(
        Promise.race([
          doc.fonts.ready.then(() => "ok" as const),
          new Promise<"fail">((r) => setTimeout(() => r("fail"), 10_000)),
        ])
      );
    }
  }

  const results = await Promise.all(loads);
  for (const r of results) {
    if (r === "ok") {
      stats.loadedFaces += 1;
    } else {
      stats.failedFaces += 1;
    }
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  if (doc.body) {
    doc.body.getBoundingClientRect();
  }

  return {
    stats,
    restore: () => {
      doc.getElementById(OVERRIDE_STYLE_ID)?.remove();
      for (const el of Array.from(
        doc.querySelectorAll<HTMLElement>("[data-ls-font-remapped]")
      )) {
        const orig = el.dataset.lsOrigFont ?? "";
        if (orig) {
          el.style.fontFamily = orig;
        } else {
          el.style.removeProperty("font-family");
        }
        delete el.dataset.lsOrigFont;
        delete el.dataset.lsFontRemapped;
      }
    },
  };
}
