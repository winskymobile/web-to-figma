/** Normalize a relative path key for asset lookup (posix-style, no leading ./). */
export function normalizeAssetKey(path: string): string {
  let p = path.replace(/\\/g, "/").trim();
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep raw
  }
  p = p.replace(/^\.\//, "");
  while (p.startsWith("/")) {
    p = p.slice(1);
  }
  const parts: Array<string> = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") {
      continue;
    }
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

export function isExternalOrSpecialUrl(ref: string): boolean {
  const t = ref.trim();
  if (!t || t.startsWith("#")) {
    return true;
  }
  if (
    t.startsWith("data:") ||
    t.startsWith("blob:") ||
    t.startsWith("javascript:")
  ) {
    return true;
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t)) {
    return true;
  }
  if (t.startsWith("//")) {
    return true;
  }
  return false;
}

export type AssetIndex = Map<string, File>;

function addIndexKey(index: AssetIndex, key: string, file: File) {
  const normalized = normalizeAssetKey(key);
  if (!normalized) {
    return;
  }
  if (!index.has(normalized)) {
    index.set(normalized, file);
  }
  // case-insensitive alias
  const lower = normalized.toLowerCase();
  if (lower !== normalized && !index.has(lower)) {
    index.set(lower, file);
  }
}

/**
 * Build path → File map from a webkitdirectory FileList.
 * Indexes multiple path variants so HTML refs resolve even when the user
 * selected a parent folder or nested project root.
 */
export function buildAssetIndex(files: Iterable<File>): AssetIndex {
  const index: AssetIndex = new Map();
  const basenameCount = new Map<string, number>();
  const basenameFile = new Map<string, File>();

  for (const file of files) {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }

    // Full relative path including selected root folder name
    const full = parts.join("/");
    addIndexKey(index, full, file);

    // Drop first segment (selected directory name) — common webkitRelativePath shape
    if (parts.length > 1) {
      const withoutRoot = parts.slice(1).join("/");
      addIndexKey(index, withoutRoot, file);

      // Every suffix path: a/b/css/main.css → css/main.css, main.css, …
      for (let i = 1; i < parts.length; i += 1) {
        addIndexKey(index, parts.slice(i).join("/"), file);
      }
    } else {
      addIndexKey(index, parts[0]!, file);
    }

    const base = parts.at(-1)!;
    const baseKey = normalizeAssetKey(base).toLowerCase();
    basenameCount.set(baseKey, (basenameCount.get(baseKey) ?? 0) + 1);
    basenameFile.set(baseKey, file);
  }

  // Unique basenames as last-resort keys
  for (const [base, count] of basenameCount) {
    if (count === 1) {
      const file = basenameFile.get(base);
      if (file) {
        addIndexKey(index, base, file);
      }
    }
  }

  return index;
}

/**
 * Resolve a relative reference against the asset index.
 * `fromDir` is the directory of the referring file ("" for HTML root).
 */
export function lookupAsset(
  index: AssetIndex,
  ref: string,
  fromDir = ""
): File | undefined {
  const bare = ref.split(/[?#]/)[0] ?? ref;
  if (!bare || isExternalOrSpecialUrl(bare)) {
    return;
  }

  const candidates: Array<string> = [];

  if (fromDir) {
    candidates.push(normalizeAssetKey(`${fromDir}/${bare}`));
  }
  candidates.push(normalizeAssetKey(bare));

  for (const key of candidates) {
    if (!key) {
      continue;
    }
    const hit = index.get(key) ?? index.get(key.toLowerCase());
    if (hit) {
      return hit;
    }
  }

  // Suffix match: ref "css/a.css" against key "project/src/css/a.css"
  const want = normalizeAssetKey(bare).toLowerCase();
  if (want) {
    for (const [key, file] of index) {
      const k = key.toLowerCase();
      if (k === want || k.endsWith(`/${want}`)) {
        return file;
      }
    }
  }

  return;
}

/** Directory of a normalized asset key ("" if file is at root). */
export function dirnameKey(key: string): string {
  const n = normalizeAssetKey(key);
  const i = n.lastIndexOf("/");
  return i === -1 ? "" : n.slice(0, i);
}

/** Number of distinct files in the index (Map keys include path aliases). */
export function countUniqueAssets(index: AssetIndex): number {
  return new Set(index.values()).size;
}
