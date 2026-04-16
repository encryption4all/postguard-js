import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';
import { injectYiviCss } from '../yivi/inject-css.js';
import type { SigningKeys } from '../types.js';

export interface YiviSignOptions {
  element: string;
  senderEmail?: string;
  attributes?: { t: string; v?: string; optional?: boolean }[];
  includeSender?: boolean;
}

/**
 * Extract all disclosed attributes from an IRMA/Yivi session result JWT.
 *
 * Returns the sender email and a list of all other disclosed attribute type ids.
 */
function parseDisclosedJwt(jwt: string): { email?: string; otherAttrTypes: string[] } {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const disclosed: any[][] = payload.disclosed ?? [];
    let email: string | undefined;
    const otherAttrTypes: string[] = [];

    for (const group of disclosed) {
      for (const attr of group) {
        if (!attr.id || attr.rawvalue == null) continue;
        if (attr.id.endsWith('.email.email') || attr.id.includes('email')) {
          email ??= attr.rawvalue ?? attr.value?.[''] ?? attr.value;
        } else {
          otherAttrTypes.push(attr.id);
        }
      }
    }
    return { email, otherAttrTypes };
  } catch {
    return { otherAttrTypes: [] };
  }
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
            const { email, otherAttrTypes } = parseDisclosedJwt(jwt);
            senderEmail = email;

            // Build signing key request:
            // - pubSignId: email (always public)
            // - privSignId: any other disclosed attributes (optional sender identity)
            const keyRequest: Record<string, unknown> = {
              pubSignId: [{ t: 'pbdf.sidn-pbdf.email.email' }],
            };
            if (otherAttrTypes.length > 0) {
              keyRequest.privSignId = otherAttrTypes.map(t => ({ t }));
            }

            return fetch(`${pkgUrl}/v2/irma/sign/key`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
                ...extraHeaders,
              },
              body: JSON.stringify(keyRequest),
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

  injectYiviCss();

  yivi.use(YiviWeb);
  yivi.use(YiviClient);

  const result = await yivi.start() as any;
  return {
    pubSignKey: result.pubSignKey,
    privSignKey: result.privSignKey,
    senderEmail: senderEmail ?? opts.senderEmail,
  };
}
