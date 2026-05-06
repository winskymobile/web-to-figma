import type { PathCommand } from "../path-parser";
import type {
  VectorNetwork,
  VectorRegion,
  WindingRule,
} from "../vector-networks/types";
import type { CurveBuilderState } from "./curve-builder";
import { createInitialState, processCommand } from "./curve-builder";
import { addRegionFromCurrentPath, finalizeRegions } from "./region-builder";

export type { BezierCurve } from "./arc-converter";
export type { CurveBuilderState } from "./curve-builder";

export type PathToVectorResult = {
  vectorNetwork: VectorNetwork;
  normalizationOffset?: { x: number; y: number };
};

export function convertPathToVectorNetwork(
  commands: Array<PathCommand>,
  params: { normalize: boolean; fillRule?: WindingRule } = { normalize: true }
): PathToVectorResult {
  const state = createInitialState();
  const regions: Array<VectorRegion> = [];
  const fillRule = params.fillRule ?? "NONZERO";
  let normalizationOffset: { x: number; y: number } | undefined;

  // For evenodd, collect all subpaths into a single region using NONZERO
  if (fillRule === "ODD") {
    const allPaths: Array<Array<number>> = [];
    let currentPath: Array<number> = [];

    for (const cmd of commands) {
      const { type } = cmd;

      // Handle move commands - start new subpath
      if (type === "M" && currentPath.length > 0) {
        allPaths.push([...currentPath]);
        currentPath = [];
      }

      processCommand(state, cmd);

      // Collect segments for the current path
      if (state.currentPath.length > currentPath.length) {
        currentPath.push(...state.currentPath.slice(currentPath.length));
      }

      // Handle close path commands
      if (type === "Z") {
        if (currentPath.length > 0) {
          allPaths.push([...currentPath]);
          currentPath = [];
        }
        state.currentPath = [];
      }
    }

    if (currentPath.length > 0) {
      allPaths.push(currentPath);
    }

    if (allPaths.length > 0) {
      const region: VectorRegion = {
        styleID: 0,
        windingRule: "NONZERO",
        loops: allPaths.map((pathSegments) => ({
          segments: pathSegments,
          windingRule: "NONZERO",
        })),
      };
      regions.push(region);
    }
  } else {
    // Normal logic for nonzero fill rule
    for (const cmd of commands) {
      const { type } = cmd;

      // Handle move commands specially - they create new regions
      if (type === "M") {
        addRegionFromCurrentPath(state, regions, fillRule);
      }

      processCommand(state, cmd);

      // Handle close path commands - they finalize current region
      if (type === "Z") {
        addRegionFromCurrentPath(state, regions, fillRule);
      }
    }

    // Add any remaining path as a region
    const finalRegions = finalizeRegions(state, fillRule);
    regions.push(...finalRegions);
  }

  // Normalize coordinates to start from (0,0) like Figma does
  if (params.normalize && state.vertices.length > 0) {
    normalizationOffset = normalizeVertices(state);
  }

  return {
    vectorNetwork: {
      vertices: state.vertices,
      segments: state.segments,
      regions,
    },
    normalizationOffset,
  };
}

function normalizeVertices(state: CurveBuilderState): { x: number; y: number } {
  // Find bounding box
  const firstVertex = state.vertices[0];
  if (!firstVertex) {
    return { x: 0, y: 0 };
  }

  let minX = firstVertex.x;
  let minY = firstVertex.y;
  let maxX = firstVertex.x;
  let maxY = firstVertex.y;

  for (const vertex of state.vertices) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  // Translate all vertices to start from (0,0)
  const offsetX = minX;
  const offsetY = minY;

  for (const vertex of state.vertices) {
    vertex.x -= offsetX;
    vertex.y -= offsetY;
  }

  // Return the offset that was applied
  return { x: offsetX, y: offsetY };
}
