import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/figma.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
});
