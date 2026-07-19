export const CONTRIBUTION_CATEGORIES = Object.freeze([
  "structure",
  "text",
  "image",
  "svg",
  "form-state",
  "pseudo",
  "decoration",
] as const);

export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number];

export const CAPTURE_ELIGIBILITIES = Object.freeze([
  "excluded",
  "eligible",
] as const);

export type CaptureEligibility = (typeof CAPTURE_ELIGIBILITIES)[number];

export const CAPTURE_DETAIL_CODES = Object.freeze([
  "element",
  "text-node",
  "image-element",
  "svg-graphics",
  "form-state",
  "pseudo-before",
  "pseudo-after",
  "background-color",
  "background-image",
  "border",
  "box-shadow",
  "filter",
  "backdrop-filter",
  "mask",
  "clip-path",
  "blend",
  "runtime-script",
  "runtime-host",
  "script-code-text",
] as const);

export type CaptureDetailCode = (typeof CAPTURE_DETAIL_CODES)[number];

export const CAPTURE_PROVENANCE_CODES = Object.freeze([
  "unsupported-runtime",
  "neutralized-nonrendered",
  "inline-event-handler",
  "pseudo-proxy-unbound",
  "candidate-parse-unproven",
  "baseline-style-unproven",
  "indexed-node-mutated-unproven",
] as const);

export type CaptureProvenanceCode = (typeof CAPTURE_PROVENANCE_CODES)[number];

export type CaptureProvenance = Readonly<{
  code: CaptureProvenanceCode;
  count: number;
}>;

export const CAPTURE_SOURCE_KINDS = Object.freeze([
  "HTML",
  "HEAD",
  "BODY",
  "MAIN",
  "DIV",
  "SPAN",
  "P",
  "PRE",
  "STYLE",
  "SCRIPT",
  "BASE",
  "IMG",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "OPTION",
  "BUTTON",
  "SVG",
  "SVG-GRAPHICS",
  "CUSTOM-ELEMENT",
  "UNKNOWN-HTML",
  "UNKNOWN-SVG",
  "#TEXT",
] as const);

export type CaptureSourceKind = (typeof CAPTURE_SOURCE_KINDS)[number];

export const CAPTURE_COORDINATE_SPACES = Object.freeze([
  "root-css-px-scrolltop-0",
] as const);

export type CaptureCoordinateSpace = (typeof CAPTURE_COORDINATE_SPACES)[number];

export type CaptureAnnotation = Readonly<{
  targetId: string;
  eligibilityHint?: "eligible";
  provenance: ReadonlyArray<CaptureProvenance>;
}>;

declare const captureRemovalBundleBrand: unique symbol;

export type CaptureRemovalBundle = Readonly<{
  [captureRemovalBundleBrand]: true;
}>;

declare const captureSourceIndexBrand: unique symbol;

export type CaptureSourceIndex = Readonly<{
  [captureSourceIndexBrand]: true;
}>;

export type CaptureIndexOptions = Readonly<{
  removalBundles?: ReadonlyArray<CaptureRemovalBundle>;
  annotations?: ReadonlyArray<CaptureAnnotation>;
}>;

export type CaptureRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type CaptureGeometry = Readonly<{
  coordinateSpace: CaptureCoordinateSpace;
  layoutBounds: CaptureRect | null;
  visualBounds: CaptureRect;
  fragments: ReadonlyArray<CaptureRect>;
  inkBounds: CaptureRect | null;
}>;

export type CaptureManifestEntry = Readonly<{
  id: string;
  path: ReadonlyArray<number>;
  category: ContributionCategory;
  ordinal: number;
  sourceKind: CaptureSourceKind;
  detailCode: CaptureDetailCode;
  eligibility: CaptureEligibility;
  contentRelevant: boolean;
  editableRelevant: boolean;
  geometry: CaptureGeometry | null;
  provenance: ReadonlyArray<CaptureProvenance>;
  resourceFacts: readonly [];
  fallbackPolicies: readonly [];
  requiredHierarchyEdgeIds: readonly [];
  requiredPaintEdgeIds: readonly [];
}>;

export type CaptureManifest = Readonly<{
  entries: ReadonlyArray<CaptureManifestEntry>;
  hierarchyEdges: readonly [];
  paintEdges: readonly [];
  proofs: Readonly<{
    sourceInventoryComplete: false;
    resourceProofComplete: false;
    hierarchyProofComplete: false;
    paintOrderProofComplete: false;
  }>;
  summary: Readonly<{
    scanned: number;
    excluded: number;
    eligible: number;
    byCategory: Readonly<Record<ContributionCategory, number>>;
  }>;
}>;

export type IndexedPseudoCandidate = Readonly<{
  sourceId: string;
  host: Element;
  pseudo: "before" | "after";
}>;

export type CaptureManifestScan = Readonly<{
  manifest: CaptureManifest;
  entryIdsForNode(node: Node): ReadonlyArray<string>;
}>;

type CaptureCandidateOrigin = "retained" | "synthesized";
type ForcedEligibility = "eligible" | "excluded" | null;
type CapturePseudo = "before" | "after";

type IndexedCaptureCandidate = {
  id: string;
  path: Array<number>;
  category: ContributionCategory;
  ordinal: number;
  sourceKind: CaptureSourceKind;
  detailCode: CaptureDetailCode;
  origin: CaptureCandidateOrigin;
  node: Node | null;
  host: Element | null;
  pseudo: CapturePseudo | null;
  originalAncestorChain: ReadonlyArray<Node> | null;
  eligibilityHint: "eligible" | null;
  forcedEligibility: ForcedEligibility;
  provenance: Array<CaptureProvenance>;
  completePaintBoundedByPrincipalBox: boolean;
};

type OriginalSlotEdge = Readonly<{
  child: Node;
  parent: Node;
  ordinal: number;
}>;

type RemovalBundleState = {
  bundle: CaptureRemovalBundle;
  slot: Comment;
  nonce: string;
  issuanceDocument: Document;
  removedRoot: Element;
  originalEdges: ReadonlyArray<OriginalSlotEdge>;
  relativeCandidates: ReadonlyArray<IndexedCaptureCandidate>;
  candidateSignatures: ReadonlyArray<string>;
  candidateSetHash: string;
  subtreeNodes: ReadonlyArray<Node>;
  subtreeSnapshot: ReadonlyArray<string>;
  subtreeDigest: string;
  consumed: boolean;
};

type CaptureSourceIndexState = {
  root: Element;
  candidates: Map<string, IndexedCaptureCandidate>;
  originalNodes: Set<Node>;
  pseudoCandidates: Array<IndexedCaptureCandidate>;
  boundProxyBySourceId: Map<string, Element>;
  sourceIdByBoundProxy: WeakMap<Element, string>;
  sealed: boolean;
  cachedScan: CaptureManifestScan | null;
};

type EnumerateOptions = Readonly<{
  origin: CaptureCandidateOrigin;
  identityRoot: Element | null;
  readComputedStyle: boolean;
}>;

type BoundedLayers = Readonly<{
  layers: ReadonlyArray<string>;
  hasUnparsedRemainder: boolean;
}>;

type NonPaintingProof = "paintable" | "proven-nonpainting" | "unproven";

const removalBundleStates = new WeakMap<object, RemovalBundleState>();
const removalSlotStates = new WeakMap<Comment, RemovalBundleState>();
const sourceIndexStates = new WeakMap<object, CaptureSourceIndexState>();
const globallyBoundCaptureProxies = new WeakSet<Element>();

const EMPTY_RESOURCE_FACTS = Object.freeze([]) as readonly [];
const EMPTY_FALLBACK_POLICIES = Object.freeze([]) as readonly [];
const EMPTY_HIERARCHY_EDGE_IDS = Object.freeze([]) as readonly [];
const EMPTY_PAINT_EDGE_IDS = Object.freeze([]) as readonly [];
const EMPTY_HIERARCHY_EDGES = Object.freeze([]) as readonly [];
const EMPTY_PAINT_EDGES = Object.freeze([]) as readonly [];
const EMPTY_ENTRY_IDS: ReadonlyArray<string> = Object.freeze([]);
const TEXT_NODE_TYPE = 3;
const COMMENT_NODE_TYPE = 8;
const SHOW_COMMENT = 128;
const FNV_BIT_WIDTH = 64;
const FNV_PRIME = 0x100000001b3n;
const HASH_RADIX = 16;
const HASH_WIDTH = 16;
const NONCE_BYTE_LENGTH = 16;
const BYTE_HEX_WIDTH = 2;
const PERCENT_SCALE = 100;
const WHITESPACE_PATTERN = /\s+/;
const CSS_NUMBER_PATTERN = /-?(?:\d+\.?\d*|\.\d+)/g;

