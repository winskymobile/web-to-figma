import { describe, expect, it } from "vitest";

import { createPreviewConverterStore } from "./converter-store";

class FakeConverter {
  clearCount = 0;

  clearCache() {
    this.clearCount += 1;
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createPreviewConverterStore", () => {
  it("lazily creates and reuses the converter for the active preview", () => {
    const documentA = {} as Document;
    const created: FakeConverter[] = [];
    const observedDocuments: Array<() => Document | null> = [];
    const store = createPreviewConverterStore((getDocument) => {
      const converter = new FakeConverter();
      created.push(converter);
      observedDocuments.push(getDocument);
      return converter;
    });

    store.setDocument(documentA);

    expect(created).toHaveLength(0);
    const converter = store.getConverter();
    expect(created).toEqual([converter]);
    expect(observedDocuments[0]?.()).toBe(documentA);
    expect(store.getConverter()).toBe(converter);
    expect(created).toHaveLength(1);
  });

  it("clears an existing converter only when preview identity changes", () => {
    const documentA = {} as Document;
    const documentB = {} as Document;
    let getDocument: (() => Document | null) | undefined;
    const store = createPreviewConverterStore((readDocument) => {
      getDocument = readDocument;
      return new FakeConverter();
    });

    store.setDocument(documentA);
    const converter = store.getConverter();
    expect(getDocument?.()).toBe(documentA);

    store.setDocument(documentA);
    expect(converter.clearCount).toBe(0);

    store.setDocument(documentB);
    expect(converter.clearCount).toBe(1);
    expect(getDocument?.()).toBe(documentB);

    store.setDocument(documentB);
    expect(converter.clearCount).toBe(1);
    expect(store.getConverter()).toBe(converter);
  });

  it("clears once when the active preview session is reset", () => {
    const documentA = {} as Document;
    let getDocument: (() => Document | null) | undefined;
    const store = createPreviewConverterStore((readDocument) => {
      getDocument = readDocument;
      return new FakeConverter();
    });

    store.setDocument(documentA);
    const converter = store.getConverter();

    store.setDocument(null);
    expect(converter.clearCount).toBe(1);
    expect(getDocument?.()).toBeNull();

    store.setDocument(null);
    expect(converter.clearCount).toBe(1);
  });

  it("keeps the document and cache stable when cleared during conversion", async () => {
    const documentA = {} as Document;
    let getDocument: (() => Document | null) | undefined;
    const store = createPreviewConverterStore((readDocument) => {
      getDocument = readDocument;
      return new FakeConverter();
    });
    const started = deferred();
    const finish = deferred();

    store.setDocument(documentA);
    const converter = store.getConverter();
    const conversion = store.withConverter(async (leasedConverter) => {
      expect(leasedConverter).toBe(converter);
      expect(getDocument?.()).toBe(documentA);
      started.resolve();
      await finish.promise;
      expect(getDocument?.()).toBe(documentA);
      expect(converter.clearCount).toBe(0);
    });
    await started.promise;

    store.setDocument(null);

    expect(getDocument?.()).toBe(documentA);
    expect(converter.clearCount).toBe(0);
    finish.resolve();
    await conversion;
    expect(getDocument?.()).toBeNull();
    expect(converter.clearCount).toBe(1);
  });

  it("applies the latest replacement after conversion finishes", async () => {
    const documentA = {} as Document;
    const documentB = {} as Document;
    const documentC = {} as Document;
    let getDocument: (() => Document | null) | undefined;
    const store = createPreviewConverterStore((readDocument) => {
      getDocument = readDocument;
      return new FakeConverter();
    });
    const started = deferred();
    const finish = deferred();

    store.setDocument(documentA);
    const converter = store.getConverter();
    const conversion = store.withConverter(async () => {
      started.resolve();
      await finish.promise;
      expect(getDocument?.()).toBe(documentA);
      expect(converter.clearCount).toBe(0);
    });
    await started.promise;

    store.setDocument(documentB);
    store.setDocument(documentC);

    expect(getDocument?.()).toBe(documentA);
    expect(converter.clearCount).toBe(0);
    finish.resolve();
    await conversion;
    expect(getDocument?.()).toBe(documentC);
    expect(converter.clearCount).toBe(1);
  });

  it("releases the conversion lease when the operation throws", async () => {
    const documentA = {} as Document;
    const documentB = {} as Document;
    let getDocument: (() => Document | null) | undefined;
    const store = createPreviewConverterStore((readDocument) => {
      getDocument = readDocument;
      return new FakeConverter();
    });
    const failure = new Error("conversion failed");

    store.setDocument(documentA);
    const converter = store.getConverter();

    await expect(
      store.withConverter(() => {
        store.setDocument(documentB);
        throw failure;
      })
    ).rejects.toBe(failure);
    expect(getDocument?.()).toBe(documentB);
    expect(converter.clearCount).toBe(1);
    await expect(store.withConverter(() => "next conversion")).resolves.toBe(
      "next conversion"
    );
  });
});
