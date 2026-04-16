import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';
import { PostGuardError } from '../errors.js';
import { injectYiviCss } from './inject-css.js';

// Re-export utilities from shared module
export { sortPolicies, secondsTill4AM, buildKeyRequest } from '../util/policy.js';

// --- JWT Cache ---

interface CacheEntry {
  jwt: string;
  expiresAt: number; // Unix timestamp in seconds
}

const jwtCache = new Map<string, CacheEntry>();

function getCacheKey(
  recipientEmail: string,
  con: { t: string; v?: string }[]
): string {
  return `${recipientEmail}:${JSON.stringify(con)}`;
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
  return entry.jwt;
}

/** Store a JWT in the cache. Parses expiry from the JWT payload. */
function cacheJwt(
  recipientEmail: string,
  con: { t: string; v?: string }[],
  jwt: string
): void {
  try {
    // Decode JWT payload (base64url → JSON)
    const payload = jwt.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const expiresAt = decoded.exp as number;
    if (expiresAt) {
      jwtCache.set(getCacheKey(recipientEmail, con), { jwt, expiresAt });
    }
  } catch {
    // If we can't parse the JWT, don't cache it
  }
}

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
      serverSentEvents: false,
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

  return yivi.start();
}
