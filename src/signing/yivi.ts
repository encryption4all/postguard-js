import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';
import type { SigningKeys } from '../types.js';

export interface YiviSignOptions {
  element: string;
  senderEmail?: string;
  attributes?: { t: string; v?: string }[];
  includeSender?: boolean;
}

/** Extract the sender's email from an IRMA/Yivi session result JWT */
function extractEmailFromJwt(jwt: string): string | undefined {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    // IRMA session result JWT has disclosed attributes in various formats
    const disclosed: any[][] = payload.disclosed ?? [];
    for (const group of disclosed) {
      for (const attr of group) {
        if (attr.id?.endsWith('.email.email') || attr.id?.includes('email')) {
          return attr.rawvalue ?? attr.value?.[''] ?? attr.value;
        }
      }
    }
  } catch {
    // JWT decoding failed — not critical, caller handles missing email
  }
  return undefined;
}

/** Resolve signing keys via a Yivi session (peer-to-peer sending) */
export async function resolveSigningKeysFromYivi(
  pkgUrl: string,
  opts: YiviSignOptions,
  headers?: HeadersInit
): Promise<SigningKeys> {
  const extraHeaders = headers ? Object.fromEntries(new Headers(headers)) : {};
  let senderEmail: string | undefined;

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
        con: [
          opts.senderEmail
            ? { t: 'pbdf.sidn-pbdf.email.email', v: opts.senderEmail }
            : { t: 'pbdf.sidn-pbdf.email.email' },
          ...(opts.attributes ?? []),
        ],
      }),
    },
    result: {
      url: (o: any, { sessionToken }: any) => `${o.url}/v2/request/jwt/${sessionToken}`,
      parseResponse: (r: Response) => {
        return r
          .text()
          .then((jwt: string) => {
            // Extract sender email from the Yivi session JWT
            senderEmail = extractEmailFromJwt(jwt);

            return fetch(`${pkgUrl}/v2/irma/sign/key`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
                ...extraHeaders,
              },
              body: JSON.stringify({
                pubSignId: [{ t: 'pbdf.sidn-pbdf.email.email' }],
              }),
            });
          })
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
    senderEmail: senderEmail ?? opts.senderEmail,
  };
}
