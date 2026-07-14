import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';
import { PostGuardError, YiviSessionError } from '../errors.js';
import { injectYiviCss } from './inject-css.js';
import { decodeJwtPayloadUnsafe } from '../util/jwt.js';

// Re-export utilities from shared module
export { sortPolicies, secondsTill4AM, buildKeyRequest } from '../util/policy.js';

// --- JWT Cache ---

interface CacheEntry {
  jwt: string;
  expiresAt: number; // Unix timestamp in seconds
}

export const JWT_CACHE_MAX_SIZE = 100;

/**
 * Upper bound on how long a cached JWT is honoured, regardless of the `exp`
 * claim carried in its (unverified) payload.
 *
 * SECURITY: the `exp` used below is read from the JWT payload without verifying
 * its signature, so it must not be trusted verbatim. USKs are only valid until
 * the next 4 AM rotation (< 24h), so a cache lifetime beyond a day is never
 * legitimate — clamp to it. The PKG still validates the JWT signature on every
 * reuse, so the clamp simply bounds the local cache lifetime.
 */
export const MAX_CACHE_TTL_SECONDS = 24 * 60 * 60;

const jwtCache = new Map<string, CacheEntry>();

function getCacheKey(
  recipientEmail: string,
  con: { t: string; v?: string }[]
): string {
  return `${recipientEmail}:${JSON.stringify(con)}`;
}

/** Remove every entry whose expiry has passed (with the same 30s margin used on read). */
function sweepExpired(): void {
  const nowSec = Date.now() / 1000;
  for (const [key, entry] of jwtCache) {
    if (nowSec >= entry.expiresAt - 30) {
      jwtCache.delete(key);
    }
  }
}

/** Look up a cached JWT for this recipient+policy. Returns null if absent or expired. */
function getCachedJwt(
  recipientEmail: string,
  con: { t: string; v?: string }[]
): string | null {
  const key = getCacheKey(recipientEmail, con);
  const entry = jwtCache.get(key);
  if (!entry) return null;

  // Check expiry with 30s margin
  if (Date.now() / 1000 >= entry.expiresAt - 30) {
    jwtCache.delete(key);
    return null;
  }
  // Refresh recency so the LRU eviction picks the truly oldest entry.
  jwtCache.delete(key);
  jwtCache.set(key, entry);
  return entry.jwt;
}

/** Store a JWT in the cache. Parses expiry from the JWT payload. */
function cacheJwt(
  recipientEmail: string,
  con: { t: string; v?: string }[],
  jwt: string
): void {
  try {
    // Decode JWT payload (base64url → JSON) WITHOUT verifying the signature.
    const decoded = decodeJwtPayloadUnsafe(jwt);
    if (!decoded) return;

    const exp = decoded.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return;

    const nowSec = Date.now() / 1000;
    // Never trust the JWT-claimed `exp` beyond a bounded window (see
    // MAX_CACHE_TTL_SECONDS).
    const expiresAt = Math.min(exp, nowSec + MAX_CACHE_TTL_SECONDS);
    // Reject already-expired (or non-positive) claims outright.
    if (expiresAt <= nowSec) return;

    sweepExpired();

    const key = getCacheKey(recipientEmail, con);
    // If the key is already present, delete first so the re-insert lands at the end (most-recent).
    jwtCache.delete(key);
    // Evict least-recently-used entries until we're under the cap.
    while (jwtCache.size >= JWT_CACHE_MAX_SIZE) {
      const oldest = jwtCache.keys().next().value;
      if (oldest === undefined) break;
      jwtCache.delete(oldest);
    }
    jwtCache.set(key, { jwt, expiresAt });
  } catch {
    // If we can't parse the JWT, don't cache it
  }
}

// Test-only helpers. Not part of the public surface.
export const __testing = {
  cacheJwt,
  getCachedJwt,
  size: () => jwtCache.size,
  clear: () => jwtCache.clear(),
};

