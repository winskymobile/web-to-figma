export function getClipboardHtml(base64: string) {
  const dataBufferAttributeValue = `<!--(figma)${base64}(/figma)-->`;

  const metadata = {
    dataType: "scene",
    fileKey: "TEST",
    pasteId: 123,
  };
  const metaB64 = btoa(JSON.stringify(metadata));

  // Build HTML using DOM methods to avoid quote issues
  const html = document.createElement("html");
  html.innerHTML = '<head><meta charset="utf-8"></head><body></body>';

  const body = html.querySelector("body");
  if (!body) {
    throw new Error("Failed to create HTML body element");
  }

  const metaSpan = document.createElement("span");
  metaSpan.setAttribute(
    "data-metadata",
    `<!--(figmeta)${metaB64}(/figmeta)-->`
  );

  const bufferSpan = document.createElement("span");
  bufferSpan.setAttribute("data-buffer", dataBufferAttributeValue);

  const spaceSpan = document.createElement("span");
  spaceSpan.style.whiteSpace = "pre-wrap";

  body.appendChild(metaSpan);
  body.appendChild(bufferSpan);
  body.appendChild(spaceSpan);

  return `<meta charset="utf-8">${html.outerHTML}`;
}

export function getClipboardItem(base64: string) {
  const fullHtml = getClipboardHtml(base64);

  const blob = new Blob([fullHtml], { type: "text/html" });
  const item = new ClipboardItem({ "text/html": blob });

  return item;
}
