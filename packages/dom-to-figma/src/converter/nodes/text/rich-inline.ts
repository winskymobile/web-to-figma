import {
  createSolidPaint,
  cssColorToFigmaColor,
  TRANSPARENT_COLOR_VALUES,
} from "../../styles/color";
import type { FigmaPaint } from "../../types";

const PHRASING = new Set([
  "em",
  "strong",
  "span",
  "i",
  "b",
  "small",
  "mark",
  "u",
  "s",
  "code",
  "a",
  "sub",
  "sup",
]);

export type RichInlineRun = {
  text: string;
  /** Computed color of this run (css string). */
  color: string;
};

export type RichInlineFlat = {
  characters: string;
  runs: Array<RichInlineRun>;
  /** True when more than one distinct non-default fill is needed. */
  needsCharacterStyles: boolean;
  hostColor: string;
};

function isTransparentBg(style: CSSStyleDeclaration): boolean {
  return TRANSPARENT_COLOR_VALUES.includes(style.backgroundColor);
}

function hostChromeBlocksFlatten(host: Element): boolean {
  const style = window.getComputedStyle(host);
  if (!isTransparentBg(style)) {
    return true;
  }
  if (style.padding !== "0px") {
    return true;
  }
  if (style.borderWidth !== "0px") {
    // borderWidth shorthand may be "0px" or multi; treat any non-zero
    const widths = [
      style.borderTopWidth,
      style.borderRightWidth,
      style.borderBottomWidth,
      style.borderLeftWidth,
    ];
    if (widths.some((w) => (Number.parseFloat(w) || 0) > 0)) {
      return true;
    }
  }
  return false;
}

function isBr(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName.toLowerCase() === "br"
  );
}

function isAllowedPhrasing(el: Element, depth: number): boolean {
  if (depth > 2) {
    return false;
  }
  const tag = el.tagName.toLowerCase();
  if (!PHRASING.has(tag)) {
    return false;
  }
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      continue;
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (!isAllowedPhrasing(child as Element, depth + 1)) {
        return false;
      }
      continue;
    }
    return false;
  }
  return true;
}

/** Whether host children form a simple rich-inline tree eligible for flattening. */
export function isRichInlineHost(host: Element): boolean {
  if (hostChromeBlocksFlatten(host)) {
    return false;
  }
  const children = Array.from(host.childNodes);
  if (children.length === 0) {
    return false;
  }

  let hasBr = false;

  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      // text nodes allowed
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    const el = child as Element;
    if (isBr(el)) {
      hasBr = true;
      continue;
    }
    if (!isAllowedPhrasing(el, 1)) {
      return false;
    }
  }

  // v1: require hard line break so soft mid-line wraps with colored spans
  // keep the existing multi-layer / split path. Emphasis alone is not enough.
  if (!hasBr) {
    return false;
  }
  // At least some text content.
  if (!(host.textContent || "").replace(/\s/g, "").length) {
    return false;
  }
  return true;
}

function appendRun(
  runs: Array<RichInlineRun>,
  text: string,
  color: string
): void {
  if (!text) {
    return;
  }
  const lastIdx = runs.length - 1;
  const last = lastIdx >= 0 ? runs[lastIdx] : undefined;
  if (last && last.color === color) {
    last.text += text;
    return;
  }
  runs.push({ text, color });
}

function walkCollect(
  node: Node,
  inheritedColor: string,
  runs: Array<RichInlineRun>
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent || "";
    // Drop pretty-print-only whitespace between tags; keep real spaces.
    if (/^[\s\u00a0]*$/.test(raw)) {
      // Significant only if it is a single inter-word space with neighbors —
      // pure indent/newlines are ignored for title-like hosts.
      if (raw.includes("\n") || raw.includes("\r") || raw.length > 1) {
        return;
      }
      // single space may be intentional between inlines
      if (raw === " ") {
        appendRun(runs, " ", inheritedColor);
      }
      return;
    }
    // Trim line-indent on multi-line pretty-printed chunks but keep content.
    const cleaned = raw.replace(/^[^\S\n]+/gm, "").replace(/\n+$/g, "");
    appendRun(runs, cleaned, inheritedColor);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const el = node as Element;
  if (isBr(el)) {
    appendRun(runs, "\n", inheritedColor);
    return;
  }
  const style = window.getComputedStyle(el);
  const color = style.color || inheritedColor;
  for (const child of Array.from(el.childNodes)) {
    walkCollect(child, color, runs);
  }
}

