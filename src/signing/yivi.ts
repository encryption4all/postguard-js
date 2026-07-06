import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';
import { injectYiviCss } from '../yivi/inject-css.js';
import { YiviSessionError } from '../errors.js';
import { decodeJwtPayloadUnsafe } from '../util/jwt.js';
import type { SigningKeys, AttrConItem, AttrReq } from '../types.js';

export interface YiviSignOptions {
  element: string;
  senderEmail?: string;
  attributes?: AttrConItem[];
  includeSender?: boolean;
}

/** Build the JSON body POSTed to `${pkgUrl}/v2/request/start`.
 *  Exposed for unit testing — the runtime call path uses it via `JSON.stringify`. */
export function buildStartRequestBody(opts: YiviSignOptions): {
  con: AttrConItem[];
} {
  const emailAttr: AttrReq = opts.senderEmail
    ? { t: 'pbdf.sidn-pbdf.email.email', v: opts.senderEmail }
    : { t: 'pbdf.sidn-pbdf.email.email' };
  // Callers must not include pbdf.sidn-pbdf.email.email in `attributes`; it
  // is always prepended automatically and would appear twice otherwise.
  return { con: [emailAttr, ...(opts.attributes ?? [])] };
}

/**
 * Flatten the attribute type ids the client itself requested for this session,
 * unwrapping both the legacy flat shape and disjunction-of-conjunctions.
 *
 * This set is the *trusted* source of truth for which attributes may legitimately
 * appear in the signing-key request (see `parseDisclosedJwt`).
 */
export function collectRequestedAttrTypes(attributes?: AttrConItem[]): Set<string> {
  const types = new Set<string>();
  for (const item of attributes ?? []) {
    if (Array.isArray(item)) {
      for (const conjunction of item) {
        for (const attr of conjunction) {
          if (attr?.t) types.add(attr.t);
        }
      }
    } else if (item?.t) {
      types.add(item.t);
    }
  }
  return types;
}

/**
 * Extract disclosed attributes from an IRMA/Yivi session result JWT.
 *
 * SECURITY: the JWT signature is NOT verified here, so its payload is not
 * trustworthy on its own. The returned `otherAttrTypes` are therefore
 * intersected with `allowedAttrTypes` — the set of attributes the client
 * actually requested for this session — so only locally-requested attribute
 * types flow into the signing-key request sent to PKG. Any disclosed attribute
 * type the client never asked for is ignored. `email` is used only for the
 * display/identity value and never drives the key request body (which always
 * uses the fixed `pbdf.sidn-pbdf.email.email` type id).
 *
 * Returns the sender email and the de-duplicated list of allowed disclosed
 * attribute type ids.
 */
export function parseDisclosedJwt(
  jwt: string,
  allowedAttrTypes: Set<string>
): { email?: string; otherAttrTypes: string[] } {
  const payload = decodeJwtPayloadUnsafe(jwt);
  if (!payload) return { otherAttrTypes: [] };

  const disclosed = Array.isArray(payload.disclosed) ? payload.disclosed : [];
  let email: string | undefined;
  const otherAttrTypes: string[] = [];
  const seen = new Set<string>();

  for (const group of disclosed) {
    if (!Array.isArray(group)) continue;
    for (const attr of group) {
      if (!attr || typeof attr.id !== 'string' || attr.rawvalue == null) continue;
      if (attr.id.endsWith('.email.email') || attr.id.includes('email')) {
        email ??= attr.rawvalue ?? attr.value?.[''] ?? attr.value;
      } else if (allowedAttrTypes.has(attr.id) && !seen.has(attr.id)) {
        // Only attributes the client itself requested may reach the key request.
        seen.add(attr.id);
        otherAttrTypes.push(attr.id);
      }
    }
  }
  return { email, otherAttrTypes };
}

/** Resolve signing keys via a Yivi session (peer-to-peer sending) */
export async function resolveSigningKeysFromYivi(
  pkgUrl: string,
  opts: YiviSignOptions,
  headers?: HeadersInit
): Promise<SigningKeys> {
  if (typeof document === 'undefined') {
    throw new YiviSessionError(
      'sign.yivi requires a DOM (browser environment). ' +
      'Use sign.apiKey for server-side encryption or sign.session with a custom callback.'
    );
  }

  const extraHeaders = headers ? Object.fromEntries(new Headers(headers)) : {};
  // Trusted source of truth for which attribute types the key request may
  // include — bounds what a tampered session JWT can influence.
  const allowedAttrTypes = collectRequestedAttrTypes(opts.attributes);
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
      body: JSON.stringify(buildStartRequestBody(opts)),
    },
    result: {
      url: (o: any, { sessionToken }: any) => `${o.url}/v2/request/jwt/${sessionToken}`,
      parseResponse: (r: Response) => {
        return r
          .text()
          .then((jwt: string) => {
            const { email, otherAttrTypes } = parseDisclosedJwt(jwt, allowedAttrTypes);
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

  // yivi-core's start() rejects with a bare string final-state name on
  // anything other than Success ("Cancelled", "TimedOut", "Aborted").
  // Translate that into a proper Error so consumers' try/catch +
  // instanceof checks work, and so the rejection has a useful stack and
  // message instead of a one-word primitive. Also clear the widget host
  // element so the cancelled/red-X UI doesn't linger past the rejection.
  let result: any;
  try {
    result = await yivi.start();
  } catch (raw) {
    cleanupYiviHost(opts.element);
    if (raw instanceof Error) throw raw;
    if (typeof raw === 'string') throw new YiviSessionError(raw);
    throw new YiviSessionError(String(raw ?? 'Unknown'));
  }
  return {
    pubSignKey: result.pubSignKey,
    privSignKey: result.privSignKey,
    // Prefer the client-provided email (trusted) over the value read from the
    // unverified JWT payload.
    senderEmail: opts.senderEmail ?? senderEmail,
  };
}

function cleanupYiviHost(selector: string): void {
  try {
    const host = typeof document !== 'undefined' ? document.querySelector(selector) : null;
    if (host) host.innerHTML = '';
  } catch {
    // ignore — non-DOM environments or detached selectors
  }
}