function invalidRemovalBundle(): never {
  throw new TypeError("invalid capture removal bundle");
}

function invalidAnnotation(): never {
  throw new TypeError("invalid capture annotation");
}

function invalidProxy(): never {
  throw new TypeError("invalid capture proxy");
}

function encodeSignaturePart(value: string): string {
  return `${new TextEncoder().encode(value).byteLength}:${value}`;
}

function captureId(
  path: ReadonlyArray<number>,
  category: ContributionCategory,
  ordinal: number
): string {
  const encodedPath = path.length === 0 ? "root" : path.join(".");
  return `${encodedPath}:${category}:${ordinal}`;
}

function candidateSignature(candidate: IndexedCaptureCandidate): string {
  return [
    candidate.path.join("."),
    candidate.category,
    String(candidate.ordinal),
    candidate.sourceKind,
    candidate.detailCode,
    candidate.origin,
    candidate.pseudo ?? "",
    candidate.forcedEligibility ?? "",
    candidate.completePaintBoundedByPrincipalBox ? "1" : "0",
    candidate.provenance.map((item) => `${item.code}:${item.count}`).join(","),
  ]
    .map(encodeSignaturePart)
    .join("");
}

function candidateSignatures(
  candidates: ReadonlyArray<IndexedCaptureCandidate>
): Array<string> {
  return candidates.map(candidateSignature).sort();
}

function fnv1a64(values: ReadonlyArray<string>): string {
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(
    values.map(encodeSignaturePart).join("")
  );
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(FNV_BIT_WIDTH, hash * FNV_PRIME);
  }
  return hash.toString(HASH_RADIX).padStart(HASH_WIDTH, "0");
}

function equalStrings(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function privateSubtreeSnapshot(root: Node): Array<string> {
  const snapshot: Array<string> = [];

  function visit(node: Node): void {
    const element = node.nodeType === 1 ? (node as Element) : null;
    snapshot.push(encodeSignaturePart(String(node.nodeType)));
    snapshot.push(encodeSignaturePart(element?.namespaceURI ?? ""));
    snapshot.push(encodeSignaturePart(element?.localName ?? ""));

    if (element) {
      const attributes = Array.from(element.attributes, (attribute) =>
        [
          encodeSignaturePart(attribute.namespaceURI ?? ""),
          encodeSignaturePart(attribute.name),
          encodeSignaturePart(attribute.value),
        ].join("")
      );
      snapshot.push(encodeSignaturePart(String(attributes.length)));
      snapshot.push(...attributes);
    } else {
      snapshot.push(encodeSignaturePart(node.nodeValue ?? ""));
    }

    const children = Array.from(node.childNodes);
    snapshot.push(encodeSignaturePart(String(children.length)));
    for (const child of children) {
      visit(child);
    }
  }

  visit(root);
  return snapshot;
}

function privateSubtreeNodes(root: Node): Array<Node> {
  const nodes: Array<Node> = [];
  function visit(node: Node): void {
    nodes.push(node);
    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
  }
  visit(root);
  return nodes;
}

const FIXED_ZERO_ORDINALS = new Set<ContributionCategory>([
  "structure",
  "text",
  "image",
  "svg",
  "form-state",
]);

function copyIndexedCandidate(
  candidate: IndexedCaptureCandidate
): IndexedCaptureCandidate {
  return {
    ...candidate,
    path: candidate.path.slice(),
    originalAncestorChain: candidate.originalAncestorChain?.slice() ?? null,
    provenance: candidate.provenance.map((item) => ({ ...item })),
  };
}

function freezeIndexedCandidate(
  candidate: IndexedCaptureCandidate
): IndexedCaptureCandidate {
  const copied = copyIndexedCandidate(candidate);
  Object.freeze(copied.path);
  if (copied.originalAncestorChain) {
    Object.freeze(copied.originalAncestorChain);
  }
  copied.provenance.forEach(Object.freeze);
  Object.freeze(copied.provenance);
  return Object.freeze(copied);
}

function addIndexedCandidate(
  target: Map<string, IndexedCaptureCandidate>,
  candidate: IndexedCaptureCandidate
): void {
  const validPath = candidate.path.every(
    (part) => Number.isSafeInteger(part) && part >= 0
  );
  const validFixedOrdinal =
    !FIXED_ZERO_ORDINALS.has(candidate.category) || candidate.ordinal === 0;
  const validPseudoOrdinal =
    candidate.category !== "pseudo" ||
    candidate.ordinal === 0 ||
    candidate.ordinal === 1;
  if (
    !(validPath && Number.isSafeInteger(candidate.ordinal)) ||
    candidate.ordinal < 0 ||
    !validFixedOrdinal ||
    !validPseudoOrdinal ||
    candidate.id !==
      captureId(candidate.path, candidate.category, candidate.ordinal) ||
    target.has(candidate.id)
  ) {
    throw new TypeError("invalid capture candidate");
  }
  target.set(candidate.id, candidate);
}

function recordAncestorIdentity(
  node: Node,
  identityRoot: Element
): ReadonlyArray<Node> {
  if (node !== identityRoot && !identityRoot.contains(node)) {
    throw new TypeError("invalid capture candidate");
  }
  const chain: Array<Node> = [];
  let current = node.parentNode;
  let sawRoot = node === identityRoot;
  while (current) {
    chain.push(current);
    if (current === identityRoot) {
      sawRoot = true;
    }
    current = current.parentNode;
  }
  if (!sawRoot || chain.at(-1) !== node.ownerDocument) {
    throw new TypeError("invalid capture candidate");
  }
  return Object.freeze(chain);
}

function prefixSynthesizedCandidate(
  slotPath: ReadonlyArray<number>,
  retained: IndexedCaptureCandidate
): IndexedCaptureCandidate {
  const path = [...slotPath, ...retained.path];
  return copyIndexedCandidate({
    ...retained,
    path,
    id: captureId(path, retained.category, retained.ordinal),
    origin: "synthesized",
    node: null,
    host: null,
    originalAncestorChain: null,
  });
}

const MAX_CAPTURE_CSS_VALUE_LENGTH = 65_536;
const MAX_CAPTURE_CSS_NESTING = 64;
const MAX_CAPTURE_CSS_LAYERS = 256;
const MAX_CAPTURE_CSS_SCAN_STEPS = 131_072;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the bounded single-pass CSS state machine keeps all proof limits and stop conditions together.
function splitTopLevelLayers(value: string): BoundedLayers {
  if (value.length === 0) {
    return { layers: EMPTY_ENTRY_IDS, hasUnparsedRemainder: false };
  }

  const layers: Array<string> = [];
  const scanLength = Math.min(value.length, MAX_CAPTURE_CSS_VALUE_LENGTH);
  let start = 0;
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let inComment = false;
  let steps = 0;
  let stoppedAt = scanLength;
  let hasUnparsedRemainder = value.length > scanLength;

  for (let index = 0; index < scanLength; index += 1) {
    steps += 1;
    if (steps > MAX_CAPTURE_CSS_SCAN_STEPS) {
      stoppedAt = index;
      hasUnparsedRemainder = true;
      break;
    }
    const current = value[index] ?? "";
    const next = value[index + 1];

    if (inComment) {
      if (current === "*" && next === "/") {
        inComment = false;
        index += 1;
        steps += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === quote) {
        quote = null;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if (current === "\\") {
      escaped = true;
      continue;
    }
    if (current === "/" && next === "*") {
      inComment = true;
      index += 1;
      steps += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }
    if (current === "(") {
      depth += 1;
      if (depth > MAX_CAPTURE_CSS_NESTING) {
        stoppedAt = index;
        hasUnparsedRemainder = true;
        break;
      }
      continue;
    }
    if (current === ")") {
      depth -= 1;
      if (depth < 0) {
        stoppedAt = index;
        hasUnparsedRemainder = true;
        break;
      }
      continue;
    }
    if (current === "," && depth === 0) {
      const layer = value.slice(start, index).trim();
      if (layer.length === 0) {
        stoppedAt = index;
        hasUnparsedRemainder = true;
        break;
      }
      layers.push(layer);
      start = index + 1;
      if (layers.length === MAX_CAPTURE_CSS_LAYERS) {
        stoppedAt = index + 1;
        hasUnparsedRemainder = true;
        break;
      }
    }
  }

  if (quote || escaped || inComment || depth !== 0) {
    hasUnparsedRemainder = true;
  }
  if (!hasUnparsedRemainder) {
    const tail = value.slice(start, stoppedAt).trim();
    if (tail.length === 0) {
      hasUnparsedRemainder = true;
    } else {
      layers.push(tail);
    }
  }

  return {
    layers: Object.freeze(layers),
    hasUnparsedRemainder,
  };
}

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const KNOWN_HTML_KINDS = new Map<string, CaptureSourceKind>([
  ["html", "HTML"],
  ["head", "HEAD"],
  ["body", "BODY"],
  ["main", "MAIN"],
  ["div", "DIV"],
  ["span", "SPAN"],
  ["p", "P"],
  ["pre", "PRE"],
  ["style", "STYLE"],
  ["script", "SCRIPT"],
  ["base", "BASE"],
  ["img", "IMG"],
  ["input", "INPUT"],
  ["textarea", "TEXTAREA"],
  ["select", "SELECT"],
  ["option", "OPTION"],
  ["button", "BUTTON"],
]);

const FORM_STATE_NAMES = new Set(["input", "textarea", "select", "button"]);

const JAVASCRIPT_MIME_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript",
]);

function isSameRealmSvgGraphics(element: Element): boolean {
  const svgGraphicsConstructor =
    element.ownerDocument.defaultView?.SVGGraphicsElement;
  return Boolean(
    svgGraphicsConstructor &&
      Object.prototype.isPrototypeOf.call(
        svgGraphicsConstructor.prototype,
        element
      )
  );
}

function sourceKindForElement(element: Element): CaptureSourceKind {
  const localName = element.localName.toLowerCase();
  if (element.namespaceURI === HTML_NAMESPACE) {
    return (
      KNOWN_HTML_KINDS.get(localName) ??
      (localName.includes("-") ? "CUSTOM-ELEMENT" : "UNKNOWN-HTML")
    );
  }
  if (element.namespaceURI === SVG_NAMESPACE) {
    if (localName === "svg") {
      return "SVG";
    }
    return isSameRealmSvgGraphics(element) ? "SVG-GRAPHICS" : "UNKNOWN-SVG";
  }
  return "UNKNOWN-HTML";
}

function runtimeScript(element: Element): boolean {
  const rawType = (element.getAttribute("type") ?? "").trim().toLowerCase();
  const mime = rawType.split(";", 1)[0]?.trim() ?? "";
  return (
    mime === "" ||
    mime === "module" ||
    mime === "application/x-web-to-figma-inert" ||
    JAVASCRIPT_MIME_TYPES.has(mime)
  );
}

function makeCandidate(
  path: ReadonlyArray<number>,
  category: ContributionCategory,
  ordinal: number,
  sourceKind: CaptureSourceKind,
  detailCode: CaptureDetailCode,
  node: Node,
  options: EnumerateOptions,
  completePaintBoundedByPrincipalBox: boolean
): IndexedCaptureCandidate {
  let originalAncestorChain: ReadonlyArray<Node> | null = null;
  if (options.origin === "retained") {
    if (!options.identityRoot) {
      throw new TypeError("invalid capture candidate");
    }
    originalAncestorChain = recordAncestorIdentity(node, options.identityRoot);
  }
  return {
    id: captureId(path, category, ordinal),
    path: Array.from(path),
    category,
    ordinal,
    sourceKind,
    detailCode,
    origin: options.origin,
    node: options.origin === "retained" ? node : null,
    host: null,
    pseudo: null,
    originalAncestorChain,
    eligibilityHint: null,
    forcedEligibility: null,
    provenance: [],
    completePaintBoundedByPrincipalBox,
  };
}

function styleOf(element: Element): CSSStyleDeclaration | null {
  return element.ownerDocument.defaultView?.getComputedStyle(element) ?? null;
}

function parseAlphaToken(token: string): number | null {
  const trimmed = token.trim();
  const percentage = trimmed.endsWith("%");
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return percentage ? parsed / PERCENT_SCALE : parsed;
}

function computedColorAlpha(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "transparent") {
    return 0;
  }
  const open = normalized.indexOf("(");
  const close = normalized.lastIndexOf(")");
  if (open < 0 || close <= open) {
    return null;
  }
  const body = normalized.slice(open + 1, close);
  const slash = body.lastIndexOf("/");
  if (slash >= 0) {
    return parseAlphaToken(body.slice(slash + 1));
  }
  const functionName = normalized.slice(0, open);
  if (functionName !== "rgba" && functionName !== "hsla") {
    return null;
  }
  const components = body.split(",");
  return components.length === 4 ? parseAlphaToken(components[3] ?? "") : null;
}

