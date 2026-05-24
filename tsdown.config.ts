import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/sdk.ts"],
  format: "esm",
  dts: {
    eager: true,
  },
  sourcemap: true,
  clean: true,
});
