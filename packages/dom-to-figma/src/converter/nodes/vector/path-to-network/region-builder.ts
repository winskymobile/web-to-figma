import type { VectorRegion, WindingRule } from "../vector-networks/types";
import type { CurveBuilderState } from "./curve-builder";

function createRegionFromPath(
  currentPath: Array<number>,
  fillRule: WindingRule = "NONZERO"
): VectorRegion {
  return {
    styleID: 0,
    windingRule: fillRule,
    loops: [
      {
        segments: currentPath,
        windingRule: fillRule,
      },
    ],
  };
}

export function finalizeRegions(
  state: CurveBuilderState,
  fillRule: WindingRule = "NONZERO"
): Array<VectorRegion> {
  const regions: Array<VectorRegion> = [];

  // Add any remaining current path as a region
  if (state.currentPath.length > 0) {
    regions.push(createRegionFromPath(state.currentPath, fillRule));
  }

  return regions;
}

export function addRegionFromCurrentPath(
  state: CurveBuilderState,
  regions: Array<VectorRegion>,
  fillRule: WindingRule = "NONZERO"
): void {
  if (state.currentPath.length > 0) {
    regions.push(createRegionFromPath(state.currentPath, fillRule));
    state.currentPath = [];
  }
}