function activeColor(value: string): boolean {
  return value.trim() !== "" && computedColorAlpha(value) !== 0;
}

function activeValue(value: string): boolean {
  return value !== "" && value.toLowerCase() !== "none";
}

function activeBorder(style: CSSStyleDeclaration): boolean {
  const widths = [
    style.borderTopWidth,
    style.borderRightWidth,
    style.borderBottomWidth,
    style.borderLeftWidth,
  ];
  const styles = [
    style.borderTopStyle,
    style.borderRightStyle,
    style.borderBottomStyle,
    style.borderLeftStyle,
  ];
  return styles.some(
    (borderStyle, index) =>
      borderStyle !== "none" &&
      borderStyle !== "hidden" &&
      Number.parseFloat(widths[index] ?? "0") > 0
  );
}

function activeOutline(style: CSSStyleDeclaration): boolean {
  return (
    style.outlineStyle !== "none" &&
    style.outlineStyle !== "hidden" &&
    Number.parseFloat(style.outlineWidth) > 0 &&
    activeColor(style.outlineColor)
  );
}

function pseudoIsActive(style: CSSStyleDeclaration): boolean {
  return (
    (style.content !== "none" && style.content !== "normal") ||
    activeColor(style.backgroundColor) ||
    activeValue(style.backgroundImage) ||
    activeBorder(style) ||
    activeOutline(style) ||
    activeValue(style.boxShadow) ||
    activeValue(style.filter) ||
    activeValue(style.backdropFilter) ||
    activeValue(style.maskImage) ||
    activeValue(style.clipPath) ||
    style.mixBlendMode !== "normal"
  );
}

function enumerateBaseCandidates(
  node: Node,
  path: ReadonlyArray<number>,
  options: EnumerateOptions
): Array<IndexedCaptureCandidate> {
  if (node.nodeType === TEXT_NODE_TYPE) {
    const parent = node.parentElement;
    const scriptText =
      parent?.namespaceURI === HTML_NAMESPACE && parent.localName === "script";
    return [
      makeCandidate(
        path,
        "text",
        0,
        "#TEXT",
        scriptText ? "script-code-text" : "text-node",
        node,
        options,
        true
      ),
    ];
  }
  if (node.nodeType !== 1) {
    return [];
  }

  const element = node as Element;
  const sourceKind = sourceKindForElement(element);
  const isHtml = element.namespaceURI === HTML_NAMESPACE;
  const isScript = isHtml && element.localName === "script";
  const structure = makeCandidate(
    path,
    "structure",
    0,
    sourceKind,
    isScript ? "runtime-script" : "element",
    element,
    options,
    true
  );

  if (isHtml && element.localName === "base") {
    structure.forcedEligibility = "excluded";
    structure.provenance.push({
      code: "neutralized-nonrendered",
      count: 1,
    });
  } else if (isScript && runtimeScript(element)) {
    structure.forcedEligibility = "eligible";
    structure.provenance.push({ code: "unsupported-runtime", count: 1 });
  } else if (isScript) {
    structure.forcedEligibility = "excluded";
    structure.provenance.push({
      code: "neutralized-nonrendered",
      count: 1,
    });
  }

  const result: Array<IndexedCaptureCandidate> = [structure];
  if (isHtml && element.localName === "img") {
    result.push(
      makeCandidate(
        path,
        "image",
        0,
        sourceKind,
        "image-element",
        element,
        options,
        true
      )
    );
  }
  if (
    element.namespaceURI === SVG_NAMESPACE &&
    isSameRealmSvgGraphics(element)
  ) {
    result.push(
      makeCandidate(
        path,
        "svg",
        0,
        "SVG-GRAPHICS",
        "svg-graphics",
        element,
        options,
        true
      )
    );
  }
  if (isHtml && FORM_STATE_NAMES.has(element.localName)) {
    result.push(
      makeCandidate(
        path,
        "form-state",
        0,
        sourceKind,
        "form-state",
        element,
        options,
        true
      )
    );
  }
  return result;
}

