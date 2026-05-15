import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/schemas/index.ts',
    'src/types/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ['zod'],
  // outDir defaults to dist/
  // tsup emits .mjs for ESM + .cjs for CJS + .d.ts for types
  // Sub-path entries land at dist/schemas/index.{mjs,cjs,d.ts} matching the exports map.
});
