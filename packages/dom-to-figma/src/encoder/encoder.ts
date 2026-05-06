import { deflateRaw } from "pako";

import { KiwiWriter } from "./kiwi-writer";
import { SCHEMA } from "./schema";

import type { Field, Schema, TypeDef } from "./types";

/**
 * Encode a value based on its datatype
 */
function encodeType(
  writer: KiwiWriter,
  types: Array<TypeDef>,
  datatype: number,
  value: unknown,
  isArray: boolean
) {
  if (isArray) {
    if (datatype === -2) {
      // Fast path for byte arrays
      let byteData: Uint8Array;
      if (value instanceof Uint8Array) {
        byteData = value;
      } else if (value instanceof ArrayBuffer) {
        byteData = new Uint8Array(value);
      } else if (Array.isArray(value)) {
        // Convert array of integers to Uint8Array
        byteData = new Uint8Array(value as Array<number>);
      } else {
        throw new Error(
          `Byte array type expected Uint8Array, ArrayBuffer, or Array, got ${typeof value}`
        );
      }
      writer.uint(byteData.length);
      writer.bytes(byteData);
    } else {
      // Regular arrays
      if (!Array.isArray(value)) {
        throw new Error(`Array type expected Array, got ${typeof value}`);
      }
      writer.uint(value.length);
      for (const item of value) {
        encodeType(writer, types, datatype, item, false);
      }
    }
    return;
  }

  // Handle primitive types
  switch (datatype) {
    case -1: // bool
      writer.bool(value as boolean);
      break;
    case -2: // byte
      writer.byte(value as number);
      break;
    case -3: // int
      writer.int(value as number);
      break;
    case -4: // uint
      writer.uint(value as number);
      break;
    case -5: // float
      writer.float(value as number);
      break;
    case -6: // string
      writer.string(value as string);
      break;
    case -7: // int64
      writer.int64(value as number);
      break;
    case -8: // uint64
      writer.uint64(value as number);
      break;
    default: {
      // Handle custom types
      const typeDef = types[datatype];
      if (!typeDef) {
        throw new Error(`Type definition not found for datatype ${datatype}`);
      }

      if (typeDef.kind === 0) {
        // Enum - find the field ID for the enum value
        let enumId: number | null = null;
        for (const [fieldId, field] of Object.entries(typeDef.fields)) {
          if (field.name === value) {
            enumId = Number.parseInt(fieldId, 10);
            break;
          }
        }
        if (enumId === null) {
          throw new Error(
            `Unknown enum value '${value as string}' for type '${typeDef.name}'`
          );
        }
        writer.uint(enumId);
      } else if (typeDef.kind === 1) {
        // Struct - write all fields in order
        if (typeof value !== "object" || value === null) {
          throw new Error(`Struct type expected object, got ${typeof value}`);
        }

        const fieldCount = Object.keys(typeDef.fields).length;
        for (let i = 1; i <= fieldCount; i += 1) {
          const field = typeDef.fields[i];

          if (!field) {
            throw new Error(
              `Field not found for index ${i} in struct '${typeDef.name}'`
            );
          }

          const objValue = value as Record<string, unknown>;
          const fieldValue = objValue[field.name];

          if (fieldValue === undefined) {
            throw new Error(
              `Missing required field '${field.name}' in struct '${typeDef.name}'`
            );
          }
          encodeType(writer, types, field.datatype, fieldValue, field.array);
        }
      } else {
        // Message - write field ID followed by value, end with 0
        if (typeof value !== "object" || value === null) {
          throw new Error(`Message type expected object, got ${typeof value}`);
        }

        const objValue = value as Record<string, unknown>;

        for (const [fieldId, field] of Object.entries(typeDef.fields)) {
          if (field.name in objValue) {
            writer.uint(Number.parseInt(fieldId, 10));
            encodeType(
              writer,
              types,
              field.datatype,
              objValue[field.name],
              field.array
            );
          }
        }

        writer.uint(0); // End marker
      }
      break;
    }
  }
}

/**
 * Write schema definition to Kiwi format
 */
function writeSchema(writer: KiwiWriter, types: Array<TypeDef>) {
  writer.uint(types.length);

  for (const typeDef of types) {
    writer.string(typeDef.name);
    writer.byte(typeDef.kind);

    const fieldCount = Object.keys(typeDef.fields).length;
    writer.uint(fieldCount);

    for (const [fieldId, field] of Object.entries(typeDef.fields)) {
      writer.string(field.name);
      writer.int(field.datatype);
      writer.bool(field.array);
      writer.uint(Number.parseInt(fieldId, 10));
    }
  }
}

