import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/slices.ts", "src/next.ts", "src/node.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  // Keep these as peer/regular deps of the published package, never bundled in.
  external: ["react", "react-dom", "next", "@architon-creator/ui", /^@prismicio\//],
});
