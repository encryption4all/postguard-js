import type { SessionCallback, SigningKeys } from '../types.js';
import { getSigningKeysWithJwt } from '../api/pkg.js';

/** Resolve signing keys by calling a user-provided session callback to get a JWT,
 *  then exchanging it with the PKG for signing keys. */
export async function resolveSigningKeysFromSession(
  pkgUrl: string,
  callback: SessionCallback,
  senderEmail: string | undefined,
  headers?: HeadersInit
): Promise<SigningKeys> {
  const emailAttr = senderEmail
    ? { t: 'pbdf.sidn-pbdf.email.email', v: senderEmail }
    : { t: 'pbdf.sidn-pbdf.email.email' };

  const jwt = await callback({
    con: [emailAttr],
    sort: 'Signing',
  });

  return getSigningKeysWithJwt(
    pkgUrl,
    jwt,
    { pubSignId: [{ t: 'pbdf.sidn-pbdf.email.email' }] },
    headers
  );
}
