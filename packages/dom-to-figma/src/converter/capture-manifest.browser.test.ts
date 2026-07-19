import { afterEach, describe, expect, it } from "vitest";
import type {
  CaptureAnnotation,
  CaptureIndexOptions,
} from "./capture-manifest";
import {
  bindCaptureProxy,
  createCaptureRemovalBundle,
  indexCaptureSources,
  listCapturePseudoCandidates,
  scanCaptureManifest,
} from "./capture-manifest";

afterEach(() => {
  document.body.innerHTML = "";
});

const indexSettled = (root: Element, options: CaptureIndexOptions = {}) =>
  indexCaptureSources(root, options);

const requireValue = <T>(
  value: T | null | undefined,
  message = "expected fixture value"
): T => {
  if (value === null || value === undefined) {
    throw new TypeError(message);
  }
  return value;
};

const queryRequired = <T extends Element>(
  root: ParentNode,
  selector: string
): T =>
  requireValue(
    root.querySelector<T>(selector),
    `missing fixture selector: ${selector}`
  );

const requireText = (node: ChildNode | null | undefined): Text => {
  const required = requireValue(node, "missing fixture Text node");
  if (required.nodeType !== Node.TEXT_NODE) {
    throw new TypeError("expected fixture Text node");
  }
  return required as Text;
};

const captureThrown = (operation: () => unknown): unknown => {
  try {
    operation();
  } catch (error) {
    return error;
  }
  return;
};

const getOnlyRemovalSlot = (root: Element): Comment => {
  const slots = Array.from(root.childNodes).filter(
    (node): node is Comment => node.nodeType === Node.COMMENT_NODE
  );
  expect(slots).toHaveLength(1);
  return requireValue(slots[0], "missing capture removal slot");
};