/**
 * Flatten a rich-inline host into characters + style runs.
 * Returns null if host is not eligible.
 */
export function flattenRichInline(host: Element): RichInlineFlat | null {
  if (!isRichInlineHost(host)) {
    return null;
  }
  const hostStyle = window.getComputedStyle(host);
  const hostColor = hostStyle.color || "rgb(0, 0, 0)";
  const runs: Array<RichInlineRun> = [];
  for (const child of Array.from(host.childNodes)) {
    walkCollect(child, hostColor, runs);
  }
  // Trim leading/trailing whitespace runs from pretty-printed hosts.
  while (runs.length > 0 && /^[\s\n\r]*$/.test(runs[0]?.text ?? "")) {
    runs.shift();
  }
  while (runs.length > 0 && /^[\s\n\r]*$/.test(runs.at(-1)?.text ?? "")) {
    runs.pop();
  }
  if (runs[0]) {
    runs[0] = {
      ...runs[0],
      text: runs[0].text.replace(/^[\s\n\r]+/, ""),
    };
  }
  const lastIdx = runs.length - 1;
  const last = lastIdx >= 0 ? runs[lastIdx] : undefined;
  if (last) {
    runs[lastIdx] = {
      ...last,
      text: last.text.replace(/[\s\n\r]+$/, ""),
    };
  }
  const characters = runs.map((r) => r.text).join("");
  if (!characters.length) {
    return null;
  }
  const colors = new Set(runs.map((r) => r.color));
  return {
    characters,
    runs,
    needsCharacterStyles: colors.size > 1,
    hostColor,
  };
}

export type BuiltCharacterStyles = {
  characterStyleIDs: Array<number>;
  styleOverrideTable: Array<{
    styleID: number;
    fillPaints: Array<FigmaPaint>;
  }>;
};

/** Map runs to Figma characterStyleIDs (0 = host fill) and override table. */
export function buildCharacterStyles(
  flat: RichInlineFlat
): BuiltCharacterStyles | null {
  if (!flat.needsCharacterStyles) {
    return null;
  }

  const hostParsed = cssColorToFigmaColor(flat.hostColor);
  const colorToStyleId = new Map<string, number>();
  colorToStyleId.set(flat.hostColor, 0);

  const styleOverrideTable: Array<{
    styleID: number;
    fillPaints: Array<FigmaPaint>;
  }> = [];
  let nextId = 1;

  for (const run of flat.runs) {
    if (colorToStyleId.has(run.color)) {
      continue;
    }
    const parsed = cssColorToFigmaColor(run.color);
    if (!parsed) {
      colorToStyleId.set(run.color, 0);
      continue;
    }
    // Same as host → 0
    if (
      hostParsed &&
      Math.abs(parsed.color.r - hostParsed.color.r) < 0.002 &&
      Math.abs(parsed.color.g - hostParsed.color.g) < 0.002 &&
      Math.abs(parsed.color.b - hostParsed.color.b) < 0.002 &&
      Math.abs(parsed.opacity - hostParsed.opacity) < 0.002
    ) {
      colorToStyleId.set(run.color, 0);
      continue;
    }
    const id = nextId;
    nextId += 1;
    colorToStyleId.set(run.color, id);
    styleOverrideTable.push({
      styleID: id,
      fillPaints: [createSolidPaint(parsed.color, parsed.opacity)],
    });
  }

  if (styleOverrideTable.length === 0) {
    return null;
  }

  const characterStyleIDs: Array<number> = [];
  for (const run of flat.runs) {
    const id = colorToStyleId.get(run.color) ?? 0;
    for (const _char of run.text) {
      characterStyleIDs.push(id);
    }
  }

  return { characterStyleIDs, styleOverrideTable };
}
