import type {
  PostGuardConfig,
  EmailRecipient,
  EmailDomainRecipient,
  CustomPolicyRecipient,
  ApiKeySign,
  YiviSign,
  SessionSign,
  SessionCallback,
  ConDisCon,
} from './types.js';
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
    yivi: (opts: { element: string; senderEmail?: string; attributes?: { t: string; v?: string; optional?: boolean }[]; condiscon?: ConDisCon; includeSender?: boolean }): YiviSign => ({
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
    email: (email: string): EmailRecipient => ({
      type: 'email',
      email,
    }),
    emailDomain: (email: string): EmailDomainRecipient => ({
      type: 'emailDomain',
      email,
    }),
    withPolicy: (email: string, policy: { t: string; v: string }[]): CustomPolicyRecipient => ({
      type: 'customPolicy',
      email,
      policy,
    }),
  };
}
