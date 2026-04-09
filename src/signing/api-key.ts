import { fetchSigningKeysWithApiKey } from '../api/pkg.js';
import type { SigningKeys } from '../types.js';

/** Resolve signing keys using an API key */
export async function resolveSigningKeysFromApiKey(
  pkgUrl: string,
  apiKey: string,
  headers?: HeadersInit
): Promise<SigningKeys> {
  return fetchSigningKeysWithApiKey(pkgUrl, apiKey, headers);
}
