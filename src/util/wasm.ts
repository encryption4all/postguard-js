// Use pg-wasm's web target — it provides an init() function that accepts
// a URL, Response, or ArrayBuffer for the WASM binary. We import a
// pre-patched copy generated at prebuild time (see
// scripts/generate-wasm-base64.mjs) which has wasm-bindgen's dead
// `new URL("index_bg.wasm", import.meta.url)` default-value branch
// stripped — that branch never fires at runtime (loadWasm always passes
// a defined `module_or_path`) but webpack 5 statically analyses the
// `new URL` and fails consumer builds because no separate wasm file
// ships in pg-js's dist.
// @ts-ignore — generated JS shim, no .d.ts
import init, * as pgWasm from './pg-wasm-shim.js';
import { WASM_BASE64 } from './wasm-binary.js';

let initialized = false;

function decodeBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Load and initialize the pg-wasm module. Caches after first call. */
export async function loadWasm(): Promise<typeof pgWasm> {
  if (!initialized) {
    await init({ module_or_path: decodeBase64(WASM_BASE64) });
    initialized = true;
  }
  return pgWasm;
}
