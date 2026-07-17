export type DeviceKind = "mobile" | "pc";

export const MOBILE_WIDTHS = [360, 375, 390, 414] as const;
export const PC_WIDTHS = [1280, 1440, 1512, 1920] as const;

export type MobileWidth = (typeof MOBILE_WIDTHS)[number];
export type PcWidth = (typeof PC_WIDTHS)[number];
export type ViewportWidth = MobileWidth | PcWidth;

export type ViewportPreset = {
  kind: DeviceKind;
  width: ViewportWidth;
};

const KIND_KEY = "web-to-figma:viewport-kind";
const WIDTH_KEY = "web-to-figma:viewport-width";
/** Legacy keys from export-scale era — cleaned on load. */
const LEGACY_MODE_KEY = "web-to-figma:viewport-mode";
const LEGACY_SCALE_KEY = "web-to-figma:export-scale";

const DEFAULT: ViewportPreset = { kind: "mobile", width: 375 };

export function widthsFor(kind: DeviceKind): ReadonlyArray<ViewportWidth> {
  return kind === "mobile" ? MOBILE_WIDTHS : PC_WIDTHS;
}

export function defaultWidthFor(kind: DeviceKind): ViewportWidth {
  return kind === "mobile" ? 375 : 1440;
}

function isWidthForKind(
  kind: DeviceKind,
  width: number
): width is ViewportWidth {
  return (widthsFor(kind) as ReadonlyArray<number>).includes(width);
}

export function loadViewportPreset(): ViewportPreset {
  try {
    const kindRaw =
      localStorage.getItem(KIND_KEY) ?? localStorage.getItem(LEGACY_MODE_KEY);
    const kind: DeviceKind =
      kindRaw === "pc" || kindRaw === "mobile" ? kindRaw : DEFAULT.kind;

    const widthRaw = localStorage.getItem(WIDTH_KEY);
    const parsed = widthRaw ? Number(widthRaw) : Number.NaN;
    const width = isWidthForKind(kind, parsed) ? parsed : defaultWidthFor(kind);

    // Drop obsolete scale preference if present.
    localStorage.removeItem(LEGACY_SCALE_KEY);

    return { kind, width };
  } catch {
    return DEFAULT;
  }
}

export function saveViewportPreset(preset: ViewportPreset) {
  try {
    localStorage.setItem(KIND_KEY, preset.kind);
    localStorage.setItem(WIDTH_KEY, String(preset.width));
    localStorage.setItem(LEGACY_MODE_KEY, preset.kind);
    localStorage.removeItem(LEGACY_SCALE_KEY);
  } catch {
    // ignore
  }
}

/** When switching device kind, keep a valid width (default if current invalid). */
export function presetForKind(
  kind: DeviceKind,
  previous?: ViewportPreset | null
): ViewportPreset {
  if (
    previous &&
    previous.kind === kind &&
    isWidthForKind(kind, previous.width)
  ) {
    return previous;
  }
  // Prefer last width stored for this kind if we only switch kind from UI
  // with a width still valid under the new kind (rare overlap: none).
  if (previous && isWidthForKind(kind, previous.width)) {
    return { kind, width: previous.width };
  }
  return { kind, width: defaultWidthFor(kind) };
}

export function withWidth(
  kind: DeviceKind,
  width: number
): ViewportPreset | null {
  if (!isWidthForKind(kind, width)) {
    return null;
  }
  return { kind, width };
}
