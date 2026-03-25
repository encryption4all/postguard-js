import type { DecryptResult, SenderIdentity } from '../types.js';
import { DecryptionError, IdentityMismatchError } from '../errors.js';
import { fetchVerificationKey } from '../api/pkg.js';
import { downloadFile } from '../api/cryptify.js';
import { buildKeyRequest, retrieveUSKViaYivi } from '../yivi/decrypt-session.js';
import { readZipFilenames } from '../util/zip.js';
import { triggerBrowserDownload } from '../util/download.js';

export interface DecryptPipelineOptions {
  pkgUrl: string;
  cryptifyUrl: string;
  uuid: string;
  element: string;
  recipient?: string;
  signal?: AbortSignal;
}

/** Full decryption pipeline: download -> unseal -> collect -> ZIP parse */
export async function decryptPipeline(options: DecryptPipelineOptions): Promise<DecryptResult> {
  const { pkgUrl, cryptifyUrl, uuid, element, recipient, signal } = options;

  // Fetch verification key and download file in parallel
  const [vk, fileStream] = await Promise.all([
    fetchVerificationKey(pkgUrl),
    downloadFile(cryptifyUrl, uuid, signal),
  ]);

  // Create unsealer
  const { StreamUnsealer } = await import('@e4a/pg-wasm');
  const unsealer = await StreamUnsealer.new(fileStream, vk);

  // Inspect header to get policies
  const policies: Map<string, any> = unsealer.inspect_header();

  let senderIdentity: SenderIdentity | null = null;
  try {
    senderIdentity = unsealer.public_identity();
  } catch {
    // May not be available before unsealing
  }

  // Resolve which recipient key to use
  let key: string;
  if (recipient && policies.has(recipient)) {
    key = recipient;
  } else if (policies.size === 1) {
    key = policies.keys().next().value!;
  } else {
    // Return the available keys so the caller can choose
    const availableKeys = [...policies.keys()].filter((k) => k);
    throw new DecryptionError(
      `Multiple recipients found. Please specify one of: ${availableKeys.join(', ')}`
    );
  }

  // Build key request and get USK via Yivi
  const policy = policies.get(key);
  const keyRequest = buildKeyRequest(key, policy);
  const usk = await retrieveUSKViaYivi(pkgUrl, element, keyRequest, policy.ts);

  // Unseal
  const chunks: BlobPart[] = [];
  const writable = new WritableStream({
    write: (chunk) => {
      chunks.push(chunk as BlobPart);
    },
  });

  try {
    await unsealer.unseal(key, usk, writable);
  } catch (e) {
    throw new IdentityMismatchError();
  }

  if (!senderIdentity) {
    try {
      senderIdentity = unsealer.public_identity();
    } catch {
      // ignore
    }
  }

  const blob = new Blob(chunks, { type: 'application/zip' });
  const files = await readZipFilenames(blob);

  return {
    files,
    sender: senderIdentity,
    blob,
    download: (filename = 'files.zip') => triggerBrowserDownload(blob, filename),
  };
}
