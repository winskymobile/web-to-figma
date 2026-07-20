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

export type ConversionNotice = {
  hasIssues: true;
  failedFaces: number;
  diagnosticTotal: number;
  groups: Array<DiagnosticGroup>;
  /** Short line for collapsed toast body */
  summaryLine: string;
  /** Group lines for expanded detail */
  detailLines: Array<string>;
  footer: string;
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

const NOTICE_FOOTER = "复制已继续，导出可能与预览不完全一致";

/** Structured notice for unified copy-result UI. */
export function buildConversionNotice(
  fontStats: PrepareFontsStats,
  diagnostics: ReadonlyArray<ConverterDiagnostic>
): ConversionNotice | null {
  if (fontStats.failedFaces === 0 && diagnostics.length === 0) {
    return null;
  }

  const groups =
    diagnostics.length > 0 ? summarizeDiagnostics(diagnostics) : [];
  const summaryParts: Array<string> = [];
  if (fontStats.failedFaces > 0) {
    summaryParts.push(`${fontStats.failedFaces} 个预览字体加载失败`);
  }
  if (diagnostics.length > 0) {
    summaryParts.push(`转换提示 ${diagnostics.length} 项`);
  }

  const detailLines = groups.slice(0, 6).map(formatGroup);
  if (groups.length > 6) {
    detailLines.push(`…另有 ${groups.length - 6} 类`);
  }

  return {
    hasIssues: true,
    failedFaces: fontStats.failedFaces,
    diagnosticTotal: diagnostics.length,
    groups,
    summaryLine: summaryParts.join(" · "),
    detailLines,
    footer: NOTICE_FOOTER,
  };
}

/** Shared non-blocking warning string (tests + legacy). */
export function formatConversionWarning(
  fontStats: PrepareFontsStats,
  diagnostics: ReadonlyArray<ConverterDiagnostic>
): string | null {
  const notice = buildConversionNotice(fontStats, diagnostics);
  if (!notice) {
    return null;
  }
  const detail =
    notice.detailLines.length > 0
      ? `：${notice.detailLines.slice(0, 4).join("；")}${
          notice.detailLines.length > 4 ? "…" : ""
        }`
      : "";
  // Preserve previous shape: summary pieces + “转换提示 N 项：…” when diagnostics exist
  if (notice.failedFaces > 0 && notice.diagnosticTotal > 0) {
    return `${notice.failedFaces} 个预览字体加载失败。转换提示 ${notice.diagnosticTotal} 项${detail}。${notice.footer}`;
  }
  if (notice.failedFaces > 0) {
    return `${notice.failedFaces} 个预览字体加载失败。${notice.footer}`;
  }
  return `转换提示 ${notice.diagnosticTotal} 项${detail}。${notice.footer}`;
}
