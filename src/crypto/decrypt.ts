import type { DecryptFileResult, DecryptDataResult, SenderIdentity, SessionCallback } from '../types.js';
import { DecryptionError, IdentityMismatchError } from '../errors.js';
import { fetchVerificationKey } from '../api/pkg.js';
import { getUSK } from '../api/pkg.js';
import { downloadFile, downloadFileWithRetry } from '../api/cryptify.js';
import { resolveRetryOptions, type RetryOptions } from '../util/retry.js';
import { buildKeyRequest } from '../util/policy.js';
import { retrieveUSKViaYivi } from '../yivi/decrypt-session.js';
import { extractAllZipEntries } from '../util/zip.js';
import { triggerBrowserDownloads } from '../util/download.js';
import { loadWasm } from '../util/wasm.js';
import { parseSender } from '../util/identity.js';
import { ProgressPipe } from '../util/progress.js';

// --- Inspect (shared by Opened and legacy functions) ---

export interface InspectSealedOptions {
  pkgUrl: string;
  cryptifyUrl?: string;
  uuid?: string;
  data?: Uint8Array | ReadableStream<Uint8Array>;
  signal?: AbortSignal;
  headers?: HeadersInit;
  retry?: RetryOptions;
}

export interface InspectSealedResult {
  unsealer: any;
  policies: Map<string, any>;
  sender: SenderIdentity | null;
  /** Progress tracker for the underlying download stream. Null when
   *  decrypting from raw data (no network involved). Callers attach
   *  their progress callback via `pipe.setCallback()` before consuming
   *  the stream. */
  pipe: ProgressPipe | null;
}

/** Inspect a sealed file/data without decrypting. Returns unsealer + metadata. */
export async function inspectSealed(options: InspectSealedOptions): Promise<InspectSealedResult> {
  const { pkgUrl, cryptifyUrl, uuid, data, signal, headers } = options;

  // Get the readable stream (either from Cryptify or raw data)
  let readable: ReadableStream<Uint8Array>;
  let vkPromise: Promise<unknown>;
  let pipe: ProgressPipe | null = null;

  if (uuid && cryptifyUrl) {
    // Kick off VK fetch and download stream setup in parallel. The
    // ReadableStream returned by downloadFileWithRetry is lazy — the
    // first HTTP GET happens when the stream is read, not here.
    const retry = resolveRetryOptions(options.retry);
    vkPromise = fetchVerificationKey(pkgUrl, headers);
    const { stream: fileStream, pipe: streamPipe } = downloadFileWithRetry(
      cryptifyUrl,
      uuid,
      retry,
      signal,
      headers,
    );
    readable = fileStream;
    pipe = streamPipe;
  } else if (data) {
    readable = data instanceof ReadableStream
      ? data
      : new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(data);
            controller.close();
          },
        });
    vkPromise = fetchVerificationKey(pkgUrl, headers);
  } else {
    throw new DecryptionError('Either uuid or data must be provided.');
  }

  const vk = await vkPromise;
  const { StreamUnsealer } = await loadWasm();
  const unsealer = await StreamUnsealer.new(readable, vk);

  const policies: Map<string, any> = unsealer.inspect_header();

  let sender: SenderIdentity | null = null;
  try {
    sender = unsealer.public_identity();
  } catch {
    // May not be available before unsealing
  }

  return { unsealer, policies, sender, pipe };
}

// --- Unseal helpers (shared by Opened and legacy functions) ---

export function resolveRecipientKey(policies: Map<string, any>, recipient?: string): string {
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

export async function resolveUSK(
  pkgUrl: string,
  recipientKey: string,
  policy: { ts: number; con: { t: string; v?: string }[] },
  element?: string,
  session?: SessionCallback,
  headers?: HeadersInit,
  enableCache?: boolean
): Promise<unknown> {
  const keyRequest = buildKeyRequest(recipientKey, policy);

  if (session) {
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
    return retrieveUSKViaYivi(pkgUrl, element, keyRequest, policy.ts, enableCache, recipientKey);
  }

  throw new DecryptionError('Either element or session callback must be provided for decryption.');
}

/** Unseal and collect output, returning sender identity */
export async function unsealAndCollect(
  unsealer: any,
  key: string,
  usk: unknown,
  preUnsealSender: SenderIdentity | null,
): Promise<{ chunks: Uint8Array[]; sender: SenderIdentity | null }> {
  const chunks: Uint8Array[] = [];
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk);
    },
  });

  let verified: SenderIdentity | undefined;
  try {
    verified = (await unsealer.unseal(key, usk, writable)) as SenderIdentity | undefined;
  } catch (e) {
    // AbortError signals user/caller-driven cancellation — surface it as-is
    // so callers can distinguish it from a real identity mismatch.
    if (e instanceof Error && e.name === 'AbortError') throw e;
    // Other failures (real identity mismatch, network drop during streaming,
    // WASM panic) all surface here without a stable shape we can discriminate
    // on. Preserve the original via `cause` so callers can inspect it.
    throw new IdentityMismatchError({ cause: e });
  }

  let sender: SenderIdentity | null = verified ?? preUnsealSender;
  if (!sender) {
    try {
      sender = unsealer.public_identity();
    } catch {
      // ignore
    }
  }

  return { chunks, sender };
}

// --- Legacy top-level functions (used internally by Sealed/Opened) ---

export interface DecryptFromUuidOptions {
  pkgUrl: string;
  cryptifyUrl: string;
  uuid: string;
  element?: string;
  session?: SessionCallback;
  recipient?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

/** Decrypt from Cryptify UUID: download -> unseal -> ZIP parse */
export async function decryptFromUuid(options: DecryptFromUuidOptions): Promise<DecryptFileResult> {
  const { pkgUrl, cryptifyUrl, uuid, element, session, recipient, signal, headers } = options;

  const { unsealer, policies, sender: preUnsealSender } = await inspectSealed({
    pkgUrl, cryptifyUrl, uuid, signal, headers,
  });

  const key = resolveRecipientKey(policies, recipient);
  const policy = policies.get(key);
  const usk = await resolveUSK(pkgUrl, key, policy, element, session, headers);

  const { chunks, sender } = await unsealAndCollect(unsealer, key, usk, preUnsealSender);

  const zipBlob = new Blob(chunks as BlobPart[], { type: 'application/zip' });
  const extractedFiles = await extractAllZipEntries(zipBlob);

  return {
    files: extractedFiles,
    blob: zipBlob,
    sender: parseSender(sender),
    download: () => triggerBrowserDownloads(extractedFiles),
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
}

/** Decrypt from raw data: unseal -> return plaintext bytes */
export async function decryptFromData(options: DecryptFromDataOptions): Promise<DecryptDataResult> {
  const { pkgUrl, data, element, session, recipient, headers } = options;

  const { unsealer, policies, sender: preUnsealSender } = await inspectSealed({
    pkgUrl, data, headers,
  });

  const key = resolveRecipientKey(policies, recipient);
  const policy = policies.get(key);
  const usk = await resolveUSK(pkgUrl, key, policy, element, session, headers);

  const { chunks, sender } = await unsealAndCollect(unsealer, key, usk, preUnsealSender);

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const plaintext = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    plaintext.set(chunk, offset);
    offset += chunk.length;
  }

  return { plaintext, sender: parseSender(sender) };
}
