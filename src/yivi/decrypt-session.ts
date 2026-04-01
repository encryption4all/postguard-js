import { YiviNotInstalledError, PostGuardError } from '../errors.js';

// Re-export utilities from shared module
export { sortPolicies, secondsTill4AM, buildKeyRequest } from '../util/policy.js';

/** Retrieve a User Secret Key (USK) via a Yivi session for decryption */
export async function retrieveUSKViaYivi(
  pkgUrl: string,
  element: string,
  keyRequest: { con: { t: string; v?: string }[]; validity: number },
  timestamp: number
): Promise<unknown> {
  let YiviCore: any, YiviClient: any, YiviWeb: any;
  try {
    ({ YiviCore } = await import('@privacybydesign/yivi-core'));
    ({ YiviClient } = await import('@privacybydesign/yivi-client'));
    ({ YiviWeb } = await import('@privacybydesign/yivi-web'));
  } catch {
    throw new YiviNotInstalledError();
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
          .then((jwt: string) =>
            fetch(`${pkgUrl}/v2/irma/key/${timestamp.toString()}`, {
              headers: { Authorization: `Bearer ${jwt}` },
            })
          )
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

  // Small delay to ensure DOM element is ready
  await new Promise((resolve) => setTimeout(resolve, 500));

  yivi.use(YiviWeb);
  yivi.use(YiviClient);

  return yivi.start();
}
