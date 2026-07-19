import { describe, expect, it } from "vitest";

import {
  defaultWidthFor,
  MOBILE_WIDTHS,
  PC_WIDTHS,
  widthsFor,
  withWidth,
} from "./viewport";

describe("viewport presets", () => {
  it("offers everyday mobile and PC widths", () => {
    expect([...MOBILE_WIDTHS]).toEqual([360, 375, 390, 430]);
    expect([...PC_WIDTHS]).toEqual([1280, 1366, 1440, 1920]);
    expect(widthsFor("mobile")).toEqual(MOBILE_WIDTHS);
    expect(widthsFor("pc")).toEqual(PC_WIDTHS);
  });

  it("keeps defaults at 375 / 1440", () => {
    expect(defaultWidthFor("mobile")).toBe(375);
    expect(defaultWidthFor("pc")).toBe(1440);
  });

  it("rejects removed legacy widths", () => {
    expect(withWidth("mobile", 414)).toBeNull();
    expect(withWidth("pc", 1512)).toBeNull();
    expect(withWidth("mobile", 430)).toEqual({ kind: "mobile", width: 430 });
    expect(withWidth("pc", 1366)).toEqual({ kind: "pc", width: 1366 });
  });
});
