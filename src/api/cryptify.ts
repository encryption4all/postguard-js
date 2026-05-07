import { NetworkError, UploadSessionExpiredError } from '../errors.js';
import {
  resolveRetryOptions,
  withRetry,
  withTimeout,
  type ResolvedRetryOptions,
  type RetryOptions,
} from '../util/retry.js';

interface FileState {
  /** Current rolling token — what the next chunk PUT should send. */
  token: string;
  /**
   * Token sent on the most recent chunk PUT (i.e., the value of `token`
   * before that PUT advanced it). On a retry whose response was lost,
   * the caller resends with this value so cryptify's idempotent-retry
   * path replays the cached response. `undefined` until at least one
   * chunk has been committed.
   */
  prevToken?: string;
  uuid: string;
}

export interface InitUploadOptions {
  recipient: string;
  mailContent?: string;
  mailLang?: 'EN' | 'NL';
  /** Send a confirmation email to the sender. Default false. Maps to
   *  the wire-level `confirm` field. */
  confirm?: boolean;
  /** Send a notification email to each recipient. Default false in the
   *  SDK (overrides Cryptify's server-side default of true for clients
   *  that don't send the field, so callers get a silent upload by
   *  default). Requires cryptify ≥ the release that added the
   *  `notifyRecipients` field; older servers ignore it and continue to
   *  email recipients. */
  notifyRecipients?: boolean;
  /** PostGuard for Business API key (`PG-…`). When set, sent to Cryptify
   *  as `Authorization: Bearer <apiKey>` on every upload request. Cryptify
   *  forwards the bearer to PKG's `/v2/api-key/validate`; a validated key
   *  unlocks the higher upload-quota tier (100 GB/upload + 100 GB rolling
   *  vs. the default 5 GB caps). */
  apiKey?: string;
  signal?: AbortSignal;
}

