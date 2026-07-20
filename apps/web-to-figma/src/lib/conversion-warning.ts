import type { ConverterDiagnostic } from "@figit/dom-to-figma";
import type { PrepareFontsStats } from "./prepare-preview-fonts";

const CODE_LABELS: Record<string, string> = {
  "page-font-fetch-failed": "页面字体读取失败",
  "missing-glyph": "缺字",
  "node-conversion-failed": "节点转换失败",
  "layout-infer-bailed": "自动布局未应用",
  "pseudo-skipped": "伪元素跳过",
  "decoration-rasterized": "装饰已栅格化",
};

export type DiagnosticGroup = {
  code: string;
  label: string;
  count: number;
  /** Top reasons for this code, if any */
  reasons: Array<{ reason: string; count: number }>;
};

/** Group converter diagnostics by code (and reason) for UI summaries. */
export function summarizeDiagnostics(
  diagnostics: ReadonlyArray<ConverterDiagnostic>
): Array<DiagnosticGroup> {
  const byCode = new Map<
    string,
    { count: number; reasons: Map<string, number> }
  >();

  for (const d of diagnostics) {
    const entry = byCode.get(d.code) ?? {
      count: 0,
      reasons: new Map<string, number>(),
    };
    entry.count += 1;
    if (d.reason) {
      entry.reasons.set(d.reason, (entry.reasons.get(d.reason) ?? 0) + 1);
    }
    byCode.set(d.code, entry);
  }

  return [...byCode.entries()]
    .map(([code, entry]) => ({
      code,
      label: CODE_LABELS[code] ?? code,
      count: entry.count,
      reasons: [...entry.reasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);
}

function formatGroup(group: DiagnosticGroup): string {
  const reasonPart =
    group.reasons.length > 0
      ? `（${group.reasons
          .slice(0, 2)
          .map((r) => `${r.reason}×${r.count}`)
          .join("，")}）`
      : "";
  return `${group.label} ${group.count} 处${reasonPart}`;
}

/** Shared non-blocking warning decision used by App and integration tests. */
export function formatConversionWarning(
  fontStats: PrepareFontsStats,
  diagnostics: ReadonlyArray<ConverterDiagnostic>
): string | null {
  if (fontStats.failedFaces === 0 && diagnostics.length === 0) {
    return null;
  }

  const parts: Array<string> = [];
  if (fontStats.failedFaces > 0) {
    parts.push(`${fontStats.failedFaces} 个预览字体加载失败`);
  }

  if (diagnostics.length > 0) {
    const groups = summarizeDiagnostics(diagnostics);
    const top = groups.slice(0, 4).map(formatGroup);
    parts.push(
      `转换提示 ${diagnostics.length} 项：${top.join("；")}${
        groups.length > 4 ? "…" : ""
      }`
    );
  }

  return `${parts.join("。")}。复制已继续，导出可能与预览不完全一致`;
}
