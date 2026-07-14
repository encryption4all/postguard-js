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

  /** Resolve signing keys once and cache for subsequent calls. When the caller
   *  supplies pre-resolved keys (e.g. from pg.prepareSign()), use them directly
   *  and never start a Yivi session. */
  private async getSigningKeys(): Promise<SigningKeys> {
    if (this.options.signingKeys) return this.options.signingKeys;
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

    // Surface the silent-by-default behaviour once per PostGuard instance.
    // The most common "the SDK didn't send my email" support case is a
    // caller who didn't realise notify defaults to silent — TypeScript
    // can't catch it because `notify` is optional. Logged once (per
    // config) to avoid spamming long-running processes; suppress by
    // passing notify explicitly (true OR false counts as an explicit
    // choice).
    if (opts?.notify === undefined && !silentDefaultNoticed.has(this.config)) {
      silentDefaultNoticed.add(this.config);
      console.info(
        '[@e4a/pg-js] sealed.upload(): notify is unset — uploading silently ' +
        '(no recipient email sent). Pass { notify: { recipients: true } } to email ' +
        'recipients, or { notify: { recipients: false } } to make the silent intent ' +
        'explicit and suppress this notice.'
      );
    }

    // ReadableStream payloads can't be wrapped as a File for the upload
    // pipeline — refuse upfront rather than silently uploading zero bytes
    // and returning a UUID that points at empty ciphertext. toBytes()
    // accepts ReadableStream because it consumes the stream synchronously.
    if (this.options.data instanceof ReadableStream) {
      throw new TypeError(
        'sealed.upload() does not support data: ReadableStream — use toBytes() instead, ' +
        'or pass data as Uint8Array.'
      );
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
      onUploadInit: opts?.onUploadInit,
    });
  }

  private resolveFiles(): File[] {
    return resolveFiles(this.options);
  }
}

/** Normalise an EncryptInput's `files` or `data` into a File[] for the
 *  upload pipeline. Exported for unit tests; not part of the public SDK. */
export function resolveFiles(options: EncryptInput): File[] {
  if (options.files) {
    // FileList is browser-only — guard so Node/Bun/Deno don't throw
    // ReferenceError on the instanceof check.
    const isFileList =
      typeof FileList !== 'undefined' && options.files instanceof FileList;
    return isFileList
      ? Array.from(options.files as FileList)
      : (options.files as File[]);
  }
  if (options.data) {
    if (options.data instanceof ReadableStream) {
      throw new TypeError(
        'resolveFiles cannot wrap a ReadableStream payload — use toBytes() ' +
        'for streaming, or pass data as Uint8Array for upload().'
      );
    }
    // Wrap raw bytes as a synthetic file for the upload pipeline
    return [
      new File(
        [new Blob([options.data as BlobPart])],
        'data.bin',
        { type: 'application/octet-stream' }
      ),
    ];
  }
  throw new Error('Either files or data must be provided');
}

/** Tracks which PostGuard configs have already seen the silent-default
 *  notice, so a long-running process logs it once rather than on every
 *  upload. Keyed by config object so each `new PostGuard(...)` gets one
 *  chance to be told. */
const silentDefaultNoticed = new WeakSet<PostGuardConfig>();
