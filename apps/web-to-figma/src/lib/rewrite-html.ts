import type { AssetIndex } from "./asset-map";
import {
  dirnameKey,
  isExternalOrSpecialUrl,
  lookupAsset,
  normalizeAssetKey,
} from "./asset-map";

export type RewriteResult = {
  html: string;
  objectUrls: Array<string>;
  missing: Array<string>;
  rewrittenCount: number;
  /** Paths successfully resolved (for UI diagnostics). */
  resolved: Array<string>;
};

const ATTR_PATTERN = /\b(href|src|poster|data-src)\s*=\s*(["'])([^"']*?)\2/gi;

const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

const SRCSET_PATTERN = /\bsrcset\s*=\s*(["'])([^"']*?)\1/gi;

const LINK_STYLESHEET_PATTERN =
  /<link\b[^>]*\brel\s*=\s*(["'])stylesheet\1[^>]*>/gi;

function collectUnique(list: Array<string>, ref: string) {
  const key = normalizeAssetKey(ref);
  if (key && !list.includes(key)) {
    list.push(key);
  }
}

async function rewriteCssUrls(
  cssText: string,
  index: AssetIndex,
  cssDir: string,
  objectUrls: Array<string>,
  blobCache: Map<string, string>,
  missing: Array<string>,
  resolved: Array<string>,
  counters: { rewritten: number }
): Promise<string> {
  const matches = [...cssText.matchAll(CSS_URL_PATTERN)];
  if (matches.length === 0) {
    return cssText;
  }

  let cursor = 0;
  let out = "";
  for (const m of matches) {
    const full = m[0];
    const quote = m[1] ?? "";
    const value = m[2]!;
    const start = m.index ?? 0;
    out += cssText.slice(cursor, start);
    const resolvedUrl = await resolveRef(
      value,
      index,
      cssDir,
      objectUrls,
      blobCache,
      missing,
      resolved,
      counters
    );
    out += `url(${quote}${resolvedUrl}${quote})`;
    cursor = start + full.length;
  }
  out += cssText.slice(cursor);
  return out;
}

async function resolveRef(
  raw: string,
  index: AssetIndex,
  fromDir: string,
  objectUrls: Array<string>,
  blobCache: Map<string, string>,
  missing: Array<string>,
  resolved: Array<string>,
  counters: { rewritten: number }
): Promise<string> {
  const ref = raw.trim();
  if (!ref || isExternalOrSpecialUrl(ref)) {
    return raw;
  }

  const bare = ref.split(/[?#]/)[0] ?? ref;
  if (!bare || isExternalOrSpecialUrl(bare)) {
    return raw;
  }

  const cacheKey = `${fromDir}::${normalizeAssetKey(bare)}`;
  const cached = blobCache.get(cacheKey);
  if (cached) {
    counters.rewritten += 1;
    return cached;
  }

  const file = lookupAsset(index, bare, fromDir);
  if (!file) {
    collectUnique(missing, fromDir ? `${fromDir}/${bare}` : bare);
    return raw;
  }

  // Prefer inlining stylesheets handled separately; here create blob URL.
  const url = URL.createObjectURL(file);
  objectUrls.push(url);
  blobCache.set(cacheKey, url);
  counters.rewritten += 1;
  collectUnique(resolved, normalizeAssetKey(bare));
  return url;
}

/**
 * Rewrite relative asset references. Stylesheets are inlined so nested
 * CSS url(...) resolve against the CSS file location (blob <link> cannot).
 */
export async function rewriteHtmlDocument(
  html: string,
  index: AssetIndex
): Promise<RewriteResult> {
  const objectUrls: Array<string> = [];
  const missing: Array<string> = [];
  const resolved: Array<string> = [];
  const blobCache = new Map<string, string>();
  const counters = { rewritten: 0 };

  let out = html;

  // 1) Inline <link rel="stylesheet" href="..."> so CSS-relative urls work
  {
    const matches = [...out.matchAll(LINK_STYLESHEET_PATTERN)];
    // process from end so indices stay valid
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const m = matches[i]!;
      const tag = m[0];
      const start = m.index ?? 0;
      const hrefMatch = tag.match(/\bhref\s*=\s*(["'])([^"']*?)\1/i);
      if (!hrefMatch) {
        continue;
      }
      const href = hrefMatch[2]?.trim();
      if (!href || isExternalOrSpecialUrl(href)) {
        continue;
      }

      const bare = href.split(/[?#]/)[0] ?? href;
      const file = lookupAsset(index, bare, "");
      if (!file) {
        collectUnique(missing, bare);
        continue;
      }

      const cssText = await file.text();
      // Find key used for dirname — prefer normalized bare, else file path guess
      const cssKey =
        normalizeAssetKey(bare) ||
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      const cssDir = dirnameKey(cssKey);
      const rewrittenCss = await rewriteCssUrls(
        cssText,
        index,
        cssDir,
        objectUrls,
        blobCache,
        missing,
        resolved,
        counters
      );
      counters.rewritten += 1;
      collectUnique(resolved, normalizeAssetKey(bare));
      const styleTag = `<style data-inlined-from="${normalizeAssetKey(bare)}">\n${rewrittenCss}\n</style>`;
      out = out.slice(0, start) + styleTag + out.slice(start + tag.length);
    }
  }

  async function replaceAll(
    input: string,
    pattern: RegExp,
    replacer: (match: RegExpMatchArray) => Promise<string>
  ): Promise<string> {
    const matches = [...input.matchAll(pattern)];
    if (matches.length === 0) {
      return input;
    }
    let cursor = 0;
    let rebuilt = "";
    for (const m of matches) {
      const full = m[0];
      const start = m.index ?? 0;
      rebuilt += input.slice(cursor, start);
      rebuilt += await replacer(m);
      cursor = start + full.length;
    }
    rebuilt += input.slice(cursor);
    return rebuilt;
  }

  // 2) href/src/poster (remaining non-stylesheet links, images, scripts…)
  out = await replaceAll(out, ATTR_PATTERN, async (m) => {
    const attr = m[1]!;
    const quote = m[2]!;
    const value = m[3]!;
    // Skip stylesheet hrefs already inlined (if any remain, still resolve)
    const newValue = await resolveRef(
      value,
      index,
      "",
      objectUrls,
      blobCache,
      missing,
      resolved,
      counters
    );
    return `${attr}=${quote}${newValue}${quote}`;
  });

  out = await replaceAll(out, SRCSET_PATTERN, async (m) => {
    const quote = m[1]!;
    const value = m[2]!;
    const parts = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next: Array<string> = [];
    for (const part of parts) {
      const [urlPart, ...rest] = part.split(/\s+/);
      if (!urlPart) {
        continue;
      }
      const resolvedUrl = await resolveRef(
        urlPart,
        index,
        "",
        objectUrls,
        blobCache,
        missing,
        resolved,
        counters
      );
      next.push([resolvedUrl, ...rest].join(" "));
    }
    return `srcset=${quote}${next.join(", ")}${quote}`;
  });

  // 3) Inline style attributes / remaining style blocks url()
  out = await replaceAll(out, CSS_URL_PATTERN, async (m) => {
    const quote = m[1] ?? "";
    const value = m[2]!;
    const resolvedUrl = await resolveRef(
      value,
      index,
      "",
      objectUrls,
      blobCache,
      missing,
      resolved,
      counters
    );
    return `url(${quote}${resolvedUrl}${quote})`;
  });

  if (!/^\s*<(!doctype|html)/i.test(out)) {
    out = `<!doctype html><html><head><meta charset="utf-8"></head><body>${out}</body></html>`;
  }

  // Drop missing entries that were later resolved under another key
  const resolvedSet = new Set(resolved.map((r) => r.toLowerCase()));
  const missingFiltered = missing.filter((m) => {
    const n = normalizeAssetKey(m).toLowerCase();
    if (resolvedSet.has(n)) {
      return false;
    }
    // if any resolved path ends with this missing path, drop it
    for (const r of resolvedSet) {
      if (r.endsWith(`/${n}`) || n.endsWith(`/${r}`)) {
        return false;
      }
    }
    return true;
  });

  return {
    html: out,
    objectUrls,
    missing: missingFiltered,
    rewrittenCount: counters.rewritten,
    resolved,
  };
}
