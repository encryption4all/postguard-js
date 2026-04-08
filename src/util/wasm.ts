// Use pg-wasm's web target — it provides an init() function that handles
// fetching and instantiating the WASM binary internally.
// @ts-ignore — bypasses package exports to import the web target directly
import init, * as pgWasm from '../../node_modules/@e4a/pg-wasm/web/index.js';

let initialized = false;

/** Load and initialize the pg-wasm module. Caches after first call. */
export async function loadWasm(): Promise<typeof pgWasm> {
  if (!initialized) {
    await init();
    initialized = true;
  }
  return pgWasm;
}