function enumeratePseudoCandidates(
  element: Element,
  path: ReadonlyArray<number>,
  sourceKind: CaptureSourceKind,
  options: EnumerateOptions
): Array<IndexedCaptureCandidate> {
  const view = element.ownerDocument.defaultView;
  if (!view) {
    return [];
  }

  const result: Array<IndexedCaptureCandidate> = [];
  for (const [pseudo, ordinal] of [
    ["before", 0],
    ["after", 1],
  ] as const) {
    const style = view.getComputedStyle(element, `::${pseudo}`);
    if (!pseudoIsActive(style)) {
      continue;
    }
    const candidate = makeCandidate(
      path,
      "pseudo",
      ordinal,
      sourceKind,
      pseudo === "before" ? "pseudo-before" : "pseudo-after",
      element,
      options,
      false
    );
    candidate.node = null;
    candidate.host = options.origin === "retained" ? element : null;
    candidate.pseudo = pseudo;
    result.push(candidate);
  }
  return result;
}

function appendLayerCandidates(
  target: Array<IndexedCaptureCandidate>,
  element: Element,
  path: ReadonlyArray<number>,
  sourceKind: CaptureSourceKind,
  detailCode: "background-image" | "box-shadow",
  value: string,
  options: EnumerateOptions,
  boundedByPrincipalBox: boolean,
  ordinalOffset: number
): number {
  const parsed = splitTopLevelLayers(value);
  for (let ordinal = 0; ordinal < parsed.layers.length; ordinal += 1) {
    target.push(
      makeCandidate(
        path,
        "decoration",
        ordinalOffset + ordinal,
        sourceKind,
        detailCode,
        element,
        options,
        boundedByPrincipalBox
      )
    );
  }
  if (parsed.hasUnparsedRemainder) {
    const remainder = makeCandidate(
      path,
      "decoration",
      ordinalOffset + parsed.layers.length,
      sourceKind,
      detailCode,
      element,
      options,
      false
    );
    remainder.provenance.push({
      code: "candidate-parse-unproven",
      count: 1,
    });
    target.push(remainder);
  }
  return parsed.layers.length + (parsed.hasUnparsedRemainder ? 1 : 0);
}

function enumerateDecorationCandidates(
  element: Element,
  path: ReadonlyArray<number>,
  sourceKind: CaptureSourceKind,
  style: CSSStyleDeclaration,
  options: EnumerateOptions
): Array<IndexedCaptureCandidate> {
  const result: Array<IndexedCaptureCandidate> = [];
  let ordinal = 0;

  function pushOne(
    detailCode: CaptureDetailCode,
    boundedByPrincipalBox: boolean
  ): void {
    result.push(
      makeCandidate(
        path,
        "decoration",
        ordinal,
        sourceKind,
        detailCode,
        element,
        options,
        boundedByPrincipalBox
      )
    );
    ordinal += 1;
  }

  if (activeColor(style.backgroundColor)) {
    pushOne("background-color", true);
  }
  if (activeValue(style.backgroundImage)) {
    ordinal += appendLayerCandidates(
      result,
      element,
      path,
      sourceKind,
      "background-image",
      style.backgroundImage,
      options,
      true,
      ordinal
    );
  }
  if (activeBorder(style)) {
    pushOne("border", true);
  }
  if (activeValue(style.boxShadow)) {
    ordinal += appendLayerCandidates(
      result,
      element,
      path,
      sourceKind,
      "box-shadow",
      style.boxShadow,
      options,
      false,
      ordinal
    );
  }
  if (activeValue(style.filter)) {
    pushOne("filter", false);
  }
  if (activeValue(style.backdropFilter)) {
    pushOne("backdrop-filter", false);
  }
  if (activeValue(style.maskImage)) {
    pushOne("mask", false);
  }
  if (activeValue(style.clipPath)) {
    pushOne("clip-path", false);
  }
  if (style.mixBlendMode !== "normal") {
    pushOne("blend", false);
  }
  return result;
}

function enumerateNodeCandidates(
  node: Node,
  path: ReadonlyArray<number>,
  options: EnumerateOptions
): Array<IndexedCaptureCandidate> {
  const result = enumerateBaseCandidates(node, path, options);
  if (node.nodeType !== 1 || !options.readComputedStyle) {
    return result;
  }

  const element = node as Element;
  const style = styleOf(element);
  if (!style) {
    return result;
  }
  const sourceKind = sourceKindForElement(element);
  if (activeOutline(style)) {
    const structure = result.find(
      (candidate) => candidate.category === "structure"
    );
    if (structure) {
      structure.completePaintBoundedByPrincipalBox = false;
    }
  }
  result.push(...enumeratePseudoCandidates(element, path, sourceKind, options));
  result.push(
    ...enumerateDecorationCandidates(element, path, sourceKind, style, options)
  );
  return result;
}

function enumerateIndexedSubtree(
  root: Node,
  options: EnumerateOptions
): Array<IndexedCaptureCandidate> {
  const collected: Array<IndexedCaptureCandidate> = [];

  function visit(node: Node, path: Array<number>): void {
    collected.push(...enumerateNodeCandidates(node, path, options));
    Array.from(node.childNodes).forEach((child, ordinal) => {
      visit(child, [...path, ordinal]);
    });
  }

  visit(root, []);
  return collected;
}

function recordOriginalEdges(node: Element): Array<OriginalSlotEdge> {
  const edges: Array<OriginalSlotEdge> = [];
  let child: Node = node;
  while (child !== node.ownerDocument) {
    const parent = child.parentNode;
    if (!parent) {
      invalidRemovalBundle();
    }
    const ordinal = Array.prototype.indexOf.call(
      parent.childNodes,
      child
    ) as number;
    if (ordinal < 0) {
      invalidRemovalBundle();
    }
    edges.push(Object.freeze({ child, parent, ordinal }));
    child = parent;
  }
  return edges;
}

function issueNonce(document: Document): string {
  const cryptoSource = document.defaultView?.crypto ?? globalThis.crypto;
  if (!cryptoSource) {
    invalidRemovalBundle();
  }
  const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
  cryptoSource.getRandomValues(bytes);
  return Array.from(bytes, (byte) =>
    byte.toString(HASH_RADIX).padStart(BYTE_HEX_WIDTH, "0")
  ).join("");
}

export function createCaptureRemovalBundle(
  inertSubtree: Element
): CaptureRemovalBundle {
  if (!inertSubtree || inertSubtree.nodeType !== 1) {
    invalidRemovalBundle();
  }
  const document = inertSubtree.ownerDocument;
  const parent = inertSubtree.parentNode;
  if (!(document && parent && inertSubtree.isConnected)) {
    invalidRemovalBundle();
  }

  let relativeCandidates: ReadonlyArray<IndexedCaptureCandidate>;
  let signatures: ReadonlyArray<string>;
  let subtreeNodes: ReadonlyArray<Node>;
  let snapshot: ReadonlyArray<string>;
  let edges: ReadonlyArray<OriginalSlotEdge>;
  let nonce: string;
  try {
    relativeCandidates = Object.freeze(
      enumerateIndexedSubtree(inertSubtree, {
        origin: "synthesized",
        identityRoot: null,
        readComputedStyle: true,
      }).map(freezeIndexedCandidate)
    );
    signatures = Object.freeze(candidateSignatures(relativeCandidates));
    subtreeNodes = Object.freeze(privateSubtreeNodes(inertSubtree));
    snapshot = Object.freeze(privateSubtreeSnapshot(inertSubtree));
    edges = Object.freeze(recordOriginalEdges(inertSubtree));
    nonce = issueNonce(document);
  } catch {
    invalidRemovalBundle();
  }

  const slot = document.createComment(`web-to-figma-capture:${nonce}`);
  const bundle = Object.freeze({}) as CaptureRemovalBundle;
  const state: RemovalBundleState = {
    bundle,
    slot,
    nonce,
    issuanceDocument: document,
    removedRoot: inertSubtree,
    originalEdges: edges,
    relativeCandidates,
    candidateSignatures: signatures,
    candidateSetHash: fnv1a64(signatures),
    subtreeNodes,
    subtreeSnapshot: snapshot,
    subtreeDigest: fnv1a64(snapshot),
    consumed: false,
  };

  parent.replaceChild(slot, inertSubtree);
  removalBundleStates.set(bundle, state);
  removalSlotStates.set(slot, state);
  return bundle;
}

