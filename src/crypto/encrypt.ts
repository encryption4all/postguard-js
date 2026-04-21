import type { ISealOptions } from '@e4a/pg-wasm';
import type { Recipient, SignMethod, SigningKeys, UploadResult, YiviSign } from '../types.js';
import { fetchMPK } from '../api/pkg.js';
import { createUploadStream } from '../api/cryptify.js';
import { buildEncryptionPolicy } from '../recipients/builders.js';
import { resolveSigningKeys } from './signing.js';
import Chunker, { withTransform } from './chunker.js';
import { createZipReadable } from '../util/zip.js';
import { loadWasm } from '../util/wasm.js';

const UPLOAD_CHUNK_SIZE = 1024 * 1024;

export interface EncryptPipelineOptions {
  pkgUrl: string;
  cryptifyUrl: string;
  sign: SignMethod;
  files: File[];
  recipients: Recipient[];
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
  delivery?: {
    message?: string;
    language?: 'EN' | 'NL';
    confirmToSender?: boolean;
  };
  headers?: HeadersInit;
  /** Pre-resolved signing keys (skips Yivi/API key resolution if provided) */
  signingKeys?: SigningKeys;
}

/** Full encryption pipeline: sign -> policy -> ZIP -> seal -> upload */
export async function encryptPipeline(options: EncryptPipelineOptions): Promise<UploadResult> {
  const { pkgUrl, cryptifyUrl, sign, files, recipients, onProgress, signal, delivery, headers } = options;

  const abortController = new AbortController();
  const effectiveSignal = signal
    ? AbortSignal.any([signal, abortController.signal])
    : abortController.signal;

  // Fetch MPK and signing keys in parallel
  const [mpk, signingKeys] = await Promise.all([
    fetchMPK(pkgUrl, headers),
    options.signingKeys ?? resolveSigningKeys(pkgUrl, sign, headers),
  ]);

  // Build encryption policy
  const ts = Math.round(Date.now() / 1000);
  const policy = buildEncryptionPolicy(recipients, ts);

  // If the sign method requests including the sender, add a sender entry
  // so the sender can also decrypt the sealed file.
  if (sign.type === 'yivi' && (sign as YiviSign).includeSender && signingKeys.senderEmail) {
    policy[signingKeys.senderEmail] = {
      ts,
      con: [{ t: 'pbdf.sidn-pbdf.email.email', v: signingKeys.senderEmail }],
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

  const uploadStream = createUploadStream(cryptifyUrl, {
    recipient: recipientEmails,
    mailContent: delivery?.message,
    mailLang: delivery?.language,
    confirm: delivery?.confirmToSender,
    abortSignal: effectiveSignal,
    onProgress: (uploaded, last) => {
      if (onProgress) {
        const pct = totalSize > 0 ? Math.min(100, Math.round((uploaded / totalSize) * 100)) : 0;
        onProgress(last ? 100 : pct);
      }
    },
  });

  const uploadChunker = new Chunker(UPLOAD_CHUNK_SIZE);
  const { writable, pipeDone } = withTransform(uploadStream.writable, uploadChunker, effectiveSignal);

  // Encrypt: ZIP -> sealStream -> chunker -> upload
  await sealStream(mpk, sealOptions, readable, writable);
  await pipeDone;

  return { uuid: uploadStream.getUuid() };
}

export interface SealRawOptions {
  pkgUrl: string;
  sign: SignMethod;
  recipients: Recipient[];
  data: Uint8Array | ReadableStream<Uint8Array>;
  headers?: HeadersInit;
  /** Pre-resolved signing keys (skips Yivi/API key resolution if provided) */
  signingKeys?: SigningKeys;
}

/** Seal raw data: sign -> policy -> sealStream -> return encrypted bytes */
export async function sealRaw(options: SealRawOptions): Promise<Uint8Array> {
  const { pkgUrl, sign, recipients, data, headers } = options;

  // Fetch MPK and signing keys in parallel
  const [mpk, signingKeys] = await Promise.all([
    fetchMPK(pkgUrl, headers),
    options.signingKeys ?? resolveSigningKeys(pkgUrl, sign, headers),
  ]);

  // Build encryption policy
  const ts = Math.round(Date.now() / 1000);
  const policy = buildEncryptionPolicy(recipients, ts);

  // Include sender in policy if requested
  if (sign.type === 'yivi' && (sign as YiviSign).includeSender && signingKeys.senderEmail) {
    policy[signingKeys.senderEmail] = {
      ts,
      con: [{ t: 'pbdf.sidn-pbdf.email.email', v: signingKeys.senderEmail }],
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
  let encrypted = new Uint8Array(0);
  const writable = new WritableStream<Uint8Array>({
    write(chunk: Uint8Array) {
      const combined = new Uint8Array(encrypted.length + chunk.length);
      combined.set(encrypted);
      combined.set(chunk, encrypted.length);
      encrypted = combined;
    },
  });

  await sealStream(mpk, sealOptions, readable, writable);

  return encrypted;
}
