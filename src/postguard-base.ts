import type {
  PostGuardConfig,
  ApiKeySign,
  YiviSign,
  SessionSign,
  SessionCallback,
  AttrConItem,
} from './types.js';
import { RecipientBuilder } from './recipients/builder.js';
import { EmailHelpers } from './email/index.js';
import {
  PG_CLIENT_VERSION_HEADER,
  defaultClientVersionHeaderValue,
} from './util/client-version.js';

/** Base class with config, builders, and email helpers shared by PostGuard variants. */
export class PostGuardBase {
  /** @internal */
  protected readonly config: PostGuardConfig;

  /** Email helpers for building/parsing PostGuard-encrypted emails */
  readonly email: EmailHelpers;

  constructor(config: PostGuardConfig) {
    // Stamp this SDK's identity onto every outgoing request (PKG + cryptify)
    // unless the caller already set the header — an embedding host (e.g. the
    // Outlook add-in) passes its own `X-POSTGUARD-CLIENT-VERSION` and wins.
    // `Headers.has`/`set` are case-insensitive, so a differently-cased caller
    // key is still respected.
    const headers = new Headers(config.headers);
    if (!headers.has(PG_CLIENT_VERSION_HEADER)) {
      headers.set(PG_CLIENT_VERSION_HEADER, defaultClientVersionHeaderValue());
    }
    this.config = { ...config, headers };
    this.email = new EmailHelpers(this.config);
  }

  /** Signing method builders */
  readonly sign = {
    apiKey: (apiKey: string): ApiKeySign => ({
      type: 'apiKey',
      apiKey,
    }),
    yivi: (opts: {
      element: string;
      senderEmail?: string;
      attributes?: AttrConItem[];
      includeSender?: boolean;
    }): YiviSign => ({
      type: 'yivi',
      ...opts,
    }),
    session: (callback: SessionCallback, opts: { senderEmail: string }): SessionSign => ({
      type: 'session',
      callback,
      senderEmail: opts.senderEmail,
    }),
  };

  /** Recipient builders */
  readonly recipient = {
    email: (email: string): RecipientBuilder =>
      new RecipientBuilder(email, 'email'),
    emailDomain: (email: string): RecipientBuilder =>
      new RecipientBuilder(email, 'emailDomain'),
  };
}
