import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviWeb } from '@privacybydesign/yivi-web';

export interface RunYiviSessionOptions {
  /** PKG server URL */
  pkgUrl: string;
  /** CSS selector for the DOM element to render the QR code into */
  element: string;
  /** Attribute constraints the user must disclose */
  con: { t: string; v?: string }[];
  /** Session type: 'Signing' starts via /v2/request, 'Decryption' starts via /v2/irma */
  sort: 'Signing' | 'Decryption';
  /** Optional extra headers for PKG requests */
  headers?: Record<string, string>;
  /** Language for the Yivi UI (default: 'en') */
  language?: 'en' | 'nl';
}

/**
 * Run a complete Yivi session: render QR code, wait for user to scan,
 * and return the JWT from the PKG server.
 *
 * Uses minimal styling from yivi-web — only the QR code is rendered,
 * so you can wrap it in your own UI.
 */
export async function runYiviSession(options: RunYiviSessionOptions): Promise<string> {
  const { pkgUrl, element, con, sort, headers, language = 'en' } = options;

  // Determine the correct PKG endpoints based on session type
  const isDecryption = sort === 'Decryption';
  const startUrl = isDecryption ? '/v2/irma/start' : '/v2/request/start';
  const jwtUrl = isDecryption ? '/v2/irma/jwt' : '/v2/request/jwt';

  const session = {
    url: pkgUrl,
    start: {
      url: (o: any) => `${o.url}${startUrl}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ con }),
    },
    result: {
      url: (o: any, { sessionToken }: any) => `${o.url}${jwtUrl}/${sessionToken}`,
      parseResponse: (r: Response) => r.text(),
    },
  };

  const yivi = new YiviCore({
    debugging: false,
    session,
    element,
    minimal: true,
    language,
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

  return yivi.start() as Promise<string>;
}
