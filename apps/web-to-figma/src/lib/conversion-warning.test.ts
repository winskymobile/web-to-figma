import type { ConverterDiagnostic } from "@figit/dom-to-figma";
import { describe, expect, it } from "vitest";
import {
  buildConversionNotice,
  formatConversionWarning,
  summarizeDiagnostics,
} from "./conversion-warning";

describe("summarizeDiagnostics", () => {
  it("groups by code and ranks reasons", () => {
    const diagnostics: Array<ConverterDiagnostic> = [
      {
        code: "layout-infer-bailed",
        severity: "warning",
        message: "a",
        reason: "non-uniform-gap",
      },
      {
        code: "layout-infer-bailed",
        severity: "warning",
        message: "b",
        reason: "non-uniform-gap",
      },
      {
        code: "layout-infer-bailed",
        severity: "warning",
        message: "c",
        reason: "verify-geometry-failed",
      },
      {
        code: "pseudo-skipped",
        severity: "warning",
        message: "d",
        reason: "masked",
      },
    ];
    const groups = summarizeDiagnostics(diagnostics);
    expect(groups[0]?.code).toBe("layout-infer-bailed");
    expect(groups[0]?.count).toBe(3);
    expect(groups[0]?.reasons[0]).toEqual({
      reason: "non-uniform-gap",
      count: 2,
    });
    expect(groups.some((g) => g.code === "pseudo-skipped")).toBe(true);
  });
});

describe("buildConversionNotice", () => {
  it("returns null when clean", () => {
    expect(
      buildConversionNotice(
        {
          remappedElements: 0,
          loadedFaces: 0,
          failedFaces: 0,
          preservedCustomFamilies: 0,
        },
        []
      )
    ).toBeNull();
  });

  it("builds summary and Chinese detail lines", () => {
    const notice = buildConversionNotice(
      {
        remappedElements: 0,
        loadedFaces: 0,
        failedFaces: 1,
        preservedCustomFamilies: 0,
      },
      [
        {
          code: "layout-infer-bailed",
          severity: "warning",
          message: "x",
          reason: "non-uniform-gap",
        },
        {
          code: "decoration-rasterized",
          severity: "warning",
          message: "y",
          reason: "masked",
        },
      ]
    );
    expect(notice).not.toBeNull();
    expect(notice?.summaryLine).toContain("1 个预览字体加载失败");
    expect(notice?.summaryLine).toContain("转换提示 2 项");
    expect(notice?.detailLines.some((l) => l.includes("自动布局未应用"))).toBe(
      true
    );
    expect(notice?.detailLines.some((l) => l.includes("装饰已栅格化"))).toBe(
      true
    );
    expect(notice?.footer).toContain("复制已继续");
  });
});

describe("formatConversionWarning", () => {
  it("includes Chinese labels for diagnostic codes", () => {
    const warning = formatConversionWarning(
      {
        remappedElements: 0,
        loadedFaces: 0,
        failedFaces: 0,
        preservedCustomFamilies: 0,
      },
      [
        {
          code: "layout-infer-bailed",
          severity: "warning",
          message: "x",
          reason: "non-uniform-gap",
        },
        {
          code: "decoration-rasterized",
          severity: "warning",
          message: "y",
          reason: "masked",
        },
      ]
    );
    expect(warning).toBeTruthy();
    expect(warning).toContain("自动布局未应用");
    expect(warning).toContain("装饰已栅格化");
    expect(warning).toContain("non-uniform-gap");
    expect(warning).toContain("复制已继续");
  });
});
