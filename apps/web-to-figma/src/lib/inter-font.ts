export const SHARED_FONT_WEIGHTS = [300, 400, 500, 700, 900] as const;

export type SharedFontWeight = (typeof SHARED_FONT_WEIGHTS)[number];

const FULL_INTER_BASE_URL =
  "https://cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files";

const INTER_FILES: Record<
  SharedFontWeight,
  { normal: string; italic: string }
> = {
  300: { normal: "Inter-Light.woff2", italic: "Inter-LightItalic.woff2" },
  400: { normal: "Inter-Regular.woff2", italic: "Inter-Italic.woff2" },
  500: { normal: "Inter-Medium.woff2", italic: "Inter-MediumItalic.woff2" },
  700: { normal: "Inter-Bold.woff2", italic: "Inter-BoldItalic.woff2" },
  900: { normal: "Inter-Black.woff2", italic: "Inter-BlackItalic.woff2" },
};

/** Resolve to the shared static-face set; equal distances choose higher. */
export function resolveSharedFontWeight(weight: number): SharedFontWeight {
  let best: SharedFontWeight = SHARED_FONT_WEIGHTS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of SHARED_FONT_WEIGHTS) {
    const distance = Math.abs(candidate - weight);
    if (
      distance < bestDistance ||
      (distance === bestDistance && candidate > best)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function getFullInterFaceUrl(weight: number, italic: boolean): string {
  const resolvedWeight = resolveSharedFontWeight(weight);
  const filename = INTER_FILES[resolvedWeight][italic ? "italic" : "normal"];
  return `${FULL_INTER_BASE_URL}/${filename}`;
}
