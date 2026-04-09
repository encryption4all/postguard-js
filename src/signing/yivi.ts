import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';
import type { SigningKeys } from '../types.js';

export interface YiviSignOptions {
  element: string;
  senderEmail: string;
  includeSender?: boolean;
}

/** Resolve signing keys via a Yivi session (peer-to-peer sending) */
export async function resolveSigningKeysFromYivi(
  pkgUrl: string,
  opts: YiviSignOptions,
  headers?: HeadersInit
): Promise<SigningKeys> {
  const extraHeaders = headers ? Object.fromEntries(new Headers(headers)) : {};

  const session = {
    url: pkgUrl,
    start: {
      url: (o: any) => `${o.url}/v2/request/start`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({
        con: [{ t: 'pbdf.sidn-pbdf.email.email', v: opts.senderEmail }],
      }),
    },
    result: {
      url: (o: any, { sessionToken }: any) => `${o.url}/v2/request/jwt/${sessionToken}`,
      parseResponse: (r: Response) => {
        return r
          .text()
          .then((jwt: string) =>
            fetch(`${pkgUrl}/v2/irma/sign/key`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
                ...extraHeaders,
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

  const result = await yivi.start() as any;
  return {
    pubSignKey: result.pubSignKey,
    privSignKey: result.privSignKey,
  };
}