// --- USK retrieval ---

/** Retrieve a USK using a cached JWT (no Yivi session needed) */
async function retrieveUSKWithJwt(
  pkgUrl: string,
  jwt: string,
  timestamp: number
): Promise<unknown> {
  const response = await fetch(`${pkgUrl}/v2/irma/key/${timestamp.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = await response.json();
  if (json.status !== 'DONE' || json.proofStatus !== 'VALID') {
    throw new PostGuardError('Cached JWT session not valid');
  }
  return json.key;
}

/** Retrieve a User Secret Key (USK) via a Yivi session for decryption */
export async function retrieveUSKViaYivi(
  pkgUrl: string,
  element: string,
  keyRequest: { con: { t: string; v?: string }[]; validity: number },
  timestamp: number,
  enableCache?: boolean,
  recipientEmail?: string
): Promise<unknown> {
  // Check cache first
  if (enableCache && recipientEmail) {
    const cachedJwt = getCachedJwt(recipientEmail, keyRequest.con);
    if (cachedJwt) {
      try {
        return await retrieveUSKWithJwt(pkgUrl, cachedJwt, timestamp);
      } catch {
        // Cache entry invalid, fall through to Yivi session
        jwtCache.delete(getCacheKey(recipientEmail, keyRequest.con));
      }
    }
  }

  const session = {
    url: pkgUrl,
    start: {
      url: (o: any) => `${o.url}/v2/irma/start`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keyRequest),
    },
    result: {
      url: (o: any, { sessionToken }: any) => `${o.url}/v2/irma/jwt/${sessionToken}`,
      parseResponse: (r: Response) => {
        return r
          .text()
          .then((jwt: string) => {
            // Cache the JWT if caching is enabled
            if (enableCache && recipientEmail) {
              cacheJwt(recipientEmail, keyRequest.con, jwt);
            }
            return fetch(`${pkgUrl}/v2/irma/key/${timestamp.toString()}`, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
          })
          .then((r: Response) => r.json())
          .then((json: any) => {
            if (json.status !== 'DONE' || json.proofStatus !== 'VALID') {
              throw new PostGuardError('Yivi proof not valid');
            }
            return json.key;
          });
      },
    },
  };

  const yivi = new YiviCore({
    debugging: false,
    session,
    element,
    minimal: true,
    language: 'en',
    state: {
      // Prefer the irmaserver's Server-Sent Events stream (/frontend/statusevents)
      // for near-instant status updates; yivi-client automatically falls back to
      // polling if the SSE connection can't be established within `timeout`.
      // (Previously this was `false`, which forced polling for every session.)
      serverSentEvents: {
        endpoint: 'statusevents',
        timeout: 2000,
      },
      polling: {
        endpoint: 'status',
        interval: 500,
        startState: 'INITIALIZED',
      },
    },
  });

  injectYiviCss();

  // Small delay to ensure DOM element is ready
  await new Promise((resolve) => setTimeout(resolve, 500));

  yivi.use(YiviWeb);
  yivi.use(YiviClient);

  // yivi-core's start() rejects with a bare string final-state name on
  // anything other than Success ("Cancelled", "TimedOut", "Aborted").
  // Translate to a proper Error so consumer try/catch + instanceof
  // checks behave, and clear the widget host so the cancelled red-X UI
  // doesn't linger past the rejection.
  try {
    return await yivi.start();
  } catch (raw) {
    cleanupYiviHost(element);
    if (raw instanceof Error) throw raw;
    if (typeof raw === 'string') throw new YiviSessionError(raw);
    throw new YiviSessionError(String(raw ?? 'Unknown'));
  }
}

function cleanupYiviHost(selector: string): void {
  try {
    const host = typeof document !== 'undefined' ? document.querySelector(selector) : null;
    if (host) host.innerHTML = '';
  } catch {
    // ignore — non-DOM environments or detached selectors
  }
}
