import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';
import type { SigningKeys, ConDisCon, AttributeRequest } from '../types.js';

export interface YiviSignOptions {
  element: string;
  senderEmail?: string;
  attributes?: { t: string; v?: string; optional?: boolean }[];
  condiscon?: ConDisCon;
  includeSender?: boolean;
}

/**
 * Build a condiscon from the simple `attributes` builder format.
 *
 * Email is always added as the first required discon entry.
 * Each attribute becomes its own discon entry:
 * - Required (no value): `[[ { type, notNull: true } ]]`
 * - Required with value: `[[ { type, value } ]]`
 * - Optional: `[ [], [{ type, notNull: true }] ]` (empty first option = user can skip)
 */
function buildCondiscon(
  senderEmail?: string,
  attributes?: { t: string; v?: string; optional?: boolean }[]
): ConDisCon {
  const condiscon: ConDisCon = [];

  // Email is always required
  const emailReq: AttributeRequest = senderEmail
    ? { type: 'pbdf.sidn-pbdf.email.email', value: senderEmail }
    : { type: 'pbdf.sidn-pbdf.email.email', notNull: true };
  condiscon.push([[emailReq]]);

  for (const attr of attributes ?? []) {
    const req: AttributeRequest = attr.v
      ? { type: attr.t, value: attr.v }
      : { type: attr.t, notNull: true };

    if (attr.optional) {
      // Empty first option means the user may skip this attribute
      condiscon.push([[], [req]]);
    } else {
      condiscon.push([[req]]);
    }
  }

  return condiscon;
}

/** Disclosed attribute extracted from a Yivi session result JWT */
interface DisclosedAttribute {
  id: string;
  value: string;
}

/**
 * Extract all disclosed attributes from an IRMA/Yivi session result JWT.
 *
 * The JWT payload contains a `disclosed` field which is an array of arrays.
 * Each outer entry corresponds to a discon (disjunction) in the original request.
 * Each inner entry is a disclosed attribute with `id`, `rawvalue`, and `status`.
 * Empty/null groups mean the user skipped an optional discon.
 */
function extractDisclosedFromJwt(jwt: string): DisclosedAttribute[] {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const disclosed: any[][] = payload.disclosed ?? [];
    const result: DisclosedAttribute[] = [];
    for (const group of disclosed) {
      for (const attr of group) {
        if (attr.id && (attr.rawvalue != null)) {
          result.push({ id: attr.id, value: attr.rawvalue });
        }
      }
    }
    return result;
  } catch {
    return [];
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

  // Build the condiscon: either use the raw condiscon or build from attributes
  const condiscon = opts.condiscon ?? buildCondiscon(opts.senderEmail, opts.attributes);

  const session = {
    url: pkgUrl,
    start: {
      url: (o: any) => `${o.url}/v2/request/start`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({ condiscon }),
    },
    result: {
      url: (o: any, { sessionToken }: any) => `${o.url}/v2/request/jwt/${sessionToken}`,
      parseResponse: (r: Response) => {
        return r
          .text()
          .then((jwt: string) => {
            // Extract all disclosed attributes from the session JWT
            const disclosed = extractDisclosedFromJwt(jwt);

            // Find sender email from disclosed attributes
            const emailAttr = disclosed.find(a => a.id.endsWith('.email.email') || a.id.includes('email'));
            senderEmail = emailAttr?.value;

            // Build the signing key request:
            // - pubSignId: email (always public)
            // - privSignId: all other disclosed attributes (optional/private)
            const privAttrs = disclosed.filter(a => !(a.id.endsWith('.email.email') || a.id.includes('email')));

            const keyRequest: Record<string, unknown> = {
              pubSignId: [{ t: 'pbdf.sidn-pbdf.email.email' }],
            };

            if (privAttrs.length > 0) {
              keyRequest.privSignId = privAttrs.map(a => ({ t: a.id }));
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

  yivi.use(YiviWeb);
  yivi.use(YiviClient);

  const result = await yivi.start() as any;
  return {
    pubSignKey: result.pubSignKey,
    privSignKey: result.privSignKey,
    senderEmail: senderEmail ?? opts.senderEmail,
  };
}