function bearerHeader(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

/** Cryptify's `upload_session_not_found` error code in the structured 404 body. */
const UPLOAD_SESSION_NOT_FOUND_ERROR = 'upload_session_not_found';

/**
 * Inspect a 404 response body. If it's the structured
 * `upload_session_not_found` JSON cryptify started returning, throw the
 * dedicated error so retry policies can short-circuit. Otherwise fall
 * through to a plain NetworkError.
 */
function throwSessionExpiredOrNetworkError(message: string, status: number, body: string, uuid: string): never {
  if (status === 404) {
    try {
      const parsed = JSON.parse(body) as { error?: string; reason?: string; uuid?: string };
      if (parsed.error === UPLOAD_SESSION_NOT_FOUND_ERROR) {
        throw new UploadSessionExpiredError(parsed.uuid ?? uuid, parsed.reason ?? 'unknown', body);
      }
    } catch (e) {
      if (e instanceof UploadSessionExpiredError) throw e;
      // JSON parse failure or other — fall through to NetworkError below.
    }
  }
  throw new NetworkError(message, status, body);
}

/** Initialize a file upload, returns token and uuid */
export async function initUpload(
  cryptifyUrl: string,
  options: InitUploadOptions
): Promise<FileState> {
  const response = await fetch(`${cryptifyUrl}/fileupload/init`, {
    signal: options.signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...bearerHeader(options.apiKey),
    },
    body: JSON.stringify({
      confirm: options.confirm ?? false,
      recipient: options.recipient,
      mailContent: options.mailContent ?? '',
      mailLang: options.mailLang ?? 'EN',
      // Always send the field so older Cryptify deployments (default
      // notifyRecipients: true) get explicitly overridden to the SDK's
      // silent-by-default semantics.
      notifyRecipients: options.notifyRecipients ?? false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error initializing file upload`, response.status, body);
  }

  const resJson = await response.json();
  const token = response.headers.get('cryptifytoken') as string;
  return { token, uuid: resJson['uuid'] };
}

/**
 * Upload a single chunk.
 *
 * On retry callers should pass the *previous* token (in `prevToken`) so
 * that cryptify's idempotent-retry path can recognise a duplicate of the
 * just-committed chunk. The first attempt sends `state.token`; subsequent
 * attempts send `state.prevToken ?? state.token` to cover the case where
 * the previous response was lost in flight.
 */
export async function storeChunk(
  cryptifyUrl: string,
  state: FileState,
  chunk: Uint8Array,
  offset: number,
  signal?: AbortSignal,
  apiKey?: string
): Promise<FileState> {
  const response = await fetch(`${cryptifyUrl}/fileupload/${state.uuid}`, {
    signal,
    method: 'PUT',
    headers: {
      cryptifytoken: state.token,
      'Content-Type': 'application/octet-stream',
      'content-range': `bytes ${offset}-${offset + chunk.length}/*`,
      ...bearerHeader(apiKey),
    },
    body: new Blob([chunk as BlobPart]),
  });

  if (!response.ok) {
    const body = await response.text();
    throwSessionExpiredOrNetworkError(`Error uploading chunk`, response.status, body, state.uuid);
  }

  const token = response.headers.get('cryptifytoken') as string;
  return { token, uuid: state.uuid, prevToken: state.token };
}

/**
 * Upload a chunk with retry on transient failures. On retry the *previous*
 * token is sent so cryptify can detect this as a duplicate of the
 * just-committed chunk and replay the cached response without re-writing
 * or double-counting against quotas. See cryptify's idempotent-retry
 * contract on `PUT /fileupload/{uuid}`.
 */
export async function storeChunkWithRetry(
  cryptifyUrl: string,
  state: FileState,
  chunk: Uint8Array,
  offset: number,
  retry: ResolvedRetryOptions,
  signal?: AbortSignal,
  apiKey?: string
): Promise<FileState> {
  return withRetry(
    async (attempt) => {
      const tokenForThisAttempt = attempt === 1 ? state.token : (state.prevToken ?? state.token);
      const stateForAttempt: FileState = { ...state, token: tokenForThisAttempt };
      const { signal: timed, cleanup } = withTimeout(signal, retry.chunkTimeoutMs);
      try {
        return await storeChunk(cryptifyUrl, stateForAttempt, chunk, offset, timed, apiKey);
      } finally {
        cleanup();
      }
    },
    retry,
    undefined,
    signal
  );
}

/** Finalize the upload */
export async function finalizeUpload(
  cryptifyUrl: string,
  state: FileState,
  size: number,
  signal?: AbortSignal,
  apiKey?: string
): Promise<void> {
  const response = await fetch(`${cryptifyUrl}/fileupload/finalize/${state.uuid}`, {
    signal,
    method: 'POST',
    headers: {
      cryptifytoken: state.token,
      'content-range': `bytes */${size}`,
      ...bearerHeader(apiKey),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throwSessionExpiredOrNetworkError(`Error finalizing upload`, response.status, body, state.uuid);
  }
}

/** Download an encrypted file as a ReadableStream */
export async function downloadFile(
  cryptifyUrl: string,
  uuid: string,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${cryptifyUrl}/filedownload/${uuid}`, {
    signal,
    method: 'GET',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error downloading file`, response.status, body);
  }

  if (!response.body) throw new Error('Response body is null');
  return response.body as ReadableStream<Uint8Array>;
}

/**
 * Download with retry on transient failures. Cryptify's `FileServer`
 * already supports HTTP Range requests, so this could be extended to
 * resume mid-stream — that's tracked separately. Today the retry simply
 * re-issues the GET on transient failure.
 */
export async function downloadFileWithRetry(
  cryptifyUrl: string,
  uuid: string,
  retry: ResolvedRetryOptions,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  return withRetry(
    async () => {
      const { signal: timed, cleanup } = withTimeout(signal, retry.downloadTimeoutMs);
      try {
        return await downloadFile(cryptifyUrl, uuid, timed);
      } finally {
        // Note: downloadFile returns a stream that is read *after* this
        // function returns, so a per-attempt timeout that aborts the
        // stream mid-read would surface as a stream error. We only
        // bound the GET handshake here; if downloadTimeoutMs is 0 (the
        // default) cleanup is a no-op.
        cleanup();
      }
    },
    retry,
    undefined,
    signal
  );
}

export interface UploadStream {
  writable: WritableStream<Uint8Array>;
  getUuid: () => string;
}

/** Create a WritableStream that uploads chunks to Cryptify, exposing the UUID */
export function createUploadStream(
  cryptifyUrl: string,
  options: InitUploadOptions & {
    onProgress?: (uploaded: number, last: boolean) => void;
    abortSignal?: AbortSignal;
    retry?: RetryOptions;
  }
): UploadStream {
  let state: FileState = { token: '', uuid: '' };
  let processed = 0;
  const signal = options.abortSignal;
  const onProgress = options.onProgress;
  const retry = resolveRetryOptions(options.retry);
  const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });

  const writable = new WritableStream<Uint8Array>(
    {
      async start(c) {
        try {
          state = await initUpload(cryptifyUrl, { ...options, signal });
          onProgress?.(processed, false);
          if (signal?.aborted) throw new Error('Abort signaled during initFile.');
        } catch (e) {
          c.error(e);
        }
      },
      async write(chunk, c) {
        try {
          state = await storeChunkWithRetry(
            cryptifyUrl,
            state,
            chunk,
            processed,
            retry,
            signal,
            options.apiKey
          );
          processed += chunk.length;
          onProgress?.(processed, false);
          if (signal?.aborted) throw new Error('Abort signaled during storeChunk.');
        } catch (e) {
          c.error(e);
        }
      },
      async close() {
        const { signal: timed, cleanup } = withTimeout(signal, retry.finalizeTimeoutMs);
        try {
          await finalizeUpload(cryptifyUrl, state, processed, timed, options.apiKey);
        } finally {
          cleanup();
        }
        onProgress?.(processed, true);
        if (signal?.aborted) throw new Error('Abort signaled during finalize.');
      },
      async abort() {
        // nothing to clean up server-side
      },
    },
    queuingStrategy
  );

  return {
    writable,
    getUuid: () => state.uuid,
  };
}
