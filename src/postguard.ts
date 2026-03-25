import type {
  PostGuardConfig,
  EmailRecipient,
  EmailDomainRecipient,
  ApiKeySign,
  YiviSign,
  EncryptAndUploadOptions,
  EncryptAndDeliverOptions,
  DecryptOptions,
  DecryptResult,
  UploadResult,
} from './types.js';
import { encryptPipeline } from './crypto/encrypt.js';
import { decryptPipeline } from './crypto/decrypt.js';

export class PostGuard {
  private readonly config: PostGuardConfig;

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
  };

  /** Encrypt files and upload (no email delivery) */
  async encryptAndUpload(options: EncryptAndUploadOptions): Promise<UploadResult> {
    const files = options.files instanceof FileList ? Array.from(options.files) : options.files;

    return encryptPipeline({
      pkgUrl: this.config.pkgUrl,
      cryptifyUrl: this.config.cryptifyUrl,
      sign: options.sign,
      files,
      recipients: options.recipients,
      onProgress: options.onProgress,
      signal: options.signal,
    });
  }

  /** Encrypt files, upload, and have Cryptify send email notifications */
  async encryptAndDeliver(options: EncryptAndDeliverOptions): Promise<UploadResult> {
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
    });
  }

  /** Decrypt a file by UUID (always uses Yivi) */
  async decrypt(options: DecryptOptions): Promise<DecryptResult> {
    return decryptPipeline({
      pkgUrl: this.config.pkgUrl,
      cryptifyUrl: this.config.cryptifyUrl,
      uuid: options.uuid,
      element: options.element,
      recipient: options.recipient,
      signal: options.signal,
    });
  }
}
