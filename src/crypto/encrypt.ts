import type { ISealOptions } from '@e4a/pg-wasm';
import type { Recipient, SignMethod, SigningKeys, UploadResult, YiviSign } from '../types.js';
import { fetchMPK } from '../api/pkg.js';
import { createUploadStream } from '../api/cryptify.js';
import { buildEncryptionPolicy } from '../recipients/builders.js';
import { DEFAULT_EMAIL_ATTRIBUTES, type EmailAttributes } from '../util/attributes.js';
import { resolveSigningKeys } from './signing.js';
import Chunker, { withTransform } from './chunker.js';
import { createZipReadable } from '../util/zip.js';
import { nowSeconds } from '../util/policy.js';
import { loadWasm } from '../util/wasm.js';
import type { RetryOptions } from '../util/retry.js';

const DEFAULT_UPLOAD_CHUNK_SIZE = 5_000_000;

export interface EncryptPipelineOptions {
  pkgUrl: string;
  cryptifyUrl: string;
  sign: SignMethod;
  files: File[];
  recipients: Recipient[];
  /** Email attribute types (see `PostGuardConfig.emailAttributes`). */
  emailAttributes?: EmailAttributes;
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
  /** Size (in bytes) of each chunk sent during upload. Defaults to 5 000 000 (5 MB). */
  uploadChunkSize?: number;
  delivery?: {
    /** Send a notification email to each recipient. Default false. */
    recipients?: boolean;
    /** Send a confirmation email to the sender. Default false. */
    sender?: boolean;
    message?: string;
    language?: 'EN' | 'NL';
  };
  headers?: HeadersInit;
  /** Pre-resolved signing keys (skips Yivi/API key resolution if provided) */
  signingKeys?: SigningKeys;
  /** Retry behaviour for chunk uploads. See PostGuardConfig.retry. */
  retry?: RetryOptions;
  /** Fires once, after `upload_init` succeeds and before any chunk PUT,
   *  with `{uuid, recoveryToken}`. See `UploadOptions.onUploadInit`. */
  onUploadInit?: (info: { uuid: string; recoveryToken: string }) => void;
}

/** Full encryption pipeline: sign -> policy -> ZIP -> seal -> upload */
export async function encryptPipeline(options: EncryptPipelineOptions): Promise<UploadResult> {
  const { pkgUrl, cryptifyUrl, sign, files, recipients, onProgress, signal, delivery, headers } = options;
  const emailAttrs = options.emailAttributes ?? DEFAULT_EMAIL_ATTRIBUTES;

  const abortController = new AbortController();
  const effectiveSignal = signal
    ? AbortSignal.any([signal, abortController.signal])
    : abortController.signal;

  // Fetch MPK and signing keys in parallel
  const [mpk, signingKeys] = await Promise.all([
    fetchMPK(pkgUrl, headers),
    options.signingKeys ?? resolveSigningKeys(pkgUrl, sign, headers, emailAttrs),
  ]);

  // Build encryption policy
  const ts = nowSeconds();
  const policy = buildEncryptionPolicy(recipients, ts, emailAttrs);

  // If the sign method requests including the sender, add a sender entry
  // so the sender can also decrypt the sealed file.
  if (sign.type === 'yivi' && (sign as YiviSign).includeSender && signingKeys.senderEmail) {
    policy[signingKeys.senderEmail] = {
      ts,
      con: [{ t: emailAttrs.email, v: signingKeys.senderEmail }],
    };
  }

  const sealOptions: ISealOptions = {
    policy,
    pubSignKey: signingKeys.pubSignKey as ISealOptions['pubSignKey'],
  };
  if (signingKeys.privSignKey) {
    sealOptions.privSignKey = signingKeys.privSignKey as ISealOptions['pubSignKey'];
  }

  // Load WASM
  const { sealStream } = await loadWasm();

  // Create ZIP stream from files
  const readable = await createZipReadable(files);

  // Set up upload stream with chunking
  const recipientEmails = recipients.map((r) => r.email).join(', ');
  const totalSize = files.reduce((a, f) => a + f.size, 0);

  // Forward the business API key (when signing via apiKey) to Cryptify so
  // the upload runs under the higher quota tier. Cryptify validates the
  // bearer against PKG; an unrecognised or missing key falls back to the
  // default 5 GB caps.
  const cryptifyApiKey = sign.type === 'apiKey' ? sign.apiKey : undefined;

  const uploadStream = createUploadStream(cryptifyUrl, {
    recipient: recipientEmails,
    mailContent: delivery?.message,
    mailLang: delivery?.language,
    confirm: delivery?.sender,
    notifyRecipients: delivery?.recipients,
    apiKey: cryptifyApiKey,
    abortSignal: effectiveSignal,
    retry: options.retry,
    headers,
    onUploadInit: options.onUploadInit,
    onProgress: (uploaded, last) => {
      if (onProgress) {
        const pct = totalSize > 0 ? Math.min(100, Math.round((uploaded / totalSize) * 100)) : 0;
        onProgress(last ? 100 : pct);
      }
    },
  });

  const uploadChunker = new Chunker(options.uploadChunkSize ?? DEFAULT_UPLOAD_CHUNK_SIZE);
  const { writable, pipeDone } = withTransform(uploadStream.writable, uploadChunker, effectiveSignal);

  // Encrypt: ZIP -> sealStream -> chunker -> upload
  //
  // sealStream and pipeDone are linked through the stream graph: when the
  // upload writable errors (Cryptify CORS failure, network error, abort)
  // the pipeTo rejects and that propagates back through the chunker so
  // sealStream's writes start failing too. We must observe BOTH promises,
  // otherwise the loser of the race surfaces as an unhandled rejection
  // alongside the legitimate caller-facing error. We also explicitly
  // abort the controller on the first failure so any in-flight fetch in
  // createUploadStream / pipeTo tears down rather than dangling. */
  await awaitAllOrAbort(
    sealStream(mpk, sealOptions, readable, writable),
    pipeDone,
    abortController
  );

  return { uuid: uploadStream.getUuid() };
}

