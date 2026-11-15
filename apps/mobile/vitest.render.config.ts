import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Render tests (happy-dom + react-dom as a stand-in renderer). React Native and native
// modules are replaced by DOM stubs. This proves React-level behaviour (render errors,
// error boundaries, hooks) — NOT native/device behaviour.
const stubs = resolve(__dirname, 'src/__tests__/render/stubs');
const rootReact = resolve(__dirname, '../../node_modules/react');

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^react$/, replacement: resolve(rootReact, 'index.js') },
      { find: /^react\/jsx-runtime$/, replacement: resolve(rootReact, 'jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: resolve(rootReact, 'jsx-dev-runtime.js') },
      { find: /^react-native$/, replacement: resolve(stubs, 'react-native.tsx') },
      { find: /^react-native-safe-area-context$/, replacement: resolve(stubs, 'safe-area.tsx') },
      { find: /^@expo\/vector-icons$/, replacement: resolve(stubs, 'vector-icons.tsx') },
      { find: /^expo-router$/, replacement: resolve(stubs, 'expo-router.ts') },
      { find: /^expo-notifications$/, replacement: resolve(stubs, 'expo-notifications.ts') },
      { find: /^react-native-mmkv$/, replacement: resolve(stubs, 'mmkv.ts') },
      { find: /^@ziko\/ui$/, replacement: resolve(stubs, 'ziko-ui.ts') },
      { find: /^@sentry\/react-native$/, replacement: resolve(stubs, 'sentry.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/__tests__/render/**/*.test.tsx'],
    passWithNoTests: true,
  },
});
