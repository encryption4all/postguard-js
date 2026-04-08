// Import the wasm-bindgen JS glue directly (bundled by tsdown).
// The .wasm binary is loaded via fetch() at runtime — no bundler WASM plugin needed.
// @ts-ignore — bypasses package exports to import the raw JS glue
import * as bg from '../../node_modules/@e4a/pg-wasm/bundler/index_bg.js';

let initialized = false;

/** Load and initialize the pg-wasm module. Caches after first call. */
export async function loadWasm(): Promise<typeof bg> {
  if (initialized) return bg;

  const wasmUrl = new URL('index_bg.wasm', import.meta.url);
  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();

  const imports = { './index_bg.js': bg as any };
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  (bg as any).__wbg_set_wasm(instance.exports);
  (instance.exports as any).__wbindgen_start();

  initialized = true;
  return bg;
}
