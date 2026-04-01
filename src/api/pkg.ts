import { NetworkError } from '../errors.js';
import type { SigningKeys, SessionStartResult, AttributeCon } from '../types.js';

function mergeHeaders(base?: HeadersInit, extra?: HeadersInit): HeadersInit | undefined {
  if (!base && !extra) return undefined;
  return { ...Object.fromEntries(new Headers(base)), ...Object.fromEntries(new Headers(extra)) };
}

/** Fetch the master public key from the PKG server */
export async function fetchMPK(pkgUrl: string, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(`${pkgUrl}/v2/parameters`, {
    headers: headers ? new Headers(headers) : undefined,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to fetch PKG parameters`, response.status, body);
  }
  const json = await response.json();
  return json.publicKey;
}

/** Fetch the verification key for signature verification (used in decryption) */
export async function fetchVerificationKey(pkgUrl: string, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(`${pkgUrl}/v2/sign/parameters`, {
    headers: headers ? new Headers(headers) : undefined,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to fetch sign parameters`, response.status, body);
  }
  const json = await response.json();
  return json.publicKey;
}

/** Fetch signing keys using an API key (PostGuard for Business) */
export async function fetchSigningKeysWithApiKey(
  pkgUrl: string,
  apiKey: string,
  headers?: HeadersInit
): Promise<SigningKeys> {
  const response = await fetch(`${pkgUrl}/v2/irma/sign/key`, {
    method: 'POST',
    headers: new Headers(mergeHeaders(headers, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    })),
    body: JSON.stringify({
      pubSignId: [{ t: 'pbdf.sidn-pbdf.email.email' }],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to fetch signing keys`, response.status, body);
  }
  return response.json();
}

/** Start a Yivi/IRMA session via the PKG server */
export async function startSession(
  pkgUrl: string,
  con: AttributeCon,
  sort?: string,
  headers?: HeadersInit
): Promise<SessionStartResult> {
  const response = await fetch(`${pkgUrl}/v2/request/start`, {
    method: 'POST',
    headers: new Headers(mergeHeaders(headers, {
      'Content-Type': 'application/json',
    })),
    body: JSON.stringify({ con, sort }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to start session`, response.status, body);
  }
  return response.json();
}

/** Retrieve the JWT result of a completed Yivi session */
export async function getSessionJwt(
  pkgUrl: string,
  token: string,
  headers?: HeadersInit
): Promise<string> {
  const response = await fetch(`${pkgUrl}/v2/request/jwt/${token}`, {
    headers: headers ? new Headers(headers) : undefined,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to fetch session JWT`, response.status, body);
  }
  return response.text();
}

/** Retrieve a User Secret Key (USK) using a JWT */
export async function getUSK(
  pkgUrl: string,
  jwt: string,
  timestamp: number,
  headers?: HeadersInit
): Promise<unknown> {
  const response = await fetch(`${pkgUrl}/v2/irma/key/${timestamp}`, {
    headers: new Headers(mergeHeaders(headers, {
      Authorization: `Bearer ${jwt}`,
    })),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to fetch USK`, response.status, body);
  }
  const json = await response.json();
  if (json.status !== 'DONE' || json.proofStatus !== 'VALID') {
    throw new NetworkError(`PKG session not DONE and VALID`, 0, JSON.stringify(json));
  }
  return json.key;
}

/** Retrieve signing keys using a JWT */
export async function getSigningKeysWithJwt(
  pkgUrl: string,
  jwt: string,
  keyRequest?: object,
  headers?: HeadersInit
): Promise<SigningKeys> {
  const response = await fetch(`${pkgUrl}/v2/irma/sign/key`, {
    method: 'POST',
    headers: new Headers(mergeHeaders(headers, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    })),
    body: JSON.stringify(keyRequest),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to fetch signing keys`, response.status, body);
  }
  const json = await response.json();
  if (json.status !== 'DONE' || json.proofStatus !== 'VALID') {
    throw new NetworkError(`PKG signing session not DONE and VALID`, 0, JSON.stringify(json));
  }
  return { pubSignKey: json.pubSignKey, privSignKey: json.privSignKey };
}