describe("capture source identity", () => {
  it("preserves a removed slot and synthesizes every removed-subtree candidate", () => {
    document.body.innerHTML = `<main id="root"><div></div><script type="application/x-web-to-figma-inert">secret code</script><p>safe</p></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const script = queryRequired(root, "script");
    const removalBundle = createCaptureRemovalBundle(script);
    const annotations: Array<CaptureAnnotation> = [
      {
        targetId: "0:structure:0",
        eligibilityHint: "eligible",
        provenance: [{ code: "inline-event-handler", count: 2 }],
      },
    ];

    const manifest = scanCaptureManifest(
      indexSettled(root, { removalBundles: [removalBundle], annotations })
    ).manifest;

    expect(manifest.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "0:structure:0",
        "1:structure:0",
        "1.0:text:0",
        "2:structure:0",
      ])
    );
    expect(
      manifest.entries.filter((entry) => entry.id === "0:structure:0")
    ).toHaveLength(1);
    expect(
      manifest.entries.find((entry) => entry.id === "0:structure:0")?.provenance
    ).toEqual([{ code: "inline-event-handler", count: 2 }]);
    expect(
      manifest.entries.find((entry) => entry.id === "0:structure:0")
        ?.eligibility
    ).toBe("eligible");
    expect(
      manifest.entries.find((entry) => entry.id === "1:structure:0")
        ?.eligibility
    ).toBe("eligible");
    expect(
      manifest.entries.find((entry) => entry.id === "1.0:text:0")?.eligibility
    ).toBe("excluded");
    expect(JSON.stringify(manifest)).not.toContain("secret code");
    expect(JSON.stringify(manifest)).not.toContain("safe");
  });

  it("synthesizes every candidate in a complex removed subtree", () => {
    document.body.innerHTML = `<style>#removed{background-color:rgb(1 2 3)}#removed::before{content:"";display:block;width:2px;height:2px;background:red}</style><main id="root"><section id="removed"><span>nested</span><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E"><svg width="2" height="2"><rect width="2" height="2"></rect></svg><input value="retained"></section><p>surviving</p></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const section = queryRequired(root, "section");
    const bundle = createCaptureRemovalBundle(section);

    const manifest = scanCaptureManifest(
      indexSettled(root, {
        removalBundles: [bundle],
      })
    ).manifest;
    const removedCandidates = [
      ["0:structure:0", "structure"],
      ["0.0:structure:0", "structure"],
      ["0.0.0:text:0", "text"],
      ["0.1:structure:0", "structure"],
      ["0.1:image:0", "image"],
      ["0.2:structure:0", "structure"],
      ["0.2:svg:0", "svg"],
      ["0.2.0:structure:0", "structure"],
      ["0.2.0:svg:0", "svg"],
      ["0.3:structure:0", "structure"],
      ["0.3:form-state:0", "form-state"],
      ["0:pseudo:0", "pseudo"],
      ["0:decoration:0", "decoration"],
    ] as const;

    for (const [id, category] of removedCandidates) {
      expect(manifest.entries.filter((entry) => entry.id === id)).toEqual([
        expect.objectContaining({ id, category }),
      ]);
    }
    expect(
      manifest.entries.filter((entry) => entry.id === "1:structure:0")
    ).toHaveLength(1);
  });

  it("merges annotations into one target in deterministic first-seen order", () => {
    document.body.innerHTML = `<main id="root"><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const annotations: Array<CaptureAnnotation> = [
      {
        targetId: "0:structure:0",
        provenance: [{ code: "inline-event-handler", count: 1 }],
      },
      {
        targetId: "0:structure:0",
        provenance: [
          { code: "unsupported-runtime", count: 1 },
          { code: "inline-event-handler", count: 1 },
        ],
      },
    ];

    const manifest = scanCaptureManifest(
      indexSettled(root, { annotations })
    ).manifest;
    const target = manifest.entries.filter(
      (entry) => entry.id === "0:structure:0"
    );

    expect(target).toHaveLength(1);
    expect(requireValue(target[0]).provenance).toEqual([
      { code: "inline-event-handler", count: 2 },
      { code: "unsupported-runtime", count: 1 },
    ]);
  });

  it("rejects a forged removal bundle and unsafe annotation code", () => {
    document.body.innerHTML = `<main id="root"><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const forged = {} as unknown as ReturnType<
      typeof createCaptureRemovalBundle
    >;
    expect(() => indexSettled(root, { removalBundles: [forged] })).toThrow(
      /invalid capture removal bundle/i
    );
    const unsafe = {
      targetId: "0:structure:0",
      provenance: [{ code: "https://secret.test/customer", count: 1 }],
    } as unknown as CaptureAnnotation;
    expect(() => indexSettled(root, { annotations: [unsafe] })).toThrow(
      /invalid capture annotation/i
    );
  });

  it("rejects unsafe annotations when a real Array overrides map", () => {
    document.body.innerHTML = `<main id="root"><script type="application/x-web-to-figma-inert">code</script><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const bundle = createCaptureRemovalBundle(queryRequired(root, "script"));
    const secret = "https://private.test/customer";
    const unsafe = {
      targetId: "1:structure:0",
      provenance: [{ code: secret, count: 1 }],
    } as unknown as CaptureAnnotation;
    const annotations: Array<CaptureAnnotation> = [unsafe];
    Object.defineProperty(annotations, "map", {
      value: () => [unsafe],
    });

    const thrown = captureThrown(() =>
      indexSettled(root, { removalBundles: [bundle], annotations })
    );
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toMatch(/invalid capture annotation/i);
    expect((thrown as Error).message).not.toContain(secret);
    expect(() =>
      indexSettled(root, { removalBundles: [bundle] })
    ).not.toThrow();
  });

  it("normalizes hostile annotation Array getter errors atomically", () => {
    document.body.innerHTML = `<main id="root"><script type="application/x-web-to-figma-inert">code</script><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const bundle = createCaptureRemovalBundle(queryRequired(root, "script"));
    const secret = "customer-private-array-getter";
    const valid: CaptureAnnotation = {
      targetId: "1:structure:0",
      provenance: [{ code: "inline-event-handler", count: 1 }],
    };
    const annotations = new Proxy<Array<CaptureAnnotation>>([valid], {
      get(target, property, receiver) {
        if (property === "0") {
          throw new Error(secret);
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const thrown = captureThrown(() =>
      indexSettled(root, { removalBundles: [bundle], annotations })
    );
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toMatch(/invalid capture annotation/i);
    expect((thrown as Error).message).not.toContain(secret);
    expect(() =>
      indexSettled(root, { removalBundles: [bundle] })
    ).not.toThrow();
  });

  it("validates the retained candidate set and digest without partial consumption", () => {
    document.body.innerHTML = `<main id="root"><script type="application/x-web-to-figma-inert">code</script><p>safe</p></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const script = queryRequired(root, "script");
    const bundle = createCaptureRemovalBundle(script);
    const injected = document.createElement("i");
    script.append(injected);

    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );

    injected.remove();
    const manifest = scanCaptureManifest(
      indexSettled(root, { removalBundles: [bundle] })
    ).manifest;
    expect(manifest.entries.some((entry) => entry.id === "0:structure:0")).toBe(
      true
    );
    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );
  });

  it("rejects exact detached Text and attribute mutations without consuming the bundle", () => {
    document.body.innerHTML = `<main id="root"><script type="application/x-web-to-figma-inert" data-proof="original">code</script></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const script = queryRequired(root, "script");
    const text = requireText(script.firstChild);
    const bundle = createCaptureRemovalBundle(script);

    script.setAttribute("data-proof", "changed");
    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );
    script.setAttribute("data-proof", "original");

    text.data = "changed";
    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );
    text.data = "code";

    expect(() =>
      indexSettled(root, { removalBundles: [bundle] })
    ).not.toThrow();
  });

  it("rejects a reattached removed root without consuming the bundle", () => {
    document.body.innerHTML = `<main id="root"><script type="application/x-web-to-figma-inert">code</script></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const script = queryRequired(root, "script");
    const bundle = createCaptureRemovalBundle(script);

    root.append(script);
    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );

    script.remove();
    expect(() =>
      indexSettled(root, { removalBundles: [bundle] })
    ).not.toThrow();
  });

  it("rejects an adopted removed root without consuming the bundle", () => {
    document.body.innerHTML = `<main id="root"><script type="application/x-web-to-figma-inert">code</script></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const script = queryRequired(root, "script");
    const bundle = createCaptureRemovalBundle(script);
    const foreignDocument = document.implementation.createHTMLDocument();

    foreignDocument.adoptNode(script);
    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );

    document.adoptNode(script);
    expect(() =>
      indexSettled(root, { removalBundles: [bundle] })
    ).not.toThrow();
  });

  it("freezes mixed child-node paths deterministically before later sibling insertion", () => {
    document.body.innerHTML = `<main id="root">alpha<!--slot--><span>beta</span>omega</main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const firstIndex = indexSettled(root);
    const secondIndex = indexSettled(root);
    root.prepend(document.createComment("post-index"));

    const firstIds = scanCaptureManifest(firstIndex).manifest.entries.map(
      (entry) => entry.id
    );
    const secondIds = scanCaptureManifest(secondIndex).manifest.entries.map(
      (entry) => entry.id
    );
    expect(firstIds).toEqual([
      "root:structure:0",
      "0:text:0",
      "2:structure:0",
      "2.0:text:0",
      "3:text:0",
    ]);
    expect(secondIds).toEqual(firstIds);
  });

  it("rejects a moved or cloned nonce slot without consuming the bundle", () => {
    document.body.innerHTML = `<main id="root"><div></div><script type="application/x-web-to-figma-inert">code</script><p></p></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const bundle = createCaptureRemovalBundle(queryRequired(root, "script"));
    const slot = getOnlyRemovalSlot(root);
    const originalNext = slot.nextSibling;

    root.prepend(slot);
    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );
    root.insertBefore(slot, originalNext);

    const clone = document.createComment(slot.data);
    slot.replaceWith(clone);
    expect(() => indexSettled(root, { removalBundles: [bundle] })).toThrow(
      /invalid capture removal bundle/i
    );
    clone.replaceWith(slot);

    expect(() =>
      indexSettled(root, { removalBundles: [bundle] })
    ).not.toThrow();
  });

  it("rejects cross-root and extra bundles atomically", () => {
    document.body.innerHTML = `<main id="left"><script type="application/x-web-to-figma-inert">a</script></main><main id="right"><script type="application/x-web-to-figma-inert">b</script></main>`;
    const left = queryRequired<HTMLElement>(document, "#left");
    const right = queryRequired<HTMLElement>(document, "#right");
    const leftBundle = createCaptureRemovalBundle(
      queryRequired(left, "script")
    );
    const rightBundle = createCaptureRemovalBundle(
      queryRequired(right, "script")
    );
    const leftSlot = getOnlyRemovalSlot(left);

    right.append(leftSlot);
    expect(() => indexSettled(right, { removalBundles: [leftBundle] })).toThrow(
      /invalid capture removal bundle/i
    );
    left.append(leftSlot);

    expect(() =>
      indexSettled(left, {
        removalBundles: [leftBundle, rightBundle],
      })
    ).toThrow(/invalid capture removal bundle/i);
    expect(() =>
      indexSettled(left, { removalBundles: [leftBundle] })
    ).not.toThrow();
    expect(() =>
      indexSettled(right, { removalBundles: [rightBundle] })
    ).not.toThrow();
  });

  it("keeps an unmatched issued slot unproven and lets a later matched index use it", () => {
    document.body.innerHTML = `<main id="root"><script type="application/x-web-to-figma-inert">code</script></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const bundle = createCaptureRemovalBundle(queryRequired(root, "script"));
    const unmatched = scanCaptureManifest(indexSettled(root)).manifest;
    expect(unmatched.proofs.sourceInventoryComplete).toBe(false);
    expect(
      unmatched.entries.some((entry) => entry.id === "0:structure:0")
    ).toBe(false);

    const matched = scanCaptureManifest(
      indexSettled(root, { removalBundles: [bundle] })
    ).manifest;
    expect(matched.entries.some((entry) => entry.id === "0:structure:0")).toBe(
      true
    );
  });

  it("separates runtime scripts from inert data scripts and excludes all script Text", () => {
    document.body.innerHTML =
      `<main id="root"><script>classic()</script>` +
      `<script type="module">module()</script>` +
      `<script type="text/javascript">mime()</script>` +
      `<script type="application/x-web-to-figma-inert">neutralized()</script>` +
      `<script type="application/json">{"private":true}</script>` +
      `<script type="application/ld+json">{"@type":"Thing"}</script></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const entries = scanCaptureManifest(indexSettled(root)).manifest.entries;

    expect(
      [0, 1, 2, 3].map(
        (index) =>
          entries.find((entry) => entry.id === `${index}:structure:0`)
            ?.eligibility
      )
    ).toEqual(["eligible", "eligible", "eligible", "eligible"]);
    expect(
      [4, 5].map(
        (index) =>
          entries.find((entry) => entry.id === `${index}:structure:0`)
            ?.eligibility
      )
    ).toEqual(["excluded", "excluded"]);
    expect(
      [0, 1, 2, 3, 4, 5].map(
        (index) =>
          entries.find((entry) => entry.id === `${index}.0:text:0`)?.eligibility
      )
    ).toEqual([
      "excluded",
      "excluded",
      "excluded",
      "excluded",
      "excluded",
      "excluded",
    ]);
  });

  it("lets a closed eligible annotation conservatively promote an inert data script", () => {
    document.body.innerHTML = `<main id="root"><script type="application/json">{"data":true}</script></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const annotations: Array<CaptureAnnotation> = [
      {
        targetId: "0:structure:0",
        eligibilityHint: "eligible",
        provenance: [{ code: "unsupported-runtime", count: 1 }],
      },
    ];
    const entries = scanCaptureManifest(indexSettled(root, { annotations }))
      .manifest.entries;

    expect(entries.find((entry) => entry.id === "0:structure:0")).toEqual(
      expect.objectContaining({
        eligibility: "eligible",
        provenance: expect.arrayContaining([
          {
            code: "unsupported-runtime",
            count: 1,
          },
        ]),
      })
    );
    expect(
      entries.find((entry) => entry.id === "0.0:text:0")?.eligibility
    ).toBe("excluded");
  });

  it("keeps removed runtime eligible but excludes removed BASE and data metadata", () => {
    document.body.innerHTML =
      `<main id="root"><base href="https://private.test/">` +
      `<script type="application/x-web-to-figma-inert">runtime()</script>` +
      `<script type="application/json">{"data":true}</script>` +
      "<p>visible</p></main>";
    const root = queryRequired<HTMLElement>(document, "#root");
    const bundles = Array.from(
      root.querySelectorAll("base,script"),
      (element) => createCaptureRemovalBundle(element)
    );
    const entries = scanCaptureManifest(
      indexSettled(root, {
        removalBundles: bundles,
      })
    ).manifest.entries;

    expect(
      entries.find((entry) => entry.id === "0:structure:0")?.eligibility
    ).toBe("excluded");
    expect(
      entries.find((entry) => entry.id === "1:structure:0")?.eligibility
    ).toBe("eligible");
    expect(
      entries.find((entry) => entry.id === "2:structure:0")?.eligibility
    ).toBe("excluded");
    expect(
      entries.find((entry) => entry.id === "3:structure:0")?.eligibility
    ).toBe("eligible");
    expect(
      ["1.0:text:0", "2.0:text:0"].map(
        (id) => entries.find((entry) => entry.id === id)?.eligibility
      )
    ).toEqual(["excluded", "excluded"]);
  });
});

describe("capture manifest geometry and settlement", () => {
  it("reserves the after ordinal and maps a bound post-index proxy only to the pseudo source", () => {
    document.body.innerHTML = `<style>#root::after{content:"";display:block;width:10px;height:10px;background:red}</style><main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const index = indexSettled(root);

    expect(
      listCapturePseudoCandidates(index).map(({ sourceId, pseudo }) => [
        sourceId,
        pseudo,
      ])
    ).toEqual([["root:pseudo:1", "after"]]);

    const proxy = document.createElement("span");
    proxy.style.cssText = "display:block;width:10px;height:10px;background:red";
    root.append(proxy);
    bindCaptureProxy(index, "root:pseudo:1", proxy);

    const scan = scanCaptureManifest(index);
    const pseudo = requireValue(
      scan.manifest.entries.find((entry) => entry.id === "root:pseudo:1")
    );
    expect(scan.entryIdsForNode(proxy)).toEqual(["root:pseudo:1"]);
    expect(scan.entryIdsForNode(root)).not.toContain("root:pseudo:1");
    expect(pseudo.geometry?.visualBounds.width).toBe(10);
    expect(pseudo.geometry?.visualBounds.height).toBe(10);
  });

  it("keeps an active unbound before pseudo eligible and unproven", () => {
    document.body.innerHTML = `<style>#root::before{content:"";display:block;width:8px;height:8px;filter:blur(1px)}</style><main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;
    const pseudo = requireValue(
      manifest.entries.find((entry) => entry.id === "root:pseudo:0")
    );

    expect(pseudo.eligibility).toBe("eligible");
    expect(pseudo.geometry).toBeNull();
    expect(pseudo.provenance).toEqual([
      { code: "pseudo-proxy-unbound", count: 1 },
    ]);
    expect(manifest.proofs.paintOrderProofComplete).toBe(false);
  });

  it("enumerates opaque but not transparent outline-only pseudos", () => {
    document.body.innerHTML =
      "<style>#opaque::after,#transparent::after{content:none;display:block;width:4px;height:4px}" +
      "#opaque::after{outline:2px solid red}" +
      "#transparent::after{outline:2px solid rgba(1,2,3,0)}</style>" +
      `<main id="root"><div id="opaque"></div><div id="transparent"></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const index = indexSettled(root);

    expect(
      listCapturePseudoCandidates(index).map(({ sourceId, pseudo }) => [
        sourceId,
        pseudo,
      ])
    ).toEqual([["0:pseudo:1", "after"]]);

    const manifest = scanCaptureManifest(index).manifest;
    const opaque = requireValue(
      manifest.entries.find((entry) => entry.id === "0:pseudo:1")
    );
    expect(opaque.eligibility).toBe("eligible");
    expect(opaque.geometry).toBeNull();
    expect(opaque.provenance).toEqual([
      { code: "pseudo-proxy-unbound", count: 1 },
    ]);
    expect(manifest.entries.some((entry) => entry.id === "1:pseudo:1")).toBe(
      false
    );
  });

  it("validates capture proxies atomically across roots, realms, and source reuse", () => {
    document.body.innerHTML = `<style>#root::before,#root::after{content:"";display:block;width:4px;height:4px;background:red}</style><main id="root"><span></span></main><aside id="outside"></aside>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const original = queryRequired(root, "span");
    const outside = queryRequired<HTMLElement>(document, "#outside");
    const index = indexSettled(root);
    const candidates = listCapturePseudoCandidates(index);
    expect(
      candidates.map(({ sourceId, pseudo }) => [sourceId, pseudo])
    ).toEqual([
      ["root:pseudo:0", "before"],
      ["root:pseudo:1", "after"],
    ]);

    expect(() => bindCaptureProxy(index, "root:pseudo:0", original)).toThrow(
      /invalid capture proxy/i
    );
    expect(() => bindCaptureProxy(index, "root:pseudo:0", outside)).toThrow(
      /invalid capture proxy/i
    );

    const foreignDocument = document.implementation.createHTMLDocument();
    const foreign = foreignDocument.createElement("span");
    expect(() => bindCaptureProxy(index, "root:pseudo:0", foreign)).toThrow(
      /invalid capture proxy/i
    );

    const proxy = document.createElement("span");
    root.append(proxy);
    expect(() => bindCaptureProxy(index, "root:pseudo:0", proxy)).not.toThrow();
    expect(() => bindCaptureProxy(index, "root:pseudo:1", proxy)).toThrow(
      /invalid capture proxy/i
    );

    const freshProxy = document.createElement("span");
    root.append(freshProxy);
    expect(() =>
      bindCaptureProxy(index, "root:pseudo:1", freshProxy)
    ).not.toThrow();
  });

  it("binds each post-index proxy globally across pre-created indexes", () => {
    document.body.innerHTML = `<style>#root::before{content:"";display:block;width:4px;height:4px;background:red}</style><main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const firstIndex = indexSettled(root);
    const secondIndex = indexSettled(root);
    const proxy = document.createElement("span");
    root.append(proxy);

    expect(() =>
      bindCaptureProxy(firstIndex, "root:pseudo:0", proxy)
    ).not.toThrow();
    expect(() => bindCaptureProxy(secondIndex, "root:pseudo:0", proxy)).toThrow(
      /invalid capture proxy/i
    );

    const freshProxy = document.createElement("span");
    root.append(freshProxy);
    expect(() =>
      bindCaptureProxy(secondIndex, "root:pseudo:0", freshProxy)
    ).not.toThrow();
    expect(scanCaptureManifest(firstIndex).entryIdsForNode(proxy)).toEqual([
      "root:pseudo:0",
    ]);
    expect(
      scanCaptureManifest(secondIndex).entryIdsForNode(freshProxy)
    ).toEqual(["root:pseudo:0"]);
  });

  it("settles once, caches the identical manifest, and seals proxy binding", () => {
    document.body.innerHTML = `<style>#root::before{content:"";display:block;width:1px;height:1px;background:red}</style><main id="root" style="display:none;width:20px;height:10px"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const index = indexSettled(root);
    root.style.display = "block";

    const firstScan = scanCaptureManifest(index);
    const structure = requireValue(
      firstScan.manifest.entries.find(
        (entry) => entry.id === "root:structure:0"
      )
    );
    expect(structure.geometry?.visualBounds.width).toBe(20);

    root.style.width = "90px";
    const secondScan = scanCaptureManifest(index);
    expect(secondScan).toBe(firstScan);
    expect(
      secondScan.manifest.entries.find(
        (entry) => entry.id === "root:structure:0"
      )?.geometry?.visualBounds.width
    ).toBe(20);

    const proxy = document.createElement("span");
    root.append(proxy);
    expect(() => bindCaptureProxy(index, "root:pseudo:0", proxy)).toThrow(
      /sealed capture manifest/i
    );
  });

  it.each([
    ["pre whitespace-only text", "<pre>  \n  </pre>"],
    [
      "pre-wrap whitespace-only text",
      `<div style="white-space:pre-wrap">  \n  </div>`,
    ],
    [
      "break-spaces whitespace-only text",
      `<div style="white-space:break-spaces">   </div>`,
    ],
    [
      "leading, trailing, and repeated visible spaces",
      `<div style="white-space:pre-wrap">  visible  spaces  </div>`,
    ],
  ])("preserves %s as eligible geometry", (_case, childMarkup) => {
    document.body.innerHTML = `<main id="root">${childMarkup}</main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;
    const whitespace = requireValue(
      manifest.entries.find((entry) => entry.id === "0.0:text:0")
    );

    expect(whitespace.eligibility).toBe("eligible");
    expect(whitespace.geometry?.fragments.length).toBeGreaterThan(0);
  });

  it("uses computed display when author CSS overrides the hidden attribute", () => {
    document.body.innerHTML = `<main id="root"><div hidden style="display:block;width:10px;height:10px;background-color:rgb(1 2 3)">visible</div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const entries = scanCaptureManifest(indexSettled(root)).manifest.entries;

    for (const id of ["0:structure:0", "0.0:text:0", "0:decoration:0"]) {
      expect(entries.find((entry) => entry.id === id)?.eligibility).toBe(
        "eligible"
      );
    }
  });

  it("keeps an indexed child eligible when it is removed before scan", () => {
    document.body.innerHTML = `<main id="root"><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const child = queryRequired(root, "div");
    const index = indexSettled(root);
    child.remove();

    const manifest = scanCaptureManifest(index).manifest;
    const entry = requireValue(
      manifest.entries.find((candidate) => candidate.id === "0:structure:0")
    );
    expect(entry.eligibility).toBe("eligible");
    expect(entry.provenance).toEqual([
      { code: "indexed-node-mutated-unproven", count: 1 },
    ]);
    expect(manifest.proofs.sourceInventoryComplete).toBe(false);
  });

  it("marks reparenting and ancestor replacement but ignores sibling insertion", () => {
    document.body.innerHTML =
      `<main id="root"><section id="reparented"><div></div></section>` +
      `<section id="replaced"><div></div></section>` +
      `<section id="stable"><div></div></section></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const reparented = queryRequired<HTMLElement>(root, "#reparented");
    const replaced = queryRequired<HTMLElement>(root, "#replaced");
    const replacedChild = queryRequired(replaced, "div");
    const index = indexSettled(root);

    root.prepend(document.createElement("style"));
    const wrapper = document.createElement("article");
    root.append(wrapper);
    wrapper.append(reparented);
    const replacement = document.createElement("section");
    replaced.replaceWith(replacement);
    replacement.append(replacedChild);

    const entries = scanCaptureManifest(index).manifest.entries;
    const mutation = {
      code: "indexed-node-mutated-unproven",
      count: 1,
    };
    for (const id of [
      "0:structure:0",
      "0.0:structure:0",
      "1:structure:0",
      "1.0:structure:0",
    ]) {
      expect(entries.find((entry) => entry.id === id)).toEqual(
        expect.objectContaining({
          eligibility: "eligible",
          provenance: expect.arrayContaining([mutation]),
        })
      );
    }
    for (const id of ["2:structure:0", "2.0:structure:0"]) {
      expect(
        entries.find((entry) => entry.id === id)?.provenance
      ).not.toContainEqual(mutation);
    }
    expect(reparented.isConnected).toBe(true);
    expect(replacedChild.isConnected).toBe(true);
  });

  it("reports root-relative layout and visual bounds for an own transform", () => {
    document.body.innerHTML = `<div id="wrapper"><main id="root"><div id="child"></div></main></div><style>#wrapper{position:absolute;left:100px;top:80px}#root{position:relative;width:200px;height:100px}#child{position:absolute;left:10px;top:15px;width:20px;height:10px;transform:scale(2);transform-origin:0 0}</style>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;
    const child = requireValue(
      manifest.entries.find((entry) => entry.id === "0:structure:0")
    );

    expect(child.geometry?.coordinateSpace).toBe("root-css-px-scrolltop-0");
    expect(child.geometry?.layoutBounds).toEqual({
      x: 10,
      y: 15,
      width: 20,
      height: 10,
    });
    expect(child.geometry?.visualBounds).toEqual({
      x: 10,
      y: 15,
      width: 40,
      height: 20,
    });
  });

  it("keeps transformed relative-position layout bounds uncertain", () => {
    document.body.innerHTML =
      `<main id="root"><div id="flow"></div><div id="relative"></div></main>` +
      "<style>#root{position:relative;width:100px;height:100px}" +
      "#flow{width:30px;height:12px}" +
      "#relative{position:relative;left:10px;top:5px;width:20px;height:10px;transform:scale(2);transform-origin:0 0}</style>";
    const root = queryRequired<HTMLElement>(document, "#root");
    const relative = requireValue(
      scanCaptureManifest(indexSettled(root)).manifest.entries.find(
        (entry) => entry.id === "1:structure:0"
      )
    );

    expect(relative.geometry?.visualBounds).toBeDefined();
    expect(relative.geometry?.layoutBounds).toBeNull();
  });

  it("keeps ancestor-transformed layout uncertain and preserves fractional bounds", () => {
    document.body.innerHTML = `<main id="root"><section id="scaled"><div id="transformed"></div></section><div id="fractional"></div></main><style>#root{position:relative;width:100px;height:100px}#scaled{position:absolute;left:0;top:0;transform:scale(1.5);transform-origin:0 0}#transformed{width:10.5px;height:7.25px}#fractional{position:absolute;left:20.25px;top:30.5px;width:10.5px;height:7.25px}</style>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;
    const transformed = requireValue(
      manifest.entries.find((entry) => entry.id === "0.0:structure:0")
    );
    const fractional = requireValue(
      manifest.entries.find((entry) => entry.id === "1:structure:0")
    );

    expect(transformed.geometry?.layoutBounds).toBeNull();
    expect(transformed.geometry?.visualBounds.width).toBeCloseTo(15.75, 4);
    expect(transformed.geometry?.visualBounds.height).toBeCloseTo(10.875, 4);
    expect(fractional.geometry?.layoutBounds).toEqual({
      x: 20.25,
      y: 30.5,
      width: 10.5,
      height: 7.25,
    });
    expect(fractional.geometry?.visualBounds).toEqual({
      x: 20.25,
      y: 30.5,
      width: 10.5,
      height: 7.25,
    });
  });

  it("excludes proven nonpainting descendants but retains uncertain clipping", () => {
    document.body.innerHTML = `<main id="root"><section><div></div></section><section><div></div></section><section><div></div></section><section><div></div></section><section><div></div></section></main><style>#root>section{position:relative;width:10px;height:10px}#root>section>div{width:8px;height:8px;background:red}#root>section:nth-child(1){display:none}#root>section:nth-child(2){visibility:hidden}#root>section:nth-child(3){opacity:0}#root>section:nth-child(4){overflow:hidden}#root>section:nth-child(4)>div{position:absolute;left:20px}#root>section:nth-child(5){clip-path:url(#opaque-capture-clip)}#root>section:nth-child(5)>div{position:absolute;left:20px}</style>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;
    const children = [0, 1, 2, 3, 4].map((index) =>
      requireValue(
        manifest.entries.find((entry) => entry.id === `${index}.0:structure:0`)
      )
    );
    const uncertainChild = requireValue(children[4]);

    expect(children.slice(0, 4).map((entry) => entry.eligibility)).toEqual([
      "excluded",
      "excluded",
      "excluded",
      "excluded",
    ]);
    expect(uncertainChild.eligibility).toBe("eligible");
    expect(uncertainChild.provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
  });

  it("keeps zero-box external box-shadow ink conservatively eligible", () => {
    document.body.innerHTML = `<main id="root"><div style="width:0;height:0;box-shadow:0 0 0 10px red"></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;
    const shadow = requireValue(
      manifest.entries.find((entry) => entry.id === "0:decoration:0")
    );

    expect(shadow.detailCode).toBe("box-shadow");
    expect(shadow.eligibility).toBe("eligible");
    expect(shadow.geometry).toBeNull();
    expect(shadow.provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
  });

  it("keeps zero-box outline ink eligible unless computed display is none", () => {
    document.body.innerHTML =
      `<main id="root"><div style="width:0;height:0;outline:8px solid red"></div>` +
      `<div style="display:none;width:0;height:0;outline:8px solid red"></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const entries = scanCaptureManifest(indexSettled(root)).manifest.entries;
    const visible = requireValue(
      entries.find((entry) => entry.id === "0:structure:0")
    );
    const hidden = requireValue(
      entries.find((entry) => entry.id === "1:structure:0")
    );

    expect(visible.eligibility).toBe("eligible");
    expect(visible.geometry).toBeNull();
    expect(visible.provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
    expect(hidden.eligibility).toBe("excluded");
  });

  it("does not promote zero-box transparent outline ink", () => {
    document.body.innerHTML = `<main id="root"><div style="width:0;height:0;outline:8px solid rgba(1,2,3,0)"></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const structure = requireValue(
      scanCaptureManifest(indexSettled(root)).manifest.entries.find(
        (entry) => entry.id === "0:structure:0"
      )
    );

    expect(structure.eligibility).toBe("excluded");
  });

  it("uses bound proxy style for hidden and zero-box external-ink pseudo", () => {
    document.body.innerHTML = `<style>#root::before,#root::after{content:"";display:block;width:4px;height:4px;background:red}</style><main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const index = indexSettled(root);
    const hidden = document.createElement("span");
    hidden.style.display = "none";
    root.append(hidden);
    bindCaptureProxy(index, "root:pseudo:0", hidden);
    const zeroInk = document.createElement("span");
    zeroInk.style.cssText =
      "display:block;width:0;height:0;box-shadow:0 0 0 8px red";
    root.append(zeroInk);
    bindCaptureProxy(index, "root:pseudo:1", zeroInk);

    const entries = scanCaptureManifest(index).manifest.entries;
    const before = requireValue(
      entries.find((entry) => entry.id === "root:pseudo:0")
    );
    const after = requireValue(
      entries.find((entry) => entry.id === "root:pseudo:1")
    );
    expect(before.eligibility).toBe("excluded");
    expect(after.eligibility).toBe("eligible");
    expect(after.provenance).not.toContainEqual({
      code: "pseudo-proxy-unbound",
      count: 1,
    });
    expect(after.provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
  });

  it("does not exclude external ink by a fully clipped principal box", () => {
    document.body.innerHTML =
      '<main id="root"><section><div></div></section></main>' +
      "<style>#root>section{position:relative;width:10px;height:10px;overflow:hidden}" +
      "#root>section>div{position:absolute;left:20px;top:0;width:5px;height:5px;box-shadow:0 0 0 15px red}</style>";
    const root = queryRequired<HTMLElement>(document, "#root");
    const entries = scanCaptureManifest(indexSettled(root)).manifest.entries;
    expect(
      entries.find((entry) => entry.id === "0.0:structure:0")?.eligibility
    ).toBe("excluded");
    const shadow = requireValue(
      entries.find(
        (entry) =>
          entry.path.join(".") === "0.0" && entry.detailCode === "box-shadow"
      )
    );
    expect(shadow.geometry?.visualBounds.x).toBeCloseTo(20, 4);
    expect(shadow.geometry?.visualBounds.width).toBeCloseTo(5, 4);
    expect(shadow.eligibility).toBe("eligible");
    expect(shadow.provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
  });
});

describe("capture manifest cardinality and hardening", () => {
  it("indexes iframe-realm sources with all seven exact cardinalities", async () => {
    const iframe = document.createElement("iframe");
    const loaded = new Promise<void>((resolve) => {
      iframe.addEventListener("load", () => resolve(), { once: true });
    });
    iframe.srcdoc = `<!doctype html><style>input,textarea,select,button{appearance:none;background:transparent;border:0;box-shadow:none;padding:0;width:10px;height:10px}#root::after{content:"";display:block;width:2px;height:2px;background:rgb(1 2 3)}#decorated{width:20px;height:20px;background-color:rgb(1 2 3);background-image:linear-gradient(red,blue),linear-gradient(green,yellow);border:1px solid black;box-shadow:1px 1px red,2px 2px blue;filter:blur(1px);backdrop-filter:blur(1px);mask:linear-gradient(black,black);clip-path:inset(0);mix-blend-mode:multiply}</style><main id="root"><span>text</span><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='red'/%3E%3C/svg%3E"><svg width="10" height="10"><rect width="10" height="10"></rect><foreignObject width="1" height="1"></foreignObject></svg><input value="typed"><textarea></textarea><select><option>choice</option></select><button>go</button><input type="checkbox" checked><input type="radio" checked><div id="decorated"></div></main>`;
    document.body.append(iframe);
    await loaded;

    const frameDocument = requireValue(iframe.contentDocument);
    const root = queryRequired<HTMLElement>(frameDocument, "#root");
    queryRequired<HTMLTextAreaElement>(frameDocument, "textarea").value = "now";
    await queryRequired<HTMLImageElement>(frameDocument, "img").decode();

    const index = indexSettled(root);
    const pseudoCandidates = listCapturePseudoCandidates(index);
    expect(
      pseudoCandidates.map(({ sourceId, pseudo }) => [sourceId, pseudo])
    ).toEqual([["root:pseudo:1", "after"]]);
    expect(pseudoCandidates[0]?.host).toBe(root);

    const proxy = frameDocument.createElement("span");
    proxy.style.cssText =
      "display:block;width:2px;height:2px;background:rgb(1 2 3)";
    root.append(proxy);
    expect(() => bindCaptureProxy(index, "root:pseudo:1", proxy)).not.toThrow();

    const scan = scanCaptureManifest(index);
    expect(scan.manifest.summary.byCategory).toEqual({
      structure: 14,
      text: 3,
      image: 1,
      svg: 3,
      "form-state": 6,
      pseudo: 1,
      decoration: 11,
    });
    expect(scan.manifest.summary.scanned).toBe(39);
    expect(scan.manifest.summary.scanned).toBe(
      scan.manifest.summary.excluded + scan.manifest.summary.eligible
    );
    expect(scan.manifest.entries).toContainEqual(
      expect.objectContaining({
        id: "2.1:svg:0",
        sourceKind: "SVG-GRAPHICS",
      })
    );
    expect(scan.manifest.proofs).toEqual({
      sourceInventoryComplete: false,
      resourceProofComplete: false,
      hierarchyProofComplete: false,
      paintOrderProofComplete: false,
    });
    expect(scan.manifest.hierarchyEdges).toEqual([]);
    expect(scan.manifest.paintEdges).toEqual([]);
    for (const entry of scan.manifest.entries) {
      expect(entry.contentRelevant).toBe(
        entry.eligibility === "eligible" && entry.category !== "decoration"
      );
      expect(entry.editableRelevant).toBe(entry.eligibility === "eligible");
      expect(entry.resourceFacts).toEqual([]);
      expect(entry.fallbackPolicies).toEqual([]);
      expect(entry.requiredHierarchyEdgeIds).toEqual([]);
      expect(entry.requiredPaintEdgeIds).toEqual([]);
    }
  });

  it("enumerates excluded candidates in all seven categories", () => {
    document.body.innerHTML = `<style>#hidden-pseudo{display:none}#hidden-pseudo::before{content:"hidden";display:block;width:2px;height:2px;background:red}#hidden-decoration{display:none;background-color:rgb(1 2 3)}</style><main id="root"><div hidden></div><span hidden>  \n  </span><img hidden src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E"><svg hidden style="display:none" width="2" height="2"><rect width="2" height="2"></rect></svg><input hidden value="hidden"><div id="hidden-pseudo"></div><div id="hidden-decoration"></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;
    const excludedCandidates = [
      ["0:structure:0", "structure"],
      ["1.0:text:0", "text"],
      ["2:image:0", "image"],
      ["3.0:svg:0", "svg"],
      ["4:form-state:0", "form-state"],
      ["5:pseudo:0", "pseudo"],
      ["6:decoration:0", "decoration"],
    ] as const;

    for (const [id, category] of excludedCandidates) {
      expect(manifest.entries.filter((entry) => entry.id === id)).toEqual([
        expect.objectContaining({ id, category, eligibility: "excluded" }),
      ]);
    }
    expect(
      manifest.entries
        .filter((entry) => entry.category === "text")
        .map((entry) => entry.id)
    ).toEqual(["1.0:text:0"]);
    expect(manifest.summary.scanned).toBe(
      manifest.summary.excluded + manifest.summary.eligible
    );
  });

  it("ignores post-index generation nodes and approved sibling ordinal shifts", () => {
    document.body.innerHTML = `<main id="root"><p>original</p></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const index = indexSettled(root);
    const generated = document.createElement("style");
    generated.textContent = "#root{color:black}";
    root.prepend(generated);

    const manifest = scanCaptureManifest(index).manifest;
    expect(manifest.entries.some((entry) => entry.sourceKind === "STYLE")).toBe(
      false
    );
    const original = requireValue(
      manifest.entries.find((entry) => entry.id === "0:structure:0")
    );
    expect(original).toBeDefined();
    expect(original.provenance).not.toContainEqual({
      code: "indexed-node-mutated-unproven",
      count: 1,
    });
  });

  it("keeps finite no-clip overflow on both sides eligible", () => {
    document.body.innerHTML = `<main id="root" style="position:relative;width:100px;height:50px"><div style="position:absolute;left:-40px;width:20px;height:20px"></div><div style="position:absolute;left:140px;width:20px;height:20px"></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const manifest = scanCaptureManifest(indexSettled(root)).manifest;

    expect(
      ["0:structure:0", "1:structure:0"].map(
        (id) => manifest.entries.find((entry) => entry.id === id)?.eligibility
      )
    ).toEqual(["eligible", "eligible"]);
  });

  it.each([
    "rgba(1, 2, 3, 0)",
    "rgb(1 2 3 / 0%)",
  ])("does not enumerate transparent nonblack background %s", (backgroundColor) => {
    document.body.innerHTML = `<main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    root.style.cssText = `width:10px;height:10px;background-color:${backgroundColor}`;

    const entries = scanCaptureManifest(indexSettled(root)).manifest.entries;
    expect(
      entries.filter((entry) => entry.detailCode === "background-color")
    ).toEqual([]);
  });

  it("rejects every unsafe annotation shape", () => {
    document.body.innerHTML = `<main id="root"><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const unsafeAnnotations: Array<CaptureAnnotation> = [
      {
        targetId: "0:structure:0",
        provenance: [{ code: "https://private.test/customer", count: 1 }],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [{ code: "customer private DOM text", count: 1 }],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [{ code: "customer-secret", count: 1 }],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [{ code: "Error\n    at customer.ts:1:1", count: 1 }],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [{ code: "inline-event-handler", count: 0 }],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [
          {
            code: "inline-event-handler",
            count: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [{ code: "inline-event-handler", count: 1.5 }],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [{ code: "inline-event-handler", count: Number.NaN }],
      } as unknown as CaptureAnnotation,
      {
        targetId: "0:structure:0",
        provenance: [
          {
            code: "inline-event-handler",
            count: Number.POSITIVE_INFINITY,
          },
        ],
      } as unknown as CaptureAnnotation,
    ];

    for (const annotation of unsafeAnnotations) {
      expect(() => indexSettled(root, { annotations: [annotation] })).toThrow(
        /invalid capture annotation/i
      );
    }
  });

  it("rejects exclusion hints and merged provenance count overflow", () => {
    document.body.innerHTML = `<main id="root"><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const exclusion = {
      targetId: "0:structure:0",
      eligibilityHint: "excluded",
      provenance: [{ code: "inline-event-handler", count: 1 }],
    } as unknown as CaptureAnnotation;
    expect(() => indexSettled(root, { annotations: [exclusion] })).toThrow(
      /invalid capture annotation/i
    );

    const overflowing = {
      targetId: "0:structure:0",
      provenance: [
        {
          code: "inline-event-handler",
          count: Number.MAX_SAFE_INTEGER,
        },
        { code: "inline-event-handler", count: 1 },
      ],
    } as const satisfies CaptureAnnotation;
    expect(() => indexSettled(root, { annotations: [overflowing] })).toThrow(
      /invalid capture annotation/i
    );
  });

  it.each([
    undefined,
    "eligible",
  ] as const)("rejects empty annotation provenance with hint %s", (eligibilityHint) => {
    document.body.innerHTML = `<main id="root"><div></div></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const annotation = {
      targetId: "0:structure:0",
      ...(eligibilityHint === undefined ? {} : { eligibilityHint }),
      provenance: [],
    } satisfies CaptureAnnotation;

    expect(() => indexSettled(root, { annotations: [annotation] })).toThrow(
      /invalid capture annotation/i
    );
  });

  it("normalizes private source kinds and deeply freezes copied snapshots", () => {
    document.body.innerHTML = `<main id="root"><customer-secret></customer-secret><svg><private-shape></private-shape></svg></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const callerProvenance = [
      {
        code: "inline-event-handler" as const,
        count: 1,
      },
    ];
    const annotations: Array<CaptureAnnotation> = [
      {
        targetId: "0:structure:0",
        eligibilityHint: "eligible",
        provenance: callerProvenance,
      },
    ];
    const index = indexSettled(root, { annotations });

    requireValue(callerProvenance[0]).count = 9;
    annotations.push({
      targetId: "1:structure:0",
      provenance: [{ code: "inline-event-handler", count: 1 }],
    });

    const scan = scanCaptureManifest(index);
    const custom = requireValue(
      scan.manifest.entries.find((entry) => entry.id === "0:structure:0")
    );
    const svgRoot = requireValue(
      scan.manifest.entries.find((entry) => entry.id === "1:structure:0")
    );
    const unknownSvg = requireValue(
      scan.manifest.entries.find((entry) => entry.id === "1.0:structure:0")
    );
    expect(custom.sourceKind).toBe("CUSTOM-ELEMENT");
    expect(custom.provenance).toEqual([
      { code: "inline-event-handler", count: 1 },
    ]);
    expect(svgRoot.provenance).not.toContainEqual({
      code: "inline-event-handler",
      count: 1,
    });
    expect(unknownSvg.sourceKind).toBe("UNKNOWN-SVG");
    expect(JSON.stringify(scan.manifest)).not.toContain("customer-secret");
    expect(JSON.stringify(scan.manifest)).not.toContain("private-shape");

    expect(Object.isFrozen(scan)).toBe(true);
    expect(Object.isFrozen(scan.manifest)).toBe(true);
    expect(Object.isFrozen(scan.manifest.proofs)).toBe(true);
    expect(Object.isFrozen(scan.manifest.summary)).toBe(true);
    expect(Object.isFrozen(scan.manifest.entries)).toBe(true);
    expect(Object.isFrozen(scan.manifest.hierarchyEdges)).toBe(true);
    expect(Object.isFrozen(scan.manifest.paintEdges)).toBe(true);
    expect(Object.isFrozen(custom)).toBe(true);
    expect(Object.isFrozen(custom.path)).toBe(true);
    expect(Object.isFrozen(custom.provenance)).toBe(true);
    expect(Object.isFrozen(custom.provenance[0])).toBe(true);
    expect(Object.isFrozen(scan.manifest.summary.byCategory)).toBe(true);
    expect(Object.isFrozen(scan.entryIdsForNode(root))).toBe(true);
    for (const entry of scan.manifest.entries) {
      expect(Object.isFrozen(entry.resourceFacts)).toBe(true);
      expect(Object.isFrozen(entry.fallbackPolicies)).toBe(true);
      expect(Object.isFrozen(entry.requiredHierarchyEdgeIds)).toBe(true);
      expect(Object.isFrozen(entry.requiredPaintEdgeIds)).toBe(true);
      if (entry.geometry !== null) {
        expect(Object.isFrozen(entry.geometry)).toBe(true);
        expect(Object.isFrozen(entry.geometry.visualBounds)).toBe(true);
        if (entry.geometry.layoutBounds !== null) {
          expect(Object.isFrozen(entry.geometry.layoutBounds)).toBe(true);
        }
        if (entry.geometry.inkBounds !== null) {
          expect(Object.isFrozen(entry.geometry.inkBounds)).toBe(true);
        }
        expect(Object.isFrozen(entry.geometry.fragments)).toBe(true);
        for (const fragment of entry.geometry.fragments) {
          expect(Object.isFrozen(fragment)).toBe(true);
        }
      }
    }
  });

  it("bounds background layer parsing with one conservative remainder", () => {
    document.body.innerHTML = `<main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    root.style.cssText = "width:20px;height:20px";
    root.style.backgroundImage = Array.from(
      { length: 258 },
      () => "linear-gradient(rgb(1 2 3),rgb(4 5 6))"
    ).join(",");

    const scan = scanCaptureManifest(indexSettled(root));
    const backgroundImages = scan.manifest.entries.filter(
      (entry) => entry.detailCode === "background-image"
    );
    expect(backgroundImages).toHaveLength(257);
    for (const parsed of backgroundImages.slice(0, 256)) {
      expect(parsed.provenance).not.toContainEqual({
        code: "candidate-parse-unproven",
        count: 1,
      });
    }
    expect(requireValue(backgroundImages[256]).provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
    expect(scan.manifest.proofs.sourceInventoryComplete).toBe(false);
  });

  it("bounds box-shadow layers with one conservative remainder", () => {
    document.body.innerHTML = `<main id="root" style="display:none"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    root.style.boxShadow = Array.from(
      { length: 258 },
      () => "rgb(1 2 3) 0 0"
    ).join(",");

    const boxShadows = scanCaptureManifest(
      indexSettled(root)
    ).manifest.entries.filter((entry) => entry.detailCode === "box-shadow");

    expect(boxShadows).toHaveLength(257);
    for (const parsed of boxShadows.slice(0, 256)) {
      expect(parsed.provenance).not.toContainEqual({
        code: "candidate-parse-unproven",
        count: 1,
      });
    }
    expect(requireValue(boxShadows[256]).provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
  });

  it("bounds oversized computed background images with one remainder", () => {
    document.body.innerHTML = `<main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    root.style.backgroundImage =
      "linear-gradient(rgb(1 2 3), rgb(4 5 6)), " +
      `url("data:image/svg+xml,${"a".repeat(70_000)}")`;

    expect(getComputedStyle(root).backgroundImage.length).toBeGreaterThan(
      65_536
    );
    const backgroundImages = scanCaptureManifest(
      indexSettled(root)
    ).manifest.entries.filter(
      (entry) => entry.detailCode === "background-image"
    );

    expect(backgroundImages).toHaveLength(2);
    expect(requireValue(backgroundImages[0]).provenance).not.toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
    expect(requireValue(backgroundImages[1]).provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
  });

  it("bounds deeply nested Chromium cross-fades with one remainder", () => {
    document.body.innerHTML = `<main id="root"></main>`;
    const root = queryRequired<HTMLElement>(document, "#root");
    const image =
      `url("data:image/svg+xml,%3Csvg ` +
      "xmlns=%27http://www.w3.org/2000/svg%27 " +
      `width=%271%27 height=%271%27/%3E")`;
    let nested = image;
    for (let depth = 0; depth < 65; depth += 1) {
      nested = `-webkit-cross-fade(${nested}, ${image}, 0.5)`;
    }
    root.style.backgroundImage = `linear-gradient(rgb(1 2 3), rgb(4 5 6)), ${nested}`;

    const backgroundImages = scanCaptureManifest(
      indexSettled(root)
    ).manifest.entries.filter(
      (entry) => entry.detailCode === "background-image"
    );

    expect(backgroundImages).toHaveLength(2);
    expect(requireValue(backgroundImages[0]).provenance).not.toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
    expect(requireValue(backgroundImages[1]).provenance).toContainEqual({
      code: "candidate-parse-unproven",
      count: 1,
    });
  });
});
