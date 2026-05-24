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

    validateUploadOptions(opts);

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

const VALID_NOTIFY_KEYS = new Set(['recipients', 'sender', 'message', 'language']);
const VALID_UPLOAD_KEYS = new Set(['notify']);
const VALID_LANGUAGES: ReadonlySet<string> = new Set(['EN', 'NL']);

/** Catches the most common upload misconfigurations early with a clear
 *  error, before they silently degrade to "no notification email sent". */
function validateUploadOptions(opts: UploadOptions | undefined): void {
  if (opts === undefined) return;
  if (opts === null || typeof opts !== 'object' || Array.isArray(opts)) {
    throw new TypeError(
      `sealed.upload(opts) expects an object like { notify: { recipients: true } }, ` +
      `got ${describeValue(opts)}`
    );
  }

  for (const key of Object.keys(opts)) {
    if (!VALID_UPLOAD_KEYS.has(key)) {
      throw new TypeError(
        `sealed.upload(opts): unknown option "${key}". ` +
        `Did you mean to nest it under "notify"? Expected shape: ` +
        `{ notify: { recipients?: boolean, sender?: boolean, message?: string, language?: 'EN' | 'NL' } }`
      );
    }
  }

  const { notify } = opts;
  if (notify === undefined) return;
  if (notify === null || typeof notify !== 'object' || Array.isArray(notify)) {
    throw new TypeError(
      `sealed.upload({ notify }) expects an object like { recipients: true }, ` +
      `got ${describeValue(notify)}. ` +
      `(A plain boolean is a common mistake — use { recipients: true } to email recipients.)`
    );
  }

  const n = notify as Record<string, unknown>;
  for (const key of Object.keys(n)) {
    if (!VALID_NOTIFY_KEYS.has(key)) {
      throw new TypeError(
        `sealed.upload({ notify }): unknown key "${key}". ` +
        `Valid keys: recipients, sender, message, language.`
      );
    }
  }

  // Value-type checks — keep the validator's "fail fast with a clear
  // error" promise honest. `recipients: 'yes'` would otherwise be truthy
  // downstream and surprise the caller with a real notification email.
  if (n.recipients !== undefined && typeof n.recipients !== 'boolean') {
    throw new TypeError(
      `sealed.upload({ notify: { recipients } }) must be a boolean, got ${describeValue(n.recipients)}.`
    );
  }
  if (n.sender !== undefined && typeof n.sender !== 'boolean') {
    throw new TypeError(
      `sealed.upload({ notify: { sender } }) must be a boolean, got ${describeValue(n.sender)}.`
    );
  }
  if (n.message !== undefined && typeof n.message !== 'string') {
    throw new TypeError(
      `sealed.upload({ notify: { message } }) must be a string, got ${describeValue(n.message)}.`
    );
  }
  if (n.language !== undefined && (typeof n.language !== 'string' || !VALID_LANGUAGES.has(n.language))) {
    throw new TypeError(
      `sealed.upload({ notify: { language } }) must be 'EN' or 'NL', got ${describeValue(n.language)}.`
    );
  }
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return `string "${value}"`;
  return typeof value;
}
