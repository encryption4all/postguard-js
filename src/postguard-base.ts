import type {
  PostGuardConfig,
  ApiKeySign,
  YiviSign,
  SessionSign,
  SessionCallback,
} from './types.js';
import { RecipientBuilder } from './recipients/builder.js';
import { EmailHelpers } from './email/index.js';

/** Base class with config, builders, and email helpers shared by PostGuard variants. */
export class PostGuardBase {
  /** @internal */
  protected readonly config: PostGuardConfig;

  /** Email helpers for building/parsing PostGuard-encrypted emails */
  readonly email: EmailHelpers;

  constructor(config: PostGuardConfig) {
    this.config = config;
    this.email = new EmailHelpers(config);
  }

  /** Signing method builders */
  readonly sign = {
    apiKey: (apiKey: string): ApiKeySign => ({
      type: 'apiKey',
      apiKey,
    }),
    yivi: (opts: { element: string; senderEmail?: string; attributes?: { t: string; v?: string; optional?: boolean }[]; includeSender?: boolean }): YiviSign => ({
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
