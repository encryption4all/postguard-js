import type { DecryptFileResult, DecryptDataResult, SenderIdentity, SessionCallback, WasmModule } from '../types.js';
import { DecryptionError, IdentityMismatchError } from '../errors.js';
import { fetchVerificationKey } from '../api/pkg.js';
import { getUSK } from '../api/pkg.js';
import { downloadFile } from '../api/cryptify.js';
import { buildKeyRequest } from '../util/policy.js';
import { retrieveUSKViaYivi } from '../yivi/decrypt-session.js';
import { readZipFilenames } from '../util/zip.js';
import { triggerBrowserDownload } from '../util/download.js';

export interface DecryptFromUuidOptions {
  pkgUrl: string;
  cryptifyUrl: string;
  uuid: string;
  element?: string;
  session?: SessionCallback;
  recipient?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  wasm?: WasmModule;
}

/** Decrypt from Cryptify UUID: download -> unseal -> ZIP parse */
export async function decryptFromUuid(options: DecryptFromUuidOptions): Promise<DecryptFileResult> {
  const { pkgUrl, cryptifyUrl, uuid, element, session, recipient, signal, headers, wasm } = options;

  // Fetch verification key and download file in parallel
  const [vk, fileStream] = await Promise.all([
    fetchVerificationKey(pkgUrl, headers),
    downloadFile(cryptifyUrl, uuid, signal),
  ]);

  const { unsealer, key, senderIdentity: preUnsealSender } = await inspectAndResolveRecipient(
    fileStream, vk, recipient, wasm
  );

  // Get USK via Yivi or session callback
  const policy = (unsealer.inspect_header() as Map<string, any>).get(key);
  const usk = await resolveUSK(pkgUrl, key, policy, element, session, headers);

  // Unseal
  const chunks: BlobPart[] = [];
  const writable = new WritableStream({
    write: (chunk) => {
      chunks.push(chunk as BlobPart);
    },
  });

  let senderIdentity = preUnsealSender;
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

export interface DecryptFromDataOptions {
  pkgUrl: string;
  data: Uint8Array | ReadableStream<Uint8Array>;
  element?: string;
  session?: SessionCallback;
  recipient?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  wasm?: WasmModule;
}

/** Decrypt from raw data: unseal -> return plaintext bytes */
export async function decryptFromData(options: DecryptFromDataOptions): Promise<DecryptDataResult> {
  const { pkgUrl, data, element, session, recipient, headers, wasm } = options;

  const vk = await fetchVerificationKey(pkgUrl, headers);

  // Create readable from input
  const readable = data instanceof ReadableStream
    ? data
    : new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

  const { StreamUnsealer } = wasm ?? await import('@e4a/pg-wasm');
  const unsealer = await StreamUnsealer.new(readable, vk);

  // Inspect header to get policies
  const policies: Map<string, any> = unsealer.inspect_header();

  let senderIdentity: SenderIdentity | null = null;
  try {
    senderIdentity = unsealer.public_identity();
  } catch {
    // May not be available before unsealing
  }

  // Resolve which recipient key to use
  const key = resolveRecipientKey(policies, recipient);

  // Get USK
  const policy = policies.get(key);
  const usk = await resolveUSK(pkgUrl, key, policy, element, session, headers);

  // Unseal into bytes
  const chunks: Uint8Array[] = [];
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk);
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

  // Combine chunks
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const plaintext = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    plaintext.set(chunk, offset);
    offset += chunk.length;
  }

  return { plaintext, sender: senderIdentity };
}

// --- Helpers ---

function resolveRecipientKey(policies: Map<string, any>, recipient?: string): string {
  if (recipient && policies.has(recipient)) {
    return recipient;
  }
  if (policies.size === 1) {
    return policies.keys().next().value!;
  }
  const availableKeys = [...policies.keys()].filter((k) => k);
  throw new DecryptionError(
    `Multiple recipients found. Please specify one of: ${availableKeys.join(', ')}`
  );
}

async function inspectAndResolveRecipient(
  fileStream: ReadableStream<Uint8Array>,
  vk: unknown,
  recipient?: string,
  wasm?: WasmModule
): Promise<{ unsealer: any; key: string; senderIdentity: SenderIdentity | null }> {
  const { StreamUnsealer } = wasm ?? await import('@e4a/pg-wasm');
  const unsealer = await StreamUnsealer.new(fileStream, vk);
  const policies: Map<string, any> = unsealer.inspect_header();

  let senderIdentity: SenderIdentity | null = null;
  try {
    senderIdentity = unsealer.public_identity();
  } catch {
    // ignore
  }

  const key = resolveRecipientKey(policies, recipient);
  return { unsealer, key, senderIdentity };
}

async function resolveUSK(
  pkgUrl: string,
  recipientKey: string,
  policy: { ts: number; con: { t: string; v?: string }[] },
  element?: string,
  session?: SessionCallback,
  headers?: HeadersInit
): Promise<unknown> {
  const keyRequest = buildKeyRequest(recipientKey, policy);

  if (session) {
    // Custom session callback (email addons, etc.)
    const jwt = await session({
      con: keyRequest.con,
      sort: 'Decryption',
      hints: policy.con.map((c) => {
        if (c.t === 'pbdf.sidn-pbdf.email.email') return { t: c.t, v: recipientKey };
        return c;
      }),
    });
    return getUSK(pkgUrl, jwt, policy.ts, headers);
  }

  if (element) {
    // Yivi web session
    return retrieveUSKViaYivi(pkgUrl, element, keyRequest, policy.ts);
  }

  throw new DecryptionError('Either element or session callback must be provided for decryption.');
}
