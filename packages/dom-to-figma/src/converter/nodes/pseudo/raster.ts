import type { FigmaBlob, FigmaGuid, FigmaNodeChange } from "../../types";

const MAX_EDGE_PX = 512;
const MAX_HOST_AREA_RATIO = 0.35;

export type PseudoRasterBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function cssName(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function readStyle(from: CSSStyleDeclaration, prop: string): string {
  const dashed = cssName(prop);
  const viaGet = from.getPropertyValue(dashed).trim();
  if (viaGet) {
    return viaGet;
  }
  const direct = (from as unknown as Record<string, string>)[prop];
  return typeof direct === "string" ? direct.trim() : "";
}

function copyPaintStyles(from: CSSStyleDeclaration, to: CSSStyleDeclaration) {
  const props = [
    "background",
    "backgroundColor",
    "backgroundImage",
    "backgroundSize",
    "backgroundPosition",
    "backgroundRepeat",
    "border",
    "borderRadius",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderTopStyle",
    "borderRightStyle",
    "borderBottomStyle",
    "borderLeftStyle",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "boxShadow",
    "opacity",
    "filter",
  ] as const;
  for (const prop of props) {
    const v = readStyle(from, prop);
    if (!v) {
      continue;
    }
    try {
      to.setProperty(cssName(prop), v);
    } catch {
      // ignore unsettable
    }
  }

  const maskImage =
    readStyle(from, "maskImage") ||
    from.getPropertyValue("-webkit-mask-image").trim();
  if (maskImage && maskImage !== "none") {
    to.setProperty("mask-image", maskImage);
    to.setProperty("-webkit-mask-image", maskImage);
  }
  for (const [prop, webkit] of [
    ["maskSize", "-webkit-mask-size"],
    ["maskPosition", "-webkit-mask-position"],
    ["maskRepeat", "-webkit-mask-repeat"],
  ] as const) {
    const v = readStyle(from, prop) || from.getPropertyValue(webkit).trim();
    if (!v) {
      continue;
    }
    to.setProperty(cssName(prop), v);
    to.setProperty(webkit, v);
  }
}

async function sha1Bytes(bytes: Uint8Array): Promise<Array<number>> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hashBuffer = await crypto.subtle.digest("SHA-1", copy.buffer);
  return Array.from(new Uint8Array(hashBuffer));
}

/**
 * Snapshot a masked absolute pseudo by temporarily materializing a proxy
 * element, then rasterizing via SVG foreignObject → canvas → PNG.
 */
