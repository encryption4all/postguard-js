/** Merge two `HeadersInit` values into a plain object, with `extra` taking
 *  precedence over `base` on conflicting (case-insensitive) keys. Returns
 *  `undefined` when both are absent so callers can pass it straight to
 *  `fetch` without forcing an empty headers object. */
export function mergeHeaders(base?: HeadersInit, extra?: HeadersInit): HeadersInit | undefined {
  if (!base && !extra) return undefined;
  return { ...Object.fromEntries(new Headers(base)), ...Object.fromEntries(new Headers(extra)) };
}
