import type { SessionCallback, SigningKeys } from '../types.js';
import { getSigningKeysWithJwt } from '../api/pkg.js';

/** Resolve signing keys by calling a user-provided session callback to get a JWT,
 *  then exchanging it with the PKG for signing keys. */
export async function resolveSigningKeysFromSession(
  pkgUrl: string,
  callback: SessionCallback,
  senderEmail: string,
  headers?: HeadersInit
): Promise<SigningKeys> {
  const jwt = await callback({
    con: [{ t: 'pbdf.sidn-pbdf.email.email', v: senderEmail }],
    sort: 'Signing',
  });

  return getSigningKeysWithJwt(
    pkgUrl,
    jwt,
    { pubSignId: [{ t: 'pbdf.sidn-pbdf.email.email' }] },
    headers
  );
}
