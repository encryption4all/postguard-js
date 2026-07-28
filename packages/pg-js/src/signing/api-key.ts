import { fetchSigningKeysWithApiKey } from '../api/pkg.js';
import type { SigningKeys } from '../types.js';
import type { EmailAttributes } from '../util/attributes.js';

/** Resolve signing keys using an API key */
export async function resolveSigningKeysFromApiKey(
  pkgUrl: string,
  apiKey: string,
  headers?: HeadersInit,
  emailAttributes?: EmailAttributes
): Promise<SigningKeys> {
  return fetchSigningKeysWithApiKey(pkgUrl, apiKey, headers, emailAttributes);
}
