type ClearableConverter = {
  clearCache(): void;
};

export function createPreviewConverterStore<
  Converter extends ClearableConverter,
>(factory: (getDocument: () => Document | null) => Converter) {
  let activeDocument: Document | null = null;
  let converter: Converter | null = null;
  let conversionCount = 0;
  let conversionDocument: Document | null = null;
  let pendingDocument: Document | null = null;
  let hasPendingDocument = false;

  const readDocument = () =>
    conversionCount > 0 ? conversionDocument : activeDocument;

  const applyDocument = (document: Document | null) => {
    if (document === activeDocument) {
      return;
    }

    activeDocument = document;
    converter?.clearCache();
  };

  return {
    setDocument(document: Document | null) {
      if (conversionCount === 0) {
        applyDocument(document);
        return;
      }

      const latestDocument = hasPendingDocument
        ? pendingDocument
        : activeDocument;
      if (document === latestDocument) {
        return;
      }

      pendingDocument = document;
      hasPendingDocument = true;
    },
    getConverter() {
      converter ??= factory(readDocument);
      return converter;
    },
    async withConverter<Result>(
      operation: (activeConverter: Converter) => Result | Promise<Result>
    ) {
      if (conversionCount === 0) {
        conversionDocument = activeDocument;
      }
      conversionCount += 1;

      try {
        converter ??= factory(readDocument);
        return await operation(converter);
      } finally {
        conversionCount -= 1;
        if (conversionCount === 0) {
          conversionDocument = null;
          if (hasPendingDocument) {
            const nextDocument = pendingDocument;
            pendingDocument = null;
            hasPendingDocument = false;
            applyDocument(nextDocument);
          }
        }
      }
    },
  };
}
