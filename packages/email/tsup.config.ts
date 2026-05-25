import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/templates/WeeklyDigest.tsx'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  splitting: false,
  jsx: 'react-jsx',
  external: ['react', '@react-email/components'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
});
