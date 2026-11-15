import { defineConfig } from "tsup";

// Bundles to ESM + CJS with .d.ts. React and Next-adjacent libs stay external
// (peer/regular deps) so consumers get exactly one React instance.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  // Keep "use client" directives on the emitted bundle for Next.js consumers.
  banner: { js: '"use client";' },
});
