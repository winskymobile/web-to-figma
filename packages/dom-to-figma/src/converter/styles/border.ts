import type { FigmaColor, FigmaPaint } from "../types";
import { cssColorToFigmaColor } from "./color";

export type BorderProperties = {
  strokeWeight: number;
  strokePaints: Array<FigmaPaint>;
  cornerRadius?: number;
  // Conditional properties - only included when needed
  borderTopWeight?: number;
  borderRightWeight?: number;
  borderBottomWeight?: number;
  borderLeftWeight?: number;
  borderStrokeWeightsIndependent?: boolean;
  rectangleTopLeftCornerRadius?: number;
  rectangleTopRightCornerRadius?: number;
  rectangleBottomLeftCornerRadius?: number;
  rectangleBottomRightCornerRadius?: number;
  rectangleCornerRadiiIndependent?: boolean;
};

/**
 * Parse CSS border properties and convert them to Figma border format
 *
 * @param computedStyle - The computed style of the element.
 * @returns The border properties.
 */
export function parseBorderFromComputedStyle(
  computedStyle: CSSStyleDeclaration
): BorderProperties {
  // Check for borders on all sides
  const borderTopWidth = Number.parseFloat(computedStyle.borderTopWidth || "0");
  const borderRightWidth = Number.parseFloat(
    computedStyle.borderRightWidth || "0"
  );
  const borderBottomWidth = Number.parseFloat(
    computedStyle.borderBottomWidth || "0"
  );
  const borderLeftWidth = Number.parseFloat(
    computedStyle.borderLeftWidth || "0"
  );

  // Check if borders are independent (different widths on different sides)
  const hasIndependentBorders =
    borderTopWidth !== borderRightWidth ||
    borderTopWidth !== borderBottomWidth ||
    borderTopWidth !== borderLeftWidth;

  // Use the maximum border width as the base stroke weight for color
  const maxBorderWidth = Math.max(
    borderTopWidth,
    borderRightWidth,
    borderBottomWidth,
    borderLeftWidth
  );
  const strokeWeight = maxBorderWidth;

  // Get border color - prioritize the side with the largest border (Figma only supports one color for the stroke)
  const strokePaints: Array<FigmaPaint> = [];
  if (maxBorderWidth > 0) {
    let strokeColor: {
      color: FigmaColor;
      opacity: number;
    } | null = null;

    if (borderTopWidth === maxBorderWidth) {
      strokeColor = cssColorToFigmaColor(
        computedStyle.borderTopColor || computedStyle.borderColor
      );
    } else if (borderRightWidth === maxBorderWidth) {
      strokeColor = cssColorToFigmaColor(
        computedStyle.borderRightColor || computedStyle.borderColor
      );
    } else if (borderBottomWidth === maxBorderWidth) {
      strokeColor = cssColorToFigmaColor(
        computedStyle.borderBottomColor || computedStyle.borderColor
      );
    } else if (borderLeftWidth === maxBorderWidth) {
      strokeColor = cssColorToFigmaColor(
        computedStyle.borderLeftColor || computedStyle.borderColor
      );
    }

    if (strokeColor) {
      strokePaints.push({
        type: "SOLID",
        color: strokeColor.color,
        opacity: strokeColor.opacity,
        visible: true,
        blendMode: "NORMAL",
      });
    }
  }

  // Parse border radius properties
  const borderRadiusTopLeft = Number.parseFloat(
    computedStyle.borderTopLeftRadius || "0"
  );
  const borderRadiusTopRight = Number.parseFloat(
    computedStyle.borderTopRightRadius || "0"
  );
  const borderRadiusBottomLeft = Number.parseFloat(
    computedStyle.borderBottomLeftRadius || "0"
  );
  const borderRadiusBottomRight = Number.parseFloat(
    computedStyle.borderBottomRightRadius || "0"
  );

  const hasIndependentCorners =
    borderRadiusTopLeft !== borderRadiusTopRight ||
    borderRadiusTopLeft !== borderRadiusBottomLeft ||
    borderRadiusTopLeft !== borderRadiusBottomRight;

  const borderProps: BorderProperties = {
    strokeWeight,
    strokePaints,
    cornerRadius: hasIndependentCorners ? undefined : borderRadiusTopLeft,
  };

  // Only include individual border weights if they're different
  if (hasIndependentBorders) {
    borderProps.borderTopWeight = borderTopWidth;
    borderProps.borderRightWeight = borderRightWidth;
    borderProps.borderBottomWeight = borderBottomWidth;
    borderProps.borderLeftWeight = borderLeftWidth;
    borderProps.borderStrokeWeightsIndependent = hasIndependentBorders;
  }

  // Only include individual corner radii if they're different
  if (hasIndependentCorners) {
    borderProps.rectangleTopLeftCornerRadius = borderRadiusTopLeft;
    borderProps.rectangleTopRightCornerRadius = borderRadiusTopRight;
    borderProps.rectangleBottomLeftCornerRadius = borderRadiusBottomLeft;
    borderProps.rectangleBottomRightCornerRadius = borderRadiusBottomRight;
    borderProps.rectangleCornerRadiiIndependent = hasIndependentCorners;
  }

  return borderProps;
}
