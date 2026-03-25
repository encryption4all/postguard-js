import type { ISealOptions } from '@e4a/pg-wasm';
import type { Recipient, SignMethod, SigningKeys, UploadResult } from '../types.js';
import { fetchMPK } from '../api/pkg.js';
import { createUploadStream } from '../api/cryptify.js';
import { buildEncryptionPolicy } from '../recipients/builders.js';
import { resolveSigningKeysFromApiKey } from '../signing/api-key.js';
import { resolveSigningKeysFromYivi } from '../signing/yivi.js';
import Chunker, { withTransform } from './chunker.js';
import { createZipReadable } from '../util/zip.js';

const UPLOAD_CHUNK_SIZE = 1024 * 1024;

async function resolveSigningKeys(
  pkgUrl: string,
  sign: SignMethod
): Promise<SigningKeys> {
  switch (sign.type) {
    case 'apiKey':
      return resolveSigningKeysFromApiKey(pkgUrl, sign.apiKey);
    case 'yivi':
      return resolveSigningKeysFromYivi(pkgUrl, {
        element: sign.element,
        senderEmail: sign.senderEmail,
        includeSender: sign.includeSender,
      });
  }
}

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
}

/** Full encryption pipeline: sign -> policy -> ZIP -> seal -> upload */
export async function encryptPipeline(options: EncryptPipelineOptions): Promise<UploadResult> {
  const { pkgUrl, cryptifyUrl, sign, files, recipients, onProgress, signal, delivery } = options;

  const abortController = new AbortController();
  const effectiveSignal = signal
    ? AbortSignal.any([signal, abortController.signal])
    : abortController.signal;

  // Fetch MPK and signing keys in parallel
  const [mpk, signingKeys] = await Promise.all([
    fetchMPK(pkgUrl),
    resolveSigningKeys(pkgUrl, sign),
  ]);

  // Build encryption policy
  const ts = Math.round(Date.now() / 1000);
  const policy = buildEncryptionPolicy(recipients, ts);

  const sealOptions: ISealOptions = {
    policy,
    pubSignKey: signingKeys.pubSignKey as ISealOptions['pubSignKey'],
  };
  if (signingKeys.privSignKey) {
    sealOptions.privSignKey = signingKeys.privSignKey as ISealOptions['pubSignKey'];
  }

  // Dynamic imports for WASM
  const { sealStream } = await import('@e4a/pg-wasm');

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

  // Encrypt: ZIP -> sealStream -> chunker -> upload
  await sealStream(
    mpk,
    sealOptions,
    readable,
    withTransform(uploadStream.writable, uploadChunker, effectiveSignal)
  );

  return { uuid: uploadStream.getUuid() };
}
