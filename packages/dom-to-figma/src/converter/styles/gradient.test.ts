import { describe, expect, it } from "vitest";
import { cssBackgroundToFigmaPaints } from "./gradient";

describe("cssBackgroundToFigmaPaints", () => {
  it("parses linear-gradient with angle and modern color stops", () => {
    const paints = cssBackgroundToFigmaPaints(
      "linear-gradient(135deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)"
    );
    expect(paints).toHaveLength(1);
    const paint = paints[0];
    expect(paint?.type).toBe("GRADIENT_LINEAR");
    if (paint?.type !== "GRADIENT_LINEAR") {
      return;
    }
    expect(paint.stops).toHaveLength(2);
    expect(paint.stops[0]?.position).toBeCloseTo(0, 5);
    expect(paint.stops[1]?.position).toBeCloseTo(1, 5);
    expect(paint.stops[0]?.color.r).toBeCloseTo(1, 5);
    expect(paint.stops[1]?.color.b).toBeCloseTo(1, 5);
    expect(paint.transform).toBeDefined();
  });

  it("parses to-right keyword as 90deg and produces a transform", () => {
    const paints = cssBackgroundToFigmaPaints(
      "linear-gradient(to right, #000, #fff)"
    );
    expect(paints[0]?.type).toBe("GRADIENT_LINEAR");
    if (paints[0]?.type !== "GRADIENT_LINEAR") {
      return;
    }
    // 90deg CSS → LTR base: identity-ish (cos=1,sin=0)
    expect(paints[0].transform?.m00).toBeCloseTo(1, 5);
    expect(paints[0].transform?.m01).toBeCloseTo(0, 5);
    expect(paints[0].transform?.m10).toBeCloseTo(0, 5);
    expect(paints[0].transform?.m11).toBeCloseTo(1, 5);
  });

  it("parses to-bottom as 180deg", () => {
    const paints = cssBackgroundToFigmaPaints(
      "linear-gradient(to bottom, #ff0000, #0000ff)"
    );
    if (paints[0]?.type !== "GRADIENT_LINEAR") {
      throw new Error("expected linear");
    }
    // 180deg: cos=-1? (180-90)=90 → cos0=0 sin1=1 wait (180-90)=90deg
    // radians = 90° → cos=0, sin=1
    expect(paints[0].transform?.m00).toBeCloseTo(0, 5);
    expect(paints[0].transform?.m01).toBeCloseTo(1, 5);
  });

  it("handles rgba stops with spaces inside color functions", () => {
    const paints = cssBackgroundToFigmaPaints(
      "linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, rgba(0, 255, 0, 1) 100%)"
    );
    if (paints[0]?.type !== "GRADIENT_LINEAR") {
      throw new Error("expected linear");
    }
    expect(paints[0].stops[0]?.color.a).toBeCloseTo(0.5, 5);
    expect(paints[0].stops[1]?.color.g).toBeCloseTo(1, 5);
  });

  it("parses multiple background layers and keeps both", () => {
    const paints = cssBackgroundToFigmaPaints(
      "linear-gradient(to right, #f00, #0f0), linear-gradient(to bottom, #00f, #000)"
    );
    expect(paints.length).toBe(2);
  });
});