export async function rasterizeMaskedPseudo(options: {
  host: Element;
  kind: "before" | "after";
  box: PseudoRasterBox;
  guid: FigmaGuid;
  parentGuid: FigmaGuid;
  childIndex: number;
  registerBlob: (blob: FigmaBlob) => number;
  zIndex: number;
}): Promise<FigmaNodeChange | null> {
  const { host, kind, box, guid, parentGuid, childIndex, registerBlob } =
    options;
  const width = Math.ceil(box.width);
  const height = Math.ceil(box.height);
  if (width < 1 || height < 1) {
    return null;
  }
  if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
    return null;
  }
  const hostRect = host.getBoundingClientRect();
  const hostArea = Math.max(hostRect.width * hostRect.height, 1);
  if ((width * height) / hostArea > MAX_HOST_AREA_RATIO) {
    return null;
  }

  const view = host.ownerDocument?.defaultView ?? window;
  const doc = host.ownerDocument ?? document;
  const pseudoStyle = view.getComputedStyle(host, `::${kind}`);

  const hostEl = host as HTMLElement;
  const prevAttr = hostEl.getAttribute("data-wtf-pseudo-capture");
  hostEl.setAttribute("data-wtf-pseudo-capture", kind);

  const styleEl = doc.createElement("style");
  styleEl.setAttribute("data-wtf-pseudo-capture-style", "1");
  // Suppress original pseudo while proxy is visible (host-scoped when possible).
  styleEl.textContent = `
    [data-wtf-pseudo-capture]::before,
    [data-wtf-pseudo-capture]::after {
      content: none !important;
    }
  `;
  doc.head.appendChild(styleEl);

  const proxy = doc.createElement("div");
  proxy.setAttribute("data-wtf-pseudo-proxy", kind);
  proxy.style.position = "absolute";
  proxy.style.left = `${box.x}px`;
  proxy.style.top = `${box.y}px`;
  proxy.style.width = `${box.width}px`;
  proxy.style.height = `${box.height}px`;
  proxy.style.boxSizing = "border-box";
  proxy.style.pointerEvents = "none";
  proxy.style.zIndex = String(options.zIndex);
  copyPaintStyles(pseudoStyle, proxy.style);
  // Prefer transform none on proxy: box is already axis-aligned snapshot size.
  proxy.style.transform = "none";

  const priorPosition = hostEl.style.position;
  if (view.getComputedStyle(host).position === "static") {
    hostEl.style.position = "relative";
  }
  host.appendChild(proxy);

  try {
    // Force layout
    proxy.getBoundingClientRect();
    const png = await elementToPngBytes(proxy, width, height);
    if (!png || png.byteLength < 32) {
      return null;
    }
    const bytes = Array.from(new Uint8Array(png));
    const hash = await sha1Bytes(new Uint8Array(png));
    const blobIndex = registerBlob({ bytes });
    const hostName = host.tagName.toLowerCase();
    const nodeChange: FigmaNodeChange = {
      guid,
      phase: "CREATED",
      parentIndex: {
        guid: parentGuid,
        position: childIndex.toString(),
      },
      type: "FRAME",
      name: `${hostName}::${kind} (raster)`,
      visible: true,
      opacity: 1,
      frameMaskDisabled: true,
      size: { x: width, y: height },
      transform: {
        m00: 1,
        m01: 0,
        m02: box.x,
        m10: 0,
        m11: 1,
        m12: box.y,
      },
      stackMode: "NONE",
      fillPaints: [
        {
          type: "IMAGE",
          opacity: 1,
          visible: true,
          blendMode: "NORMAL",
          transform: {
            m00: 1,
            m01: 0,
            m02: 0,
            m10: 0,
            m11: 1,
            m12: 0,
          },
          image: {
            hash,
            dataBlob: blobIndex,
          },
          imageScaleMode: "FILL",
        },
      ],
      strokeAlign: "INSIDE",
      strokeJoin: "MITER",
      strokeWeight: 0,
      strokePaints: [],
      effects: [],
      stackHorizontalPadding: 0,
      stackVerticalPadding: 0,
      stackPaddingRight: 0,
      stackPaddingBottom: 0,
      stackPositioning: "ABSOLUTE",
    };
    return nodeChange;
  } catch {
    return null;
  } finally {
    proxy.remove();
    styleEl.remove();
    if (prevAttr === null) {
      hostEl.removeAttribute("data-wtf-pseudo-capture");
    } else {
      hostEl.setAttribute("data-wtf-pseudo-capture", prevAttr);
    }
    hostEl.style.position = priorPosition;
  }
}

async function elementToPngBytes(
  element: HTMLElement,
  width: number,
  height: number
): Promise<ArrayBuffer | null> {
  const doc = element.ownerDocument ?? document;
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const serializer = new XMLSerializer();
  const html = serializer.serializeToString(clone);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    ${html}
  </foreignObject>
</svg>`;

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = "sync";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg image load failed"));
    });
    img.src = url;
    await loaded;
    const canvas = doc.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (!blob) {
      return null;
    }
    return await blob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isWithinRasterBudget(
  box: PseudoRasterBox,
  hostSize: { width: number; height: number }
): boolean {
  if (box.width > MAX_EDGE_PX || box.height > MAX_EDGE_PX) {
    return false;
  }
  if (box.width < 0.5 || box.height < 0.5) {
    return false;
  }
  const hostArea = Math.max(hostSize.width * hostSize.height, 1);
  return (box.width * box.height) / hostArea <= MAX_HOST_AREA_RATIO;
}
