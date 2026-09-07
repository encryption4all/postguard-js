import type { PostGuardConfig } from '../types.js';

/** Merge two `HeadersInit` values into a plain object, with `extra` taking
 *  precedence over `base` on conflicting (case-insensitive) keys. Returns
 *  `undefined` when both are absent so callers can pass it straight to
 *  `fetch` without forcing an empty headers object. */
export function mergeHeaders(base?: HeadersInit, extra?: HeadersInit): HeadersInit | undefined {
  if (!base && !extra) return undefined;
  return { ...Object.fromEntries(new Headers(base)), ...Object.fromEntries(new Headers(extra)) };
}

/** Cryptify's per-channel upload metrics header (`PostGuardConfig.cryptifyChannel`).
 *  Meaningful to Cryptify only — the PKG's CORS allow-list does not carry it,
 *  so it must never reach a PKG request. */
export const CRYPTIFY_SOURCE_HEADER = 'X-Cryptify-Source';

function undefinedIfEmpty(headers: Headers): HeadersInit | undefined {
  const entries = Object.fromEntries(headers);
  return Object.keys(entries).length > 0 ? entries : undefined;
}

/** Headers for a PKG request: the shared bag minus `X-Cryptify-Source`
 *  (case-insensitive), whether or not `cryptifyChannel` is set. */
export function pkgHeaders(config: Pick<PostGuardConfig, 'headers'>): HeadersInit | undefined {
  const headers = new Headers(config.headers);
  headers.delete(CRYPTIFY_SOURCE_HEADER);
  return undefinedIfEmpty(headers);
}

/** Headers for a Cryptify request: the shared bag plus
 *  `X-Cryptify-Source: <cryptifyChannel>`. When `cryptifyChannel` is set it
 *  wins over any `X-Cryptify-Source` a caller put in `headers`. */
export function cryptifyHeaders(
  config: Pick<PostGuardConfig, 'headers' | 'cryptifyChannel'>
): HeadersInit | undefined {
  const headers = new Headers(config.headers);
  if (config.cryptifyChannel) {
    headers.set(CRYPTIFY_SOURCE_HEADER, config.cryptifyChannel);
  }
  return undefinedIfEmpty(headers);
}
