import { defineConfig } from 'tsdown';
import { cpSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  deps: {
    neverBundle: [
      '@transcend-io/conflux',
    ],
  },
  target: false,
  rolldownOptions: {
    // Let rolldown resolve subpath imports from pg-wasm that aren't in the exports map.
    // The JS glue (index_bg.js) gets bundled; the .wasm file stays external (loaded via fetch).
    resolve: {
      conditionNames: ['import', 'default'],
    },
    external: [/\.wasm$/],
  },
  onSuccess: async () => {
    // Copy the WASM binary to dist/ so it sits next to the JS bundle.
    // loadWasm() uses import.meta.url to resolve it at runtime.
    const pgWasmCandidates = [
      'node_modules/@e4a/pg-wasm/bundler',
      'node_modules/@e4a/pg-wasm',
    ];
    const pgWasmDir = pgWasmCandidates.find((p) => existsSync(path.join(p, 'index_bg.wasm')));
    if (pgWasmDir) {
      mkdirSync('dist', { recursive: true });
      cpSync(path.join(pgWasmDir, 'index_bg.wasm'), 'dist/index_bg.wasm');
      console.log('Copied index_bg.wasm to dist/');
    }
  },
});
