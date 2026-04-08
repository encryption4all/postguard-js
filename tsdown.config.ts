import { defineConfig } from 'tsdown';

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
    // The pg-wasm web target's init() loads the .wasm via import.meta.url at runtime.
    // Keep .wasm files external so rolldown doesn't try to process them.
    external: [/\.wasm$/],
  },
});
