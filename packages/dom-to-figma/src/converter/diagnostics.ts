export type ConverterDiagnostic = {
  code:
    | "page-font-fetch-failed"
    | "missing-glyph"
    | "node-conversion-failed"
    | "layout-infer-bailed"
    | "pseudo-skipped";
  severity: "warning" | "error";
  message: string;
  character?: string;
  /** Stable machine-readable detail (e.g. layout-infer bail reason). */
  reason?: string;
};

export type DiagnosticReporter = (diagnostic: ConverterDiagnostic) => void;

export type DiagnosticReport = {
  report: DiagnosticReporter;
  snapshot(): ReadonlyArray<ConverterDiagnostic>;
};

/** Create one deduplicated report for a single conversion. */
export function createDiagnosticReport(): DiagnosticReport {
  const diagnostics: Array<ConverterDiagnostic> = [];
  const seen = new Set<string>();

  return {
    report(diagnostic) {
      const key = JSON.stringify([
        diagnostic.code,
        diagnostic.severity,
        diagnostic.message,
        diagnostic.character ?? null,
        diagnostic.reason ?? null,
      ]);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      diagnostics.push({ ...diagnostic });
    },
    snapshot() {
      return Object.freeze(
        diagnostics.map((diagnostic) => ({ ...diagnostic }))
      );
    },
  };
}
