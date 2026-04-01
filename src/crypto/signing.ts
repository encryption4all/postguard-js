import type { SignMethod, SigningKeys } from '../types.js';
import { resolveSigningKeysFromApiKey } from '../signing/api-key.js';
import { resolveSigningKeysFromYivi } from '../signing/yivi.js';
import { resolveSigningKeysFromSession } from '../signing/session.js';

/** Resolve signing keys from any sign method */
export async function resolveSigningKeys(
  pkgUrl: string,
  sign: SignMethod,
  headers?: HeadersInit
): Promise<SigningKeys> {
  switch (sign.type) {
    case 'apiKey':
      return resolveSigningKeysFromApiKey(pkgUrl, sign.apiKey, headers);
    case 'yivi':
      return resolveSigningKeysFromYivi(pkgUrl, {
        element: sign.element,
        senderEmail: sign.senderEmail,
        includeSender: sign.includeSender,
      });
    case 'session':
      return resolveSigningKeysFromSession(pkgUrl, sign.callback, sign.senderEmail, headers);
  }
}
