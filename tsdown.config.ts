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
    '@e4a/pg-wasm',
    '@transcend-io/conflux',
    '@privacybydesign/yivi-core',
    '@privacybydesign/yivi-web',
    '@privacybydesign/yivi-client',
  ],
  },
  target: false,
});
