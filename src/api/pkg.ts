import { NetworkError } from '../errors.js';
import type { SigningKeys } from '../types.js';

/** Fetch the master public key from the PKG server */
export async function fetchMPK(pkgUrl: string): Promise<unknown> {
  const response = await fetch(`${pkgUrl}/v2/parameters`);
  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Failed to fetch PKG parameters`, response.status, body);
  }
  const json = await response.json();
  return json.publicKey;
}

/** Fetch the verification key for signature verification (used in decryption) */
export async function fetchVerificationKey(pkgUrl: string): Promise<unknown> {
  const response = await fetch(`${pkgUrl}/v2/sign/parameters`);
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
  apiKey: string
): Promise<SigningKeys> {
  const response = await fetch(`${pkgUrl}/v2/irma/sign/key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