/**
 * Create Type objects from schema data
 */
function createTypesFromSchema(schemaData: Schema): Array<TypeDef> {
  const types: Array<TypeDef> = [];

  for (const typeInfo of schemaData.types) {
    const fields: Record<string, Field> = {};
    for (const [fieldIdStr, fieldInfo] of Object.entries(typeInfo.fields)) {
      const fieldId = Number.parseInt(fieldIdStr, 10);
      fields[fieldId] = {
        name: fieldInfo.name,
        datatype: fieldInfo.datatype,
        array: fieldInfo.array,
        datatype_name: fieldInfo.datatype_name,
      };
    }

    types.push({
      kind: typeInfo.kind,
      name: typeInfo.name,
      fields,
      kind_name: typeInfo.kind_name,
      field_count: typeInfo.field_count,
      index: typeInfo.index,
    });
  }

  return types;
}

/**
 * Convert lists of integers to Uint8Array for byte arrays
 */
function convertListsToBytes(data: unknown, isByteArray = false): unknown {
  if (typeof data === "object" && data !== null) {
    if (Array.isArray(data)) {
      // Only convert to Uint8Array if this is explicitly a byte array
      if (
        isByteArray &&
        data.every(
          (item) => typeof item === "number" && item >= 0 && item <= 255
        )
      ) {
        return new Uint8Array(data as Array<number>);
      }
      // Recursively process array items
      return data.map((item) => convertListsToBytes(item, false));
    }
    // Object - recursively process properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = convertListsToBytes(value, key === "bytes");
    }
    return result;
  }
  return data;
}

/**
 * Concatenate multiple Uint8Arrays into a single array
 */
function concatenateUint8Arrays(arrays: Array<Uint8Array>) {
  // Calculate total length
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }

  // Create result array and copy data
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Main browser-friendly encode function
 *
 * @param {unknown} jsonData - The JSON data to encode
 * @returns {Object} Result containing figBytes, base64, and html
 */
export function encodeFigmaData(jsonData: unknown) {
  const version = SCHEMA.version;

  // Convert data for proper byte array handling
  const convertedData = convertListsToBytes(jsonData);

  // Create types from schema
  const types = createTypesFromSchema(SCHEMA);

  // Find root type index
  let rootIndex: number | null = null;
  for (const [i, type_] of types.entries()) {
    if (type_.name === "Message") {
      rootIndex = i;
      break;
    }
  }

  if (rootIndex === null) {
    throw new Error("No root 'Message' type found in schema");
  }

  const output: Array<Uint8Array> = [];

  // Write header
  const encoder = new TextEncoder();
  output.push(encoder.encode("fig-kiwi"));

  // Write version (4 bytes, little-endian)
  const versionBuffer = new ArrayBuffer(4);
  new DataView(versionBuffer).setUint32(0, version, true);
  output.push(new Uint8Array(versionBuffer));

  // Write schema segment
  const schemaWriter = new KiwiWriter();
  writeSchema(schemaWriter, types);
  const schemaDataBytes = schemaWriter.getBytes();

  // Compress schema (using pako - must be loaded separately)
  const compressedSchema = deflateRaw(schemaDataBytes, { level: 6 });

  // Write schema segment length and data
  const schemaLengthBuffer = new ArrayBuffer(4);
  new DataView(schemaLengthBuffer).setUint32(0, compressedSchema.length, true);
  output.push(new Uint8Array(schemaLengthBuffer));
  output.push(new Uint8Array(compressedSchema));

  // Write data segment
  const dataWriter = new KiwiWriter();
  encodeType(dataWriter, types, rootIndex, convertedData, false);
  const dataBytes = dataWriter.getBytes();

  // Compress data
  const compressedData = deflateRaw(dataBytes, { level: 6 });

  // Write data segment length and data
  const dataLengthBuffer = new ArrayBuffer(4);
  new DataView(dataLengthBuffer).setUint32(0, compressedData.length, true);
  output.push(new Uint8Array(dataLengthBuffer));
  output.push(new Uint8Array(compressedData));

  // Concatenate all parts
  const figBytes = concatenateUint8Arrays(output);

  // Convert to base64
  let base64 = "";
  const chunkSize = 0x80_00; // Process in chunks to avoid stack overflow
  for (let i = 0; i < figBytes.length; i += chunkSize) {
    const chunk = figBytes.slice(i, i + chunkSize);
    base64 += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
  }

  return {
    figBytes,
    base64,
    size: figBytes.length,
  };
}