function validateRetainedState(state: RemovalBundleState): void {
  if (
    state.removedRoot.ownerDocument !== state.issuanceDocument ||
    state.removedRoot.parentNode !== null ||
    state.removedRoot.isConnected
  ) {
    invalidRemovalBundle();
  }
  let signatures: Array<string>;
  let subtreeNodes: Array<Node>;
  let snapshot: Array<string>;
  try {
    signatures = candidateSignatures(state.relativeCandidates);
    subtreeNodes = privateSubtreeNodes(state.removedRoot);
    snapshot = privateSubtreeSnapshot(state.removedRoot);
  } catch {
    invalidRemovalBundle();
  }
  if (
    fnv1a64(signatures) !== state.candidateSetHash ||
    !equalStrings(signatures, state.candidateSignatures) ||
    subtreeNodes.length !== state.subtreeNodes.length ||
    !subtreeNodes.every((node, index) => node === state.subtreeNodes[index]) ||
    fnv1a64(snapshot) !== state.subtreeDigest ||
    !equalStrings(snapshot, state.subtreeSnapshot)
  ) {
    invalidRemovalBundle();
  }
}

function validateRemovalBundleForRoot(
  root: Element,
  supplied: CaptureRemovalBundle
): RemovalBundleState {
  if (
    !supplied ||
    (typeof supplied !== "object" && typeof supplied !== "function")
  ) {
    invalidRemovalBundle();
  }
  const state = removalBundleStates.get(supplied as object);
  if (!state || state.bundle !== supplied || state.consumed) {
    invalidRemovalBundle();
  }
  if (
    state.slot.ownerDocument !== root.ownerDocument ||
    state.slot.data !== `web-to-figma-capture:${state.nonce}`
  ) {
    invalidRemovalBundle();
  }

  let reachedRoot = false;
  for (let index = 0; index < state.originalEdges.length; index += 1) {
    const edge = state.originalEdges[index];
    if (!edge) {
      invalidRemovalBundle();
    }
    const expectedChild = index === 0 ? state.slot : edge.child;
    if (edge.parent.childNodes.item(edge.ordinal) !== expectedChild) {
      invalidRemovalBundle();
    }
    if (edge.parent === root) {
      reachedRoot = true;
      break;
    }
  }
  if (!(reachedRoot && root.contains(state.slot))) {
    invalidRemovalBundle();
  }
  validateRetainedState(state);
  return state;
}

function stageRemovalBundles(
  root: Element,
  supplied: ReadonlyArray<CaptureRemovalBundle>
): Readonly<{
  bySlot: ReadonlyMap<Comment, RemovalBundleState>;
  unmatchedIssuedSlot: boolean;
  commit(): void;
}> {
  if (!Array.isArray(supplied)) {
    invalidRemovalBundle();
  }
  const seen = new Set<CaptureRemovalBundle>();
  const states: Array<RemovalBundleState> = [];
  const bySlot = new Map<Comment, RemovalBundleState>();
  for (const bundle of supplied) {
    if (seen.has(bundle)) {
      invalidRemovalBundle();
    }
    seen.add(bundle);
    const state = validateRemovalBundleForRoot(root, bundle);
    if (bySlot.has(state.slot)) {
      invalidRemovalBundle();
    }
    states.push(state);
    bySlot.set(state.slot, state);
  }

  let unmatchedIssuedSlot = false;
  const walker = root.ownerDocument.createTreeWalker(root, SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const issued = removalSlotStates.get(node as Comment);
    if (issued && !bySlot.has(issued.slot)) {
      unmatchedIssuedSlot = true;
    }
  }

  let committed = false;
  return Object.freeze({
    bySlot,
    unmatchedIssuedSlot,
    commit(): void {
      if (committed || states.some((state) => state.consumed)) {
        invalidRemovalBundle();
      }
      for (const state of states) {
        state.consumed = true;
      }
      committed = true;
    },
  });
}

function walkIndexedRoot(
  root: Element,
  staged: ReturnType<typeof stageRemovalBundles>
): Readonly<{
  candidates: Map<string, IndexedCaptureCandidate>;
  originalNodes: Set<Node>;
}> {
  const candidates = new Map<string, IndexedCaptureCandidate>();
  const originalNodes = new Set<Node>();

  function visit(node: Node, path: Array<number>): void {
    originalNodes.add(node);
    const retained =
      node.nodeType === COMMENT_NODE_TYPE
        ? staged.bySlot.get(node as Comment)
        : undefined;
    if (retained) {
      for (const candidate of retained.relativeCandidates) {
        addIndexedCandidate(
          candidates,
          prefixSynthesizedCandidate(path, candidate)
        );
      }
      return;
    }

    const current = enumerateNodeCandidates(node, path, {
      origin: "retained",
      identityRoot: root,
      readComputedStyle: true,
    });
    for (const candidate of current) {
      addIndexedCandidate(candidates, copyIndexedCandidate(candidate));
    }
    Array.from(node.childNodes).forEach((child, ordinal) => {
      visit(child, [...path, ordinal]);
    });
  }

  visit(root, []);
  return { candidates, originalNodes };
}

const PROVENANCE_CODE_SET = new Set<string>(CAPTURE_PROVENANCE_CODES);
const ANNOTATION_KEYS = new Set(["targetId", "eligibilityHint", "provenance"]);
const PROVENANCE_KEYS = new Set(["code", "count"]);

type ValidatedAnnotation = Readonly<{
  targetId: string;
  eligibilityHint: "eligible" | undefined;
  provenance: ReadonlyArray<CaptureProvenance>;
}>;

function annotationArrayLength(value: unknown): number {
  let isArray: boolean;
  let length: unknown;
  try {
    isArray = Array.isArray(value);
    length = isArray ? Reflect.get(value as object, "length") : undefined;
  } catch {
    invalidAnnotation();
  }
  if (!(isArray && Number.isSafeInteger(length)) || (length as number) < 0) {
    invalidAnnotation();
  }
  return length as number;
}

function annotationArrayItem(value: object, index: number): unknown {
  try {
    return Reflect.get(value, String(index));
  } catch {
    invalidAnnotation();
  }
}

function annotationValueIsArray(value: unknown): boolean {
  try {
    return Array.isArray(value);
  } catch {
    invalidAnnotation();
  }
}

function validateAnnotationShape(value: unknown): ValidatedAnnotation {
  if (!value || typeof value !== "object" || annotationValueIsArray(value)) {
    invalidAnnotation();
  }
  let keys: Array<string>;
  let targetId: unknown;
  let eligibilityHint: unknown;
  let provenance: unknown;
  try {
    keys = Object.keys(value);
    const record = value as Record<string, unknown>;
    targetId = record.targetId;
    eligibilityHint = record.eligibilityHint;
    provenance = record.provenance;
  } catch {
    invalidAnnotation();
  }
  if (
    keys.some((key) => !ANNOTATION_KEYS.has(key)) ||
    typeof targetId !== "string" ||
    (eligibilityHint !== undefined && eligibilityHint !== "eligible")
  ) {
    invalidAnnotation();
  }

  const provenanceLength = annotationArrayLength(provenance);
  if (provenanceLength === 0) {
    invalidAnnotation();
  }
  const copied: Array<CaptureProvenance> = [];
  for (let index = 0; index < provenanceLength; index += 1) {
    const valueItem = annotationArrayItem(provenance as object, index);
    if (
      !valueItem ||
      typeof valueItem !== "object" ||
      annotationValueIsArray(valueItem)
    ) {
      invalidAnnotation();
    }
    let itemKeys: Array<string>;
    let code: unknown;
    let count: unknown;
    try {
      itemKeys = Object.keys(valueItem);
      const item = valueItem as Record<string, unknown>;
      code = item.code;
      count = item.count;
    } catch {
      invalidAnnotation();
    }
    if (
      itemKeys.some((key) => !PROVENANCE_KEYS.has(key)) ||
      typeof code !== "string" ||
      !PROVENANCE_CODE_SET.has(code) ||
      !Number.isSafeInteger(count) ||
      (count as number) <= 0
    ) {
      invalidAnnotation();
    }
    copied.push({
      code: code as CaptureProvenanceCode,
      count: count as number,
    });
  }
  return {
    targetId,
    eligibilityHint: eligibilityHint as "eligible" | undefined,
    provenance: copied,
  };
}

