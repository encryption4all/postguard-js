import { YiviNotInstalledError } from '../errors.js';
import type { SigningKeys } from '../types.js';

export interface YiviSignOptions {
  element: string;
  senderEmail: string;
  includeSender?: boolean;
}

/** Resolve signing keys via a Yivi session (peer-to-peer sending) */
export async function resolveSigningKeysFromYivi(
  pkgUrl: string,
  opts: YiviSignOptions
): Promise<SigningKeys> {
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
      url: (o: any) => `${o.url}/v2/request/start`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        con: [{ t: 'pbdf.sidn-pbdf.email.email', v: opts.senderEmail }],
      }),
    },
    result: {
      url: (o: any, { sessionToken }: any) => `${o.url}/v2/irma/jwt/${sessionToken}`,
      parseResponse: (r: Response) => {
        return r
          .text()
          .then((jwt: string) =>
            fetch(`${pkgUrl}/v2/irma/sign/key`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
              },
              body: JSON.stringify({
                pubSignId: [{ t: 'pbdf.sidn-pbdf.email.email' }],
              }),
            })
          )
          .then((r: Response) => r.json());
      },
    },
  };

  const yivi = new YiviCore({
    debugging: false,
    session,
    element: opts.element,
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

  yivi.use(YiviWeb);
  yivi.use(YiviClient);

  const result = await yivi.start();
  return {
    pubSignKey: result.pubSignKey,
    privSignKey: result.privSignKey,
  };
}