/** Await two stream-pipeline promises, aborting on first failure and
 *  re-throwing the first error. The losers' eventual rejections are
 *  observed (`.catch(() => {})`) so they don't surface as unhandled. */
async function awaitAllOrAbort(
  seal: Promise<void>,
  pipe: Promise<void>,
  abortController: AbortController
): Promise<void> {
  let firstErr: unknown;
  const observed = (p: Promise<void>): Promise<void> =>
    p.catch((e) => {
      if (firstErr === undefined) {
        firstErr = e;
        try {
          abortController.abort(e);
        } catch {
          // Some environments throw if abort() is called with a reason
          // they don't understand; fall back to a parameterless abort.
          abortController.abort();
        }
      }
    });
  await Promise.all([observed(seal), observed(pipe)]);
  if (firstErr !== undefined) throw firstErr;
}

export interface SealRawOptions {
  pkgUrl: string;
  sign: SignMethod;
  recipients: Recipient[];
  data: Uint8Array | ReadableStream<Uint8Array>;
  headers?: HeadersInit;
  /** Pre-resolved signing keys (skips Yivi/API key resolution if provided) */
  signingKeys?: SigningKeys;
  /** Email attribute types (see `PostGuardConfig.emailAttributes`). */
  emailAttributes?: EmailAttributes;
}

/** Seal raw data: sign -> policy -> sealStream -> return encrypted bytes */
export async function sealRaw(options: SealRawOptions): Promise<Uint8Array> {
  const { pkgUrl, sign, recipients, data, headers } = options;
  const emailAttrs = options.emailAttributes ?? DEFAULT_EMAIL_ATTRIBUTES;

  // Fetch MPK and signing keys in parallel
  const [mpk, signingKeys] = await Promise.all([
    fetchMPK(pkgUrl, headers),
    options.signingKeys ?? resolveSigningKeys(pkgUrl, sign, headers, emailAttrs),
  ]);

  // Build encryption policy
  const ts = nowSeconds();
  const policy = buildEncryptionPolicy(recipients, ts, emailAttrs);

  // Include sender in policy if requested
  if (sign.type === 'yivi' && (sign as YiviSign).includeSender && signingKeys.senderEmail) {
    policy[signingKeys.senderEmail] = {
      ts,
      con: [{ t: emailAttrs.email, v: signingKeys.senderEmail }],
    };
  }

  const sealOptions: ISealOptions = {
    policy,
    pubSignKey: signingKeys.pubSignKey as ISealOptions['pubSignKey'],
  };
  if (signingKeys.privSignKey) {
    sealOptions.privSignKey = signingKeys.privSignKey as ISealOptions['pubSignKey'];
  }

  // Load WASM
  const { sealStream } = await loadWasm();

  // Create readable from input
  const readable = data instanceof ReadableStream
    ? data
    : new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

  // Collect encrypted output
  const chunks: Uint8Array[] = [];
  const writable = new WritableStream<Uint8Array>({
    write(chunk: Uint8Array) {
      chunks.push(chunk);
    },
  });

  await sealStream(mpk, sealOptions, readable, writable);

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const encrypted = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    encrypted.set(chunk, offset);
    offset += chunk.length;
  }
  return encrypted;
}