function applyAnnotations(
  candidates: Map<string, IndexedCaptureCandidate>,
  supplied: ReadonlyArray<CaptureAnnotation>
): void {
  const suppliedLength = annotationArrayLength(supplied);
  const copied: Array<ValidatedAnnotation> = [];
  for (let index = 0; index < suppliedLength; index += 1) {
    copied[index] = validateAnnotationShape(
      annotationArrayItem(supplied as object, index)
    );
  }
  for (const annotation of copied) {
    const target = candidates.get(annotation.targetId);
    if (!target) {
      invalidAnnotation();
    }

    const merged = new Map<CaptureProvenanceCode, number>();
    for (const item of [...target.provenance, ...annotation.provenance]) {
      const count = (merged.get(item.code) ?? 0) + item.count;
      if (!Number.isSafeInteger(count)) {
        invalidAnnotation();
      }
      merged.set(item.code, count);
    }
    target.provenance = Array.from(merged, ([code, count]) => ({
      code,
      count,
    }));
    if (annotation.eligibilityHint === "eligible") {
      target.eligibilityHint = "eligible";
    }
  }
}

export function indexCaptureSources(
  root: Element,
  options: CaptureIndexOptions = {}
): CaptureSourceIndex {
  if (!root || root.nodeType !== 1 || !root.ownerDocument) {
    throw new TypeError("invalid capture root");
  }

  let removalBundles: ReadonlyArray<CaptureRemovalBundle>;
  let annotations: ReadonlyArray<CaptureAnnotation>;
  try {
    removalBundles = options.removalBundles ?? [];
    annotations = options.annotations ?? [];
  } catch {
    throw new TypeError("invalid capture index options");
  }

  const staged = stageRemovalBundles(root, removalBundles);
  const walked = walkIndexedRoot(root, staged);
  applyAnnotations(walked.candidates, annotations);

  const index = Object.freeze({}) as CaptureSourceIndex;
  sourceIndexStates.set(index, {
    root,
    candidates: walked.candidates,
    originalNodes: walked.originalNodes,
    pseudoCandidates: Array.from(walked.candidates.values()).filter(
      (candidate) => candidate.category === "pseudo" && candidate.host !== null
    ),
    boundProxyBySourceId: new Map(),
    sourceIdByBoundProxy: new WeakMap(),
    sealed: false,
    cachedScan: null,
  });
  staged.commit();
  return index;
}

function requireIndexState(index: CaptureSourceIndex): CaptureSourceIndexState {
  if (!index || (typeof index !== "object" && typeof index !== "function")) {
    throw new TypeError("invalid capture source index");
  }
  const state = sourceIndexStates.get(index as object);
  if (!state) {
    throw new TypeError("invalid capture source index");
  }
  return state;
}

export function listCapturePseudoCandidates(
  index: CaptureSourceIndex
): ReadonlyArray<IndexedPseudoCandidate> {
  const state = requireIndexState(index);
  return Object.freeze(
    state.pseudoCandidates.map((candidate) => {
      if (!(candidate.host && candidate.pseudo)) {
        throw new TypeError("invalid capture source index");
      }
      return Object.freeze({
        sourceId: candidate.id,
        host: candidate.host,
        pseudo: candidate.pseudo,
      });
    })
  );
}

export function bindCaptureProxy(
  index: CaptureSourceIndex,
  sourceId: string,
  proxy: Element
): void {
  const state = requireIndexState(index);
  if (state.sealed) {
    throw new TypeError("sealed capture manifest");
  }
  const candidate = state.candidates.get(sourceId);
  if (
    !candidate ||
    candidate.category !== "pseudo" ||
    !candidate.host ||
    !proxy ||
    proxy.nodeType !== 1 ||
    proxy.ownerDocument !== state.root.ownerDocument ||
    !state.root.contains(proxy) ||
    !candidate.host.contains(proxy) ||
    state.originalNodes.has(proxy) ||
    state.boundProxyBySourceId.has(sourceId) ||
    state.sourceIdByBoundProxy.has(proxy) ||
    globallyBoundCaptureProxies.has(proxy)
  ) {
    invalidProxy();
  }

  state.boundProxyBySourceId.set(sourceId, proxy);
  state.sourceIdByBoundProxy.set(proxy, sourceId);
  globallyBoundCaptureProxies.add(proxy);
}

