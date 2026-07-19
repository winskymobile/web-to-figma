import type { ConverterDiagnostic } from "@figit/dom-to-figma";
import type { PrepareFontsStats } from "./prepare-preview-fonts";

/** Shared non-blocking warning decision used by App and integration tests. */
export function formatConversionWarning(
  fontStats: PrepareFontsStats,
  diagnostics: ReadonlyArray<ConverterDiagnostic>
): string | null {
  if (fontStats.failedFaces === 0 && diagnostics.length === 0) {
    return null;
  }

  const details = [
    fontStats.failedFaces > 0
      ? `${fontStats.failedFaces} 个预览字体加载失败`
      : null,
    diagnostics.length > 0 ? `${diagnostics.length} 个转换降级或错误` : null,
  ].filter((detail): detail is string => detail !== null);

  return `${details.join("，")}；复制已继续，但导出可能与预览不完全一致`;
}
