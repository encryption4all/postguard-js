import type { WasmModule } from '../types.js';

let cached: WasmModule | null = null;

/** Load and cache the pg-wasm module. Accepts an optional pre-loaded module for custom environments (e.g. Thunderbird). */
export async function loadWasm(custom?: WasmModule): Promise<WasmModule> {
  if (custom) return custom;
  if (cached) return cached;
  const mod: any = await import('@e4a/pg-wasm');
  if (typeof mod.default === 'function') await mod.default();
  cached = mod as WasmModule;
  return cached;
}
