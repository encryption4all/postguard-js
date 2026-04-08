// Use pg-wasm's web target — it provides an init() function that accepts
// a URL, Response, or ArrayBuffer for the WASM binary.
// @ts-ignore — bypasses package exports to import the web target directly
import init, * as pgWasm from '../../node_modules/@e4a/pg-wasm/web/index.js';
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
