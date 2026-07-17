import { isExternalOrSpecialUrl, normalizeAssetKey } from "./asset-map";

const ATTR_PATTERN = /\b(href|src|poster|data-src)\s*=\s*(["'])([^"']*?)\2/gi;
const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const SRCSET_PATTERN = /\bsrcset\s*=\s*(["'])([^"']*?)\1/gi;

/**
 * Collect local relative asset refs from raw HTML (not external/data/blob).
 */
export function scanLocalAssetRefs(html: string): Array<string> {
  const found: Array<string> = [];

  const add = (raw: string) => {
    const ref = raw.trim();
    if (!ref || isExternalOrSpecialUrl(ref)) {
      return;
    }
    const bare = ref.split(/[?#]/)[0] ?? ref;
    if (!bare || isExternalOrSpecialUrl(bare)) {
      return;
    }
    const key = normalizeAssetKey(bare);
    if (key && !found.includes(key)) {
      found.push(key);
    }
  };

  for (const m of html.matchAll(ATTR_PATTERN)) {
    add(m[3] ?? "");
  }
  for (const m of html.matchAll(SRCSET_PATTERN)) {
    const value = m[2] ?? "";
    for (const part of value.split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url) {
        add(url);
      }
    }
  }
  for (const m of html.matchAll(CSS_URL_PATTERN)) {
    add(m[2] ?? "");
  }

  return found;
}
