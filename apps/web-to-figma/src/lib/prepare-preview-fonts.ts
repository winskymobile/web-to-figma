/**
 * Align preview layout fonts with the fonts used for Figma glyph embedding.
 *
 * Without this, the browser lays out text with system fonts (PingFang SC, …)
 * while the converter embeds Noto Sans SC outlines → different advance widths
 * → different wrap points / overflow than the live preview.
 */

const FONT_CDN = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5";

function face(weight: number, subset: string): string {
  return `
@font-face {
  font-family: "Noto Sans SC";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${FONT_CDN}/${subset}-${weight}-normal.woff2") format("woff2");
}`;
}

const WEIGHTS = [300, 400, 500, 700, 900];
const NOTO_SC_CSS = [
  ...WEIGHTS.map((w) => face(w, "chinese-simplified")),
  ...WEIGHTS.map((w) => face(w, "latin")),
].join("\n");

const OVERRIDE_STYLE_ID = "web-to-figma-font-unify";

const SYSTEM_FAMILY_RE =
  /PingFang|Hiragino|Microsoft YaHei|Microsoft JhengHei|SimHei|SimSun|STHeiti|STSong|WenQuanYi|Source Han Sans|Noto Sans CJK|system-ui|-apple-system|BlinkMacSystemFont|Segoe UI|Roboto|Helvetica Neue|Helvetica|Arial|sans-serif/i;

export type PrepareFontsResult = {
  restore: () => void;
};

/**
 * Inject Noto Sans SC into the preview document and remap system / generic
 * font stacks onto it, then wait for the fonts to load so layout reflows.
 */
export async function preparePreviewFontsForConvert(
  doc: Document
): Promise<PrepareFontsResult> {
  const head = doc.head ?? doc.documentElement;
  if (!head) {
    return { restore: () => undefined };
  }

  doc.getElementById(OVERRIDE_STYLE_ID)?.remove();

  const style = doc.createElement("style");
  style.id = OVERRIDE_STYLE_ID;
  style.textContent =
    NOTO_SC_CSS +
    `
html, body {
  font-family: "Noto Sans SC", system-ui, sans-serif !important;
}
body *:not(script):not(style):not(noscript) {
  font-family: "Noto Sans SC", system-ui, sans-serif !important;
}
`;
  head.appendChild(style);

  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("[style]"))) {
    const fam = el.style.fontFamily;
    if (fam && SYSTEM_FAMILY_RE.test(fam)) {
      el.dataset.lsOrigFont = fam;
      el.style.fontFamily = '"Noto Sans SC", sans-serif';
    }
  }

  try {
    if (doc.fonts?.load) {
      await Promise.race([
        Promise.all([
          ...WEIGHTS.flatMap((w) => [
            doc.fonts.load(`${w} 16px "Noto Sans SC"`),
            doc.fonts.load(`${w} 32px "Noto Sans SC"`),
            doc.fonts.load(`${w} 48px "Noto Sans SC"`),
          ]),
          doc.fonts.ready,
        ]),
        new Promise((r) => setTimeout(r, 10_000)),
      ]);
    } else {
      await new Promise((r) => setTimeout(r, 800));
    }
  } catch {
    // ignore network failures; conversion still proceeds with best effort
  }

  // Double rAF so layout settles after font swap
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  if (doc.body) {
    // Force layout reflow after font swap for accurate convert metrics.
    doc.body.getBoundingClientRect();
  }

  return {
    restore: () => {
      doc.getElementById(OVERRIDE_STYLE_ID)?.remove();
      for (const el of Array.from(
        doc.querySelectorAll<HTMLElement>("[data-ls-orig-font]")
      )) {
        el.style.fontFamily = el.dataset.lsOrigFont ?? "";
        delete el.dataset.lsOrigFont;
      }
    },
  };
}