function finiteRect(
  rect: Pick<DOMRectReadOnly, "x" | "y" | "width" | "height">
): boolean {
  return (
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}

function toRootRect(
  rect: DOMRectReadOnly,
  rootRect: DOMRectReadOnly
): CaptureRect | null {
  if (!(finiteRect(rect) && finiteRect(rootRect))) {
    return null;
  }
  return {
    x: rect.x - rootRect.x,
    y: rect.y - rootRect.y,
    width: rect.width,
    height: rect.height,
  };
}

function unionRects(rects: ReadonlyArray<CaptureRect>): CaptureRect | null {
  if (rects.length === 0 || rects.some((rect) => !finiteRect(rect))) {
    return null;
  }
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function nonUnitZoom(style: CSSStyleDeclaration): boolean {
  const raw = style.getPropertyValue("zoom").trim();
  if (raw === "" || raw === "normal" || raw === "1" || raw === "100%") {
    return false;
  }
  const parsed = raw.endsWith("%")
    ? Number.parseFloat(raw) / PERCENT_SCALE
    : Number.parseFloat(raw);
  return !Number.isFinite(parsed) || parsed !== 1;
}

function coordinateStyleIsUnsafe(style: CSSStyleDeclaration): boolean {
  return (
    style.transform !== "none" ||
    style.perspective !== "none" ||
    style.transformStyle !== "flat" ||
    nonUnitZoom(style)
  );
}

function hasUnsafeCoordinateContext(element: Element, root: Element): boolean {
  if (element.ownerDocument !== root.ownerDocument || !root.contains(element)) {
    return true;
  }
  for (
    let current = element.parentElement;
    current;
    current = current.parentElement
  ) {
    const style = styleOf(current);
    if (!style || coordinateStyleIsUnsafe(style)) {
      return true;
    }
  }
  return false;
}

function hasNonzeroInsets(style: CSSStyleDeclaration): boolean {
  return [
    style.paddingTop,
    style.paddingRight,
    style.paddingBottom,
    style.paddingLeft,
    style.borderTopWidth,
    style.borderRightWidth,
    style.borderBottomWidth,
    style.borderLeftWidth,
  ].some((value) => {
    const parsed = Number.parseFloat(value);
    return !Number.isFinite(parsed) || parsed !== 0;
  });
}

function hasNonzeroMargins(style: CSSStyleDeclaration): boolean {
  return [
    style.marginTop,
    style.marginRight,
    style.marginBottom,
    style.marginLeft,
  ].some((value) => {
    const parsed = Number.parseFloat(value);
    return !Number.isFinite(parsed) || parsed !== 0;
  });
}

function readTransformedLayoutBounds(
  element: Element,
  root: Element,
  style: CSSStyleDeclaration
): CaptureRect | null {
  const rootStyle = styleOf(root);
  const htmlConstructor = element.ownerDocument.defaultView?.HTMLElement;
  const isHtmlElement = Boolean(
    htmlConstructor &&
      Object.prototype.isPrototypeOf.call(htmlConstructor.prototype, element)
  );
  if (
    !(rootStyle && isHtmlElement) ||
    style.position !== "absolute" ||
    rootStyle.position === "static" ||
    style.transformStyle !== "flat" ||
    nonUnitZoom(style) ||
    element.parentElement !== root ||
    (element as HTMLElement).offsetParent !== root ||
    hasNonzeroInsets(style) ||
    hasNonzeroInsets(rootStyle) ||
    hasNonzeroMargins(style) ||
    hasNonzeroMargins(rootStyle)
  ) {
    return null;
  }
  const rect = {
    x: Number.parseFloat(style.left),
    y: Number.parseFloat(style.top),
    width: Number.parseFloat(style.width),
    height: Number.parseFloat(style.height),
  };
  return finiteRect(rect) ? rect : null;
}

function readElementGeometry(
  element: Element,
  root: Element
): CaptureGeometry | null {
  if (element.ownerDocument !== root.ownerDocument || !root.contains(element)) {
    return null;
  }
  const rootRect = root.getBoundingClientRect();
  const visualBounds = toRootRect(element.getBoundingClientRect(), rootRect);
  if (!visualBounds || visualBounds.width === 0 || visualBounds.height === 0) {
    return null;
  }
  const style = styleOf(element);
  if (!style) {
    return null;
  }

  let layoutBounds: CaptureRect | null = null;
  if (!hasUnsafeCoordinateContext(element, root)) {
    if (!coordinateStyleIsUnsafe(style)) {
      layoutBounds = { ...visualBounds };
    } else {
      layoutBounds = readTransformedLayoutBounds(element, root, style);
    }
  }

  return {
    coordinateSpace: "root-css-px-scrolltop-0",
    layoutBounds,
    visualBounds,
    fragments: [{ ...visualBounds }],
    inkBounds: null,
  };
}

function readTextGeometry(text: Text, root: Element): CaptureGeometry | null {
  if (text.ownerDocument !== root.ownerDocument || !root.contains(text)) {
    return null;
  }
  const range = text.ownerDocument.createRange();
  range.selectNodeContents(text);
  const rootRect = root.getBoundingClientRect();
  const fragments = Array.from(range.getClientRects())
    .map((rect) => toRootRect(rect, rootRect))
    .filter(
      (rect): rect is CaptureRect =>
        rect !== null && rect.width > 0 && rect.height > 0
    );
  range.detach();
  const visualBounds = unionRects(fragments);
  if (!visualBounds) {
    return null;
  }
  return {
    coordinateSpace: "root-css-px-scrolltop-0",
    layoutBounds: null,
    visualBounds,
    fragments,
    inkBounds: null,
  };
}

function readCandidateGeometry(
  candidate: IndexedCaptureCandidate,
  state: CaptureSourceIndexState
): CaptureGeometry | null {
  const proxy = state.boundProxyBySourceId.get(candidate.id);
  if (proxy) {
    return readElementGeometry(proxy, state.root);
  }
  if (candidate.category === "pseudo" || !candidate.node) {
    return null;
  }
  if (candidate.node.nodeType === 1) {
    return readElementGeometry(candidate.node as Element, state.root);
  }
  if (candidate.node.nodeType === TEXT_NODE_TYPE) {
    return readTextGeometry(candidate.node as Text, state.root);
  }
  return null;
}

function addProvenanceOnce(
  provenance: Array<CaptureProvenance>,
  code: CaptureProvenanceCode
): Array<CaptureProvenance> {
  return provenance.some((item) => item.code === code)
    ? provenance
    : [...provenance, { code, count: 1 }];
}

function isOriginalNodeMutated(candidate: IndexedCaptureCandidate): boolean {
  if (candidate.origin !== "retained") {
    return false;
  }
  const identityNode = candidate.node ?? candidate.host;
  if (!(identityNode && candidate.originalAncestorChain)) {
    return true;
  }
  let current = identityNode.parentNode;
  for (const expected of candidate.originalAncestorChain) {
    if (current !== expected) {
      return true;
    }
    current = current.parentNode;
  }
  return current !== null;
}

function effectiveElement(
  candidate: IndexedCaptureCandidate,
  state: CaptureSourceIndexState
): Element | null {
  const proxy = state.boundProxyBySourceId.get(candidate.id);
  if (proxy) {
    return proxy;
  }
  if (candidate.node?.nodeType === 1) {
    return candidate.node as Element;
  }
  if (candidate.node?.nodeType === TEXT_NODE_TYPE) {
    return candidate.node.parentElement;
  }
  return candidate.host;
}

function globalNonpaintingProof(
  element: Element,
  root: Element
): NonPaintingProof {
  const effectiveStyle = styleOf(element);
  if (!effectiveStyle) {
    return "unproven";
  }
  if (
    effectiveStyle.visibility === "hidden" ||
    effectiveStyle.visibility === "collapse"
  ) {
    return "proven-nonpainting";
  }

  let reachedRoot = false;
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const style = styleOf(current);
    if (!style) {
      return "unproven";
    }
    const opacity = Number.parseFloat(style.opacity);
    if (style.display === "none" || opacity === 0) {
      return "proven-nonpainting";
    }
    if (!Number.isFinite(opacity)) {
      return "unproven";
    }
    if (current === root) {
      reachedRoot = true;
      break;
    }
  }
  return reachedRoot ? "paintable" : "unproven";
}

function valueIsZero(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "0" || trimmed === "0px") {
    return true;
  }
  const numbers = trimmed.match(CSS_NUMBER_PATTERN);
  return Boolean(
    numbers && numbers.length > 0 && numbers.every((item) => Number(item) === 0)
  );
}

