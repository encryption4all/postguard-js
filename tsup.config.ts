import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  external: [
    '@e4a/pg-wasm',
    '@transcend-io/conflux',
    '@privacybydesign/yivi-core',
    '@privacybydesign/yivi-web',
    '@privacybydesign/yivi-client',
  ],
});
