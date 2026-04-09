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
});
