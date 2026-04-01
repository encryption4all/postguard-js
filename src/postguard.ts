import type {
  PostGuardConfig,
  EmailRecipient,
  EmailDomainRecipient,
  CustomPolicyRecipient,
  ApiKeySign,
  YiviSign,
  SessionSign,
  SessionCallback,
  EncryptAndUploadOptions,
  EncryptAndDeliverOptions,
  EncryptOptions,
  DecryptOptions,
  DecryptUuidOptions,
  DecryptDataOptions,
  DecryptFileResult,
  DecryptDataResult,
  UploadResult,
} from './types.js';
import { encryptPipeline } from './crypto/encrypt.js';
import { sealRaw } from './crypto/encrypt.js';
import { decryptFromUuid, decryptFromData } from './crypto/decrypt.js';
import { EmailHelpers } from './email/index.js';

export class PostGuard {
  private readonly config: PostGuardConfig;

  /** Email helpers for building/parsing PostGuard-encrypted emails */
  readonly email = new EmailHelpers();

  constructor(config: PostGuardConfig) {
    this.config = config;
  }

  /** Signing method builders */
  readonly sign = {
    apiKey: (apiKey: string): ApiKeySign => ({
      type: 'apiKey',
      apiKey,
    }),
    yivi: (opts: { element: string; senderEmail: string; includeSender?: boolean }): YiviSign => ({
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

  /** Encrypt raw data and return encrypted bytes (no upload) */
  async encrypt(options: EncryptOptions): Promise<Uint8Array> {
    return sealRaw({
      pkgUrl: this.config.pkgUrl,
      sign: options.sign,
      recipients: options.recipients,
      data: options.data,
      headers: this.config.headers,
    });
  }

  /** Encrypt files and upload (no email delivery) */
  async encryptAndUpload(options: EncryptAndUploadOptions): Promise<UploadResult> {
    if (!this.config.cryptifyUrl) {
      throw new Error('cryptifyUrl is required for encryptAndUpload');
    }
    const files = options.files instanceof FileList ? Array.from(options.files) : options.files;

    return encryptPipeline({
      pkgUrl: this.config.pkgUrl,
      cryptifyUrl: this.config.cryptifyUrl,
      sign: options.sign,
      files,
      recipients: options.recipients,
      onProgress: options.onProgress,
      signal: options.signal,
      headers: this.config.headers,
    });
  }

  /** Encrypt files, upload, and have Cryptify send email notifications */
  async encryptAndDeliver(options: EncryptAndDeliverOptions): Promise<UploadResult> {
    if (!this.config.cryptifyUrl) {
      throw new Error('cryptifyUrl is required for encryptAndDeliver');
    }
    const files = options.files instanceof FileList ? Array.from(options.files) : options.files;

    return encryptPipeline({
      pkgUrl: this.config.pkgUrl,
      cryptifyUrl: this.config.cryptifyUrl,
      sign: options.sign,
      files,
      recipients: options.recipients,
      onProgress: options.onProgress,
      signal: options.signal,
      delivery: options.delivery,
      headers: this.config.headers,
    });
  }

  /** Decrypt from a Cryptify UUID or raw data */
  async decrypt(options: DecryptOptions): Promise<DecryptFileResult | DecryptDataResult> {
    if ('uuid' in options) {
      return this.decryptFromUuid(options);
    }
    return this.decryptFromData(options);
  }

  private async decryptFromUuid(options: DecryptUuidOptions): Promise<DecryptFileResult> {
    if (!this.config.cryptifyUrl) {
      throw new Error('cryptifyUrl is required for decrypt with uuid');
    }
    return decryptFromUuid({
      pkgUrl: this.config.pkgUrl,
      cryptifyUrl: this.config.cryptifyUrl,
      uuid: options.uuid,
      element: options.element,
      session: options.session,
      recipient: options.recipient,
      signal: options.signal,
      headers: this.config.headers,
    });
  }

  private async decryptFromData(options: DecryptDataOptions): Promise<DecryptDataResult> {
    return decryptFromData({
      pkgUrl: this.config.pkgUrl,
      data: options.data,
      element: options.element,
      session: options.session,
      recipient: options.recipient,
      signal: options.signal,
      headers: this.config.headers,
    });
  }
}
