import type { PostGuardConfig, EncryptInput, SigningKeys, UploadOptions, UploadResult } from './types.js';
import { sealRaw } from './crypto/encrypt.js';
import { encryptPipeline } from './crypto/encrypt.js';
import { createZipReadable } from './util/zip.js';
import { resolveSigningKeys } from './crypto/signing.js';

/** Lazy encryption builder. Nothing executes until a terminal method is called. */
export class Sealed {
  private cachedSigningKeys?: SigningKeys;

  /** @internal */
  constructor(
    private readonly config: PostGuardConfig,
    private readonly options: EncryptInput,
  ) {}

  /** Was this Sealed built from raw `data` (typically an RFC 5322 MIME
   *  envelope) or from a list of `files`? Consumers like createEnvelope
   *  use this to pick the right recipient-side route — `data` mode wants
   *  a MIME-aware page (`/decrypt?uuid=…`) and `files` mode wants the
   *  file-list page (`/download?uuid=…`). */
  get mode(): 'data' | 'files' {
    return this.options.data !== undefined ? 'data' : 'files';
  }

  /** True if this Sealed has a cryptifyUrl configured and can be uploaded. */
  get canUpload(): boolean {
    return !!this.config.cryptifyUrl;
  }

  /** Resolve signing keys once and cache for subsequent calls. */
  private async getSigningKeys(): Promise<SigningKeys> {
    if (!this.cachedSigningKeys) {
      this.cachedSigningKeys = await resolveSigningKeys(
        this.config.pkgUrl,
        this.options.sign,
        this.config.headers,
      );
    }
    return this.cachedSigningKeys;
  }

  /** Encrypt and return raw bytes (buffers entire result in memory). */
  async toBytes(): Promise<Uint8Array> {
    const { recipients, sign } = this.options;
    const signingKeys = await this.getSigningKeys();

    if (this.options.data) {
      // Raw data — seal directly, no ZIP
      return sealRaw({
        pkgUrl: this.config.pkgUrl,
        sign,
        recipients,
        data: this.options.data,
        headers: this.config.headers,
        signingKeys,
      });
    }

    // Files — zip first, then seal
    const files = this.resolveFiles();
    const zipReadable = await createZipReadable(files);
    return sealRaw({
      pkgUrl: this.config.pkgUrl,
      sign,
      recipients,
      data: zipReadable,
      headers: this.config.headers,
      signingKeys,
    });
  }

  /** Encrypt and upload to Cryptify (streams internally for efficiency).
   *  Silent by default — pass `notify.recipients = true` to have
   *  Cryptify email each recipient a download link, and/or
   *  `notify.sender = true` for a confirmation back to the sender.
   *  `notify.message` adds an optional unencrypted body shared by both
   *  mails. */
  async upload(opts?: UploadOptions): Promise<UploadResult> {
    if (!this.config.cryptifyUrl) {
      throw new Error('cryptifyUrl is required for upload');
    }

    const { recipients, sign, onProgress, signal } = this.options;
    const signingKeys = await this.getSigningKeys();
    const files = this.resolveFiles();

    return encryptPipeline({
      pkgUrl: this.config.pkgUrl,
      cryptifyUrl: this.config.cryptifyUrl,
      sign,
      files,
      recipients,
      onProgress,
      signal,
      uploadChunkSize: this.config.uploadChunkSize,
      delivery: opts?.notify,
      headers: this.config.headers,
      signingKeys,
      retry: this.config.retry,
    });
  }

  private resolveFiles(): File[] {
    if (this.options.files) {
      return this.options.files instanceof FileList
        ? Array.from(this.options.files)
        : this.options.files;
    }
    if (this.options.data) {
      // Wrap raw data as a synthetic file for the upload pipeline
      const data = this.options.data instanceof ReadableStream
        ? new Blob([]) // ReadableStream can't be wrapped in File — toBytes should be used instead
        : new Blob([this.options.data as BlobPart]);
      return [new File([data], 'data.bin', { type: 'application/octet-stream' })];
    }
    throw new Error('Either files or data must be provided');
  }
}
