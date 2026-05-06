import { inflateRaw } from "pako";
import { describe, expect, it } from "vitest";
import { getRootTemplate } from "../converter/nodes/root/converter";
import { encodeFigmaData } from "./encoder";

const FRAME_WIDTH = 100;
const FRAME_HEIGHT = 100;

const minimalDocument = () =>
  getRootTemplate({ width: FRAME_WIDTH, height: FRAME_HEIGHT, blobs: [] });

describe("encodeFigmaData", () => {
  it("starts with the fig-kiwi magic header", () => {
    const HEADER_BYTES = 8;
    const { figBytes } = encodeFigmaData(minimalDocument());
    const header = new TextDecoder().decode(figBytes.slice(0, HEADER_BYTES));
    expect(header).toBe("fig-kiwi");
  });

  it("base64 decodes to the same byte length as figBytes", () => {
    const result = encodeFigmaData(minimalDocument());
    expect(atob(result.base64)).toHaveLength(result.figBytes.length);
  });

  it("data segment is a valid deflateRaw stream", () => {
    const HEADER_BYTES = 8;
    const VERSION_BYTES = 4;
    const LENGTH_BYTES = 4;
    const { figBytes } = encodeFigmaData(minimalDocument());

    const view = new DataView(
      figBytes.buffer,
      figBytes.byteOffset,
      figBytes.byteLength
    );

    let offset = HEADER_BYTES + VERSION_BYTES;
    const schemaLength = view.getUint32(offset, true);
    offset += LENGTH_BYTES + schemaLength;

    const dataLength = view.getUint32(offset, true);
    offset += LENGTH_BYTES;

    const dataSegment = figBytes.slice(offset, offset + dataLength);
    const inflated = inflateRaw(dataSegment);

    expect(inflated.length).toBeGreaterThan(0);
  });

  it("throws when given a non-object root", () => {
    expect(() => encodeFigmaData(null)).toThrow();
    expect(() => encodeFigmaData("invalid")).toThrow();
  });
});