function hasUncertainClipOrInk(style: CSSStyleDeclaration): boolean {
  const opacity = Number.parseFloat(style.opacity);
  const roundedClip = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ].some((value) => !valueIsZero(value));
  const overflowClipMargin = style
    .getPropertyValue("overflow-clip-margin")
    .trim();
  const legacyClip = style.getPropertyValue("clip").trim();
  const contain = style.getPropertyValue("contain").trim();
  const webkitMask = style.getPropertyValue("-webkit-mask-image").trim();
  const webkitClipPath = style.getPropertyValue("-webkit-clip-path").trim();

  return (
    coordinateStyleIsUnsafe(style) ||
    !Number.isFinite(opacity) ||
    opacity !== 1 ||
    style.isolation !== "auto" ||
    roundedClip ||
    (overflowClipMargin !== "" && !valueIsZero(overflowClipMargin)) ||
    (legacyClip !== "" && legacyClip !== "auto") ||
    contain
      .split(WHITESPACE_PATTERN)
      .some((part) => ["paint", "strict", "content"].includes(part)) ||
    style.filter !== "none" ||
    style.backdropFilter !== "none" ||
    style.clipPath !== "none" ||
    (webkitClipPath !== "" && webkitClipPath !== "none") ||
    style.maskImage !== "none" ||
    (webkitMask !== "" && webkitMask !== "none") ||
    style.mixBlendMode !== "normal"
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: conservative axis-by-axis clipping proof intentionally fails closed at every uncertain dependency.
function classifyOverflowClip(
  element: Element,
  visualBounds: CaptureRect,
  root: Element
): NonPaintingProof {
  const elementStyle = styleOf(element);
  if (!elementStyle || hasUncertainClipOrInk(elementStyle)) {
    return "unproven";
  }

  let visible = visualBounds;
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor === root ? null : ancestor.parentElement
  ) {
    const style = styleOf(ancestor);
    if (!style || hasUncertainClipOrInk(style)) {
      return "unproven";
    }
    const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
    const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
    if (!(clipsX || clipsY)) {
      continue;
    }

    const bounds = toRootRect(
      ancestor.getBoundingClientRect(),
      root.getBoundingClientRect()
    );
    if (!bounds) {
      return "unproven";
    }
    const left = clipsX ? Math.max(visible.x, bounds.x) : visible.x;
    const right = clipsX
      ? Math.min(visible.x + visible.width, bounds.x + bounds.width)
      : visible.x + visible.width;
    const top = clipsY ? Math.max(visible.y, bounds.y) : visible.y;
    const bottom = clipsY
      ? Math.min(visible.y + visible.height, bounds.y + bounds.height)
      : visible.y + visible.height;
    if (right <= left || bottom <= top) {
      return "proven-nonpainting";
    }
    visible = {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  }
  return "paintable";
}

function classifyNonPainting(
  candidate: IndexedCaptureCandidate,
  geometry: CaptureGeometry | null,
  state: CaptureSourceIndexState
): Readonly<{
  result: NonPaintingProof;
  provenance: Array<CaptureProvenance>;
}> {
  let provenance = candidate.provenance.map((item) => ({ ...item }));

  if (candidate.detailCode === "script-code-text") {
    return { result: "proven-nonpainting", provenance };
  }
  if (isOriginalNodeMutated(candidate)) {
    provenance = addProvenanceOnce(provenance, "indexed-node-mutated-unproven");
    return { result: "paintable", provenance };
  }
  if (candidate.sourceKind === "BASE") {
    return { result: "proven-nonpainting", provenance };
  }
  if (candidate.eligibilityHint === "eligible") {
    return { result: "paintable", provenance };
  }
  if (candidate.forcedEligibility === "eligible") {
    return { result: "paintable", provenance };
  }
  if (candidate.forcedEligibility === "excluded") {
    return { result: "proven-nonpainting", provenance };
  }

  const element = effectiveElement(candidate, state);
  if (!element) {
    provenance = addProvenanceOnce(
      provenance,
      candidate.category === "pseudo"
        ? "pseudo-proxy-unbound"
        : "candidate-parse-unproven"
    );
    return { result: "unproven", provenance };
  }

  const globalProof = globalNonpaintingProof(element, state.root);
  if (globalProof === "proven-nonpainting") {
    return { result: globalProof, provenance };
  }
  if (globalProof === "unproven") {
    provenance = addProvenanceOnce(provenance, "candidate-parse-unproven");
    return { result: globalProof, provenance };
  }

  const boundPseudo =
    candidate.category === "pseudo" &&
    state.boundProxyBySourceId.has(candidate.id);
  if (candidate.category === "pseudo" && !boundPseudo) {
    provenance = addProvenanceOnce(provenance, "pseudo-proxy-unbound");
    return { result: "unproven", provenance };
  }
  if (!candidate.completePaintBoundedByPrincipalBox) {
    provenance = addProvenanceOnce(provenance, "candidate-parse-unproven");
    return { result: "unproven", provenance };
  }
  if (geometry === null) {
    return { result: "proven-nonpainting", provenance };
  }

  const clipped = classifyOverflowClip(
    element,
    geometry.visualBounds,
    state.root
  );
  if (clipped === "unproven") {
    provenance = addProvenanceOnce(provenance, "candidate-parse-unproven");
  }
  return { result: clipped, provenance };
}

function finalizeCandidate(
  candidate: IndexedCaptureCandidate,
  state: CaptureSourceIndexState
): CaptureManifestEntry {
  const geometry = readCandidateGeometry(candidate, state);
  const classified = classifyNonPainting(candidate, geometry, state);
  const eligibility: CaptureEligibility =
    classified.result === "proven-nonpainting" ? "excluded" : "eligible";
  return {
    id: candidate.id,
    path: candidate.path.slice(),
    category: candidate.category,
    ordinal: candidate.ordinal,
    sourceKind: candidate.sourceKind,
    detailCode: candidate.detailCode,
    eligibility,
    contentRelevant:
      eligibility === "eligible" && candidate.category !== "decoration",
    editableRelevant: eligibility === "eligible",
    geometry,
    provenance: classified.provenance,
    resourceFacts: EMPTY_RESOURCE_FACTS,
    fallbackPolicies: EMPTY_FALLBACK_POLICIES,
    requiredHierarchyEdgeIds: EMPTY_HIERARCHY_EDGE_IDS,
    requiredPaintEdgeIds: EMPTY_PAINT_EDGE_IDS,
  };
}

function freezeRect(rect: CaptureRect): CaptureRect {
  return Object.freeze({ ...rect });
}

function freezeGeometry(
  geometry: CaptureGeometry | null
): CaptureGeometry | null {
  if (!geometry) {
    return null;
  }
  return Object.freeze({
    coordinateSpace: geometry.coordinateSpace,
    layoutBounds: geometry.layoutBounds
      ? freezeRect(geometry.layoutBounds)
      : null,
    visualBounds: freezeRect(geometry.visualBounds),
    fragments: Object.freeze(geometry.fragments.map(freezeRect)),
    inkBounds: geometry.inkBounds ? freezeRect(geometry.inkBounds) : null,
  });
}

function freezeEntry(entry: CaptureManifestEntry): CaptureManifestEntry {
  return Object.freeze({
    ...entry,
    path: Object.freeze(entry.path.slice()),
    geometry: freezeGeometry(entry.geometry),
    provenance: Object.freeze(
      entry.provenance.map((item) => Object.freeze({ ...item }))
    ),
    resourceFacts: EMPTY_RESOURCE_FACTS,
    fallbackPolicies: EMPTY_FALLBACK_POLICIES,
    requiredHierarchyEdgeIds: EMPTY_HIERARCHY_EDGE_IDS,
    requiredPaintEdgeIds: EMPTY_PAINT_EDGE_IDS,
  });
}

function buildNodeLookup(
  state: CaptureSourceIndexState,
  entries: ReadonlyArray<CaptureManifestEntry>
): WeakMap<Node, ReadonlyArray<string>> {
  const mutable = new Map<Node, Array<string>>();
  for (const entry of entries) {
    const candidate = state.candidates.get(entry.id);
    if (!candidate) {
      throw new TypeError("invalid capture source index");
    }
    const node = state.boundProxyBySourceId.get(entry.id) ?? candidate.node;
    if (!node) {
      continue;
    }
    const isOriginal = state.originalNodes.has(node);
    const isBoundProxy =
      node.nodeType === 1 && state.sourceIdByBoundProxy.has(node as Element);
    if (!(isOriginal || isBoundProxy)) {
      continue;
    }
    const ids = mutable.get(node) ?? [];
    ids.push(entry.id);
    mutable.set(node, ids);
  }

  const lookup = new WeakMap<Node, ReadonlyArray<string>>();
  for (const [node, ids] of mutable) {
    lookup.set(node, Object.freeze(ids.slice()));
  }
  return lookup;
}

function buildSummary(
  entries: ReadonlyArray<CaptureManifestEntry>
): CaptureManifest["summary"] {
  const byCategory = Object.fromEntries(
    CONTRIBUTION_CATEGORIES.map((category) => [category, 0])
  ) as Record<ContributionCategory, number>;
  let excluded = 0;
  for (const entry of entries) {
    byCategory[entry.category] += 1;
    if (entry.eligibility === "excluded") {
      excluded += 1;
    }
  }
  const summary = Object.freeze({
    scanned: entries.length,
    excluded,
    eligible: entries.length - excluded,
    byCategory: Object.freeze(byCategory),
  });
  if (summary.scanned !== summary.excluded + summary.eligible) {
    throw new TypeError("invalid capture manifest summary");
  }
  return summary;
}

const CAPTURE_PROOFS = Object.freeze({
  sourceInventoryComplete: false,
  resourceProofComplete: false,
  hierarchyProofComplete: false,
  paintOrderProofComplete: false,
} as const);

function assertManifestInvariants(manifest: CaptureManifest): void {
  if (
    manifest.summary.scanned !== manifest.entries.length ||
    manifest.summary.scanned !==
      manifest.summary.excluded + manifest.summary.eligible
  ) {
    throw new TypeError("invalid capture manifest summary");
  }
  for (const entry of manifest.entries) {
    if (
      !(
        Object.isFrozen(entry) &&
        Object.isFrozen(entry.path) &&
        Object.isFrozen(entry.provenance) &&
        CAPTURE_DETAIL_CODES.includes(entry.detailCode) &&
        CAPTURE_SOURCE_KINDS.includes(entry.sourceKind)
      )
    ) {
      throw new TypeError("invalid frozen capture manifest");
    }
  }
}

export function scanCaptureManifest(
  index: CaptureSourceIndex
): CaptureManifestScan {
  const state = requireIndexState(index);
  if (state.cachedScan) {
    return state.cachedScan;
  }
  if (state.sealed) {
    throw new TypeError("sealed capture manifest");
  }
  state.sealed = true;

  const entries = Object.freeze(
    Array.from(state.candidates.values(), (candidate) =>
      freezeEntry(finalizeCandidate(candidate, state))
    )
  );
  const nodeLookup = buildNodeLookup(state, entries);
  const manifest: CaptureManifest = Object.freeze({
    entries,
    hierarchyEdges: EMPTY_HIERARCHY_EDGES,
    paintEdges: EMPTY_PAINT_EDGES,
    proofs: CAPTURE_PROOFS,
    summary: buildSummary(entries),
  });
  assertManifestInvariants(manifest);

  const scan: CaptureManifestScan = Object.freeze({
    manifest,
    entryIdsForNode(node: Node): ReadonlyArray<string> {
      return nodeLookup.get(node) ?? EMPTY_ENTRY_IDS;
    },
  });
  state.cachedScan = scan;
  return scan;
}
