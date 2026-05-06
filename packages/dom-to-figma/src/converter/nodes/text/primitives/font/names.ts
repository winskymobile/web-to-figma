import type { OpenTypeFont } from "../../types";

type LocalizedString = { en?: string };
type NameTable = Record<string, LocalizedString | undefined>;

/**
 * opentype.js 1.3+ keys name records by platform; older versions kept them
 * flat. Pick the first platform with data, fall back to the flat shape.
 */
export function getFontNameTable(font: OpenTypeFont): NameTable {
  const names = font.names as unknown as Record<string, NameTable>;
  return names.unicode ?? names.macintosh ?? names.windows ?? names;
}
