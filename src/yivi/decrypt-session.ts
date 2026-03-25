import { YiviNotInstalledError, PostGuardError } from '../errors.js';

/** Sort policy attributes alphabetically by type */
export function sortPolicies(con: { t: string; v?: string }[]): { t: string; v?: string }[] {
  return [...con].sort((a, b) => a.t.localeCompare(b.t));
}

/** Calculate seconds until 4 AM (PKG key validity period) */
export function secondsTill4AM(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(4, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 1000);
}

/** Build the key request from a policy entry for a specific recipient */
export function buildKeyRequest(
  key: string,
  policy: { ts: number; con: { t: string; v?: string }[] }
): { con: { t: string; v?: string }[]; validity: number } {
  const recipientAndCreds = sortPolicies(policy.con);

  const stripped = JSON.parse(JSON.stringify(recipientAndCreds));
  for (const c of stripped) {
    if (c.t === 'pbdf.sidn-pbdf.email.email') {
      c.v = key;
    } else if (c.t === 'pbdf.sidn-pbdf.email.domain') {
      if (!c.v && key.includes('@')) {
        c.v = key.split('@')[1];
      }
    } else {
      delete c.v;
    }
  }

  return {
    con: stripped,
    validity: secondsTill4AM(),
  };
}

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
