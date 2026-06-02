import { NetworkError, UploadSessionExpiredError } from '../errors.js';
import {
  classifyCryptifyError,
  delayWithFullJitter,
  resolveRetryOptions,
  sleep,
  withRetry,
  withTimeout,
  type ResolvedRetryOptions,
  type RetryOptions,
} from '../util/retry.js';
import { ProgressPipe } from '../util/progress.js';

export interface FileState {
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
  /**
   * Bearer credential issued by `POST /fileupload/init` (wire field
   * `recovery_token`). Persist alongside `uuid` in consumer-owned
   * storage so a refreshed page / restarted process can rehydrate the
   * `FileState` via `resumeUpload`. Empty string before init completes
   * (see `createUploadStream`'s placeholder state).
   */
  recoveryToken: string;
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
    let parsed: { error?: string; reason?: string; uuid?: string } | undefined;
    try {
      parsed = JSON.parse(body);
    } catch {
      // Body wasn't JSON — fall through to plain NetworkError below.
    }
    if (parsed?.error === UPLOAD_SESSION_NOT_FOUND_ERROR) {
      throw new UploadSessionExpiredError(parsed.uuid ?? uuid, parsed.reason ?? 'unknown', body);
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
  return {
    token,
    uuid: resJson['uuid'],
    recoveryToken: resJson['recovery_token'],
  };
}

/**
 * Rehydrate a `FileState` from cryptify after the in-memory state was
 * lost (page refresh, tab crash, navigate-away-and-back, process
 * restart). Calls `GET /fileupload/{uuid}/status` authenticated with the
 * `recovery_token` issued at init time, and returns the current rolling
 * token along with the byte offset to resume from.
 *
 * The returned `FileState` is suitable for feeding straight into
 * `storeChunkWithRetry` — if cryptify reported a `prev_token`, it is
 * mirrored to `state.prevToken` so the first chunk after resume can
 * exercise the idempotent-retry path if the original commit response
 * was lost in flight.
 *
 * 404 with the structured `upload_session_not_found` body is surfaced
 * as `UploadSessionExpiredError`. Cryptify deliberately collapses
 * "unknown UUID" and "wrong recovery_token" into the same response, so
 * callers should treat this as "session is gone, start a new upload"
 * regardless of which it was.
 */
export async function resumeUpload(
  cryptifyUrl: string,
  uuid: string,
  recoveryToken: string,
  signal?: AbortSignal
): Promise<{ state: FileState; uploaded: number }> {
  const response = await fetch(`${cryptifyUrl}/fileupload/${uuid}/status`, {
    signal,
    method: 'GET',
    headers: {
      'X-Recovery-Token': recoveryToken,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throwSessionExpiredOrNetworkError(`Error resuming upload`, response.status, body, uuid);
  }

  const resJson = (await response.json()) as {
    uploaded: number;
    cryptify_token: string;
    prev_token?: string;
    prev_offset?: number;
  };

  const state: FileState = {
    token: resJson.cryptify_token,
    uuid,
    recoveryToken,
  };
  if (resJson.prev_token !== undefined) {
    state.prevToken = resJson.prev_token;
  }
  return { state, uploaded: resJson.uploaded };
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
  return { token, uuid: state.uuid, prevToken: state.token, recoveryToken: state.recoveryToken };
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

/** Download an encrypted file as a ReadableStream. Returns the total
 *  byte count from `Content-Length` when the server advertises it
 *  (cryptify does for `GET /filedownload/{uuid}` without Range); callers
 *  use this to drive progress reporting. */
export async function downloadFile(
  cryptifyUrl: string,
  uuid: string,
  signal?: AbortSignal
): Promise<{ stream: ReadableStream<Uint8Array>; totalBytes: number | undefined }> {
  const response = await fetch(`${cryptifyUrl}/filedownload/${uuid}`, {
    signal,
    method: 'GET',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error downloading file`, response.status, body);
  }

  if (!response.body) throw new Error('Response body is null');

  const cl = response.headers?.get('content-length') ?? null;
  const n = cl ? Number.parseInt(cl, 10) : NaN;
  const totalBytes = Number.isFinite(n) && n > 0 ? n : undefined;

  return { stream: response.body as ReadableStream<Uint8Array>, totalBytes };
}

/**
 * Issue a Range request to resume a download from `offset`. Strict on
 * the response: only `206 Partial Content` whose `Content-Range` first
 * byte equals `offset` is accepted. A `200 OK` is a silent-rewind trap
 * — some intermediaries (caching proxies, misconfigured CDNs) ignore
 * `Range` and return the whole body from byte 0; splicing that onto
 * a consumer that already saw `offset` bytes corrupts the file. We
 * surface the mismatch as a `NetworkError` so the retry loop classifies
 * it as `fail` (the upstream isn't going to start honouring Range on
 * the next try).
 */
async function downloadRange(
  cryptifyUrl: string,
  uuid: string,
  offset: number,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${cryptifyUrl}/filedownload/${uuid}`, {
    signal,
    method: 'GET',
    headers: { Range: `bytes=${offset}-` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error resuming download`, response.status, body);
  }

  if (response.status !== 206) {
    // Server didn't honour Range. Treat as terminal — same upstream is
    // unlikely to start honouring it on the next attempt.
    throw new NetworkError(
      `Resume request returned ${response.status}, expected 206 — upstream did not honour Range`,
      response.status,
      ''
    );
  }

  const contentRange = response.headers.get('content-range');
  const start = parseContentRangeStart(contentRange);
  if (start !== offset) {
    throw new NetworkError(
      `Resume Content-Range start ${start ?? '<missing>'} does not match requested offset ${offset}`,
      response.status,
      contentRange ?? ''
    );
  }

  if (!response.body) throw new Error('Response body is null');
  return response.body as ReadableStream<Uint8Array>;
}

/** Parse the `bytes <start>-<end>/<size>` form. Returns the start byte
 *  on success, `null` on any malformed value. Conservative — a future
 *  RFC 7233 extension (`*` for unknown size, etc.) that doesn't match
 *  this shape is treated the same as missing for safety. */
function parseContentRangeStart(header: string | null): number | null {
  if (!header) return null;
  const match = /^\s*bytes\s+(\d+)-/.exec(header);
  if (!match) return null;
  const start = Number.parseInt(match[1], 10);
  return Number.isFinite(start) ? start : null;
}

/**
 * Download with retry on transient failures. Cryptify's `FileServer`
 * already supports HTTP Range requests, so a stream-level failure
 * mid-download (network drop, idle timeout) resumes from the byte
 * offset reached rather than starting over from zero. The consumer
 * sees a single contiguous stream regardless of how many internal
 * retries happened.
 *
 * Implementation note: the retry loop lives inside the returned
 * stream's `start()` source — wrapping `withRetry` around this would
 * be the wrong abstraction (its `Promise<T>` shape resolves before the
 * stream is read, leaving mid-stream errors with no way to re-enter
 * the loop). Same backoff helpers, different driver.
 */
export function downloadFileWithRetry(
  cryptifyUrl: string,
  uuid: string,
  retry: ResolvedRetryOptions,
  signal?: AbortSignal
): { stream: ReadableStream<Uint8Array>; pipe: ProgressPipe } {
  let received = 0;
  let attempt = 0;
  const pipe = new ProgressPipe();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Single source of truth: each underlying GET is one `attempt`,
      // counter is shared across resumes so a flapping connection that
      // delivers some bytes per attempt still exhausts the budget.
      while (true) {
        attempt += 1;
        const { signal: timed, cleanup } = withTimeout(signal, retry.downloadTimeoutMs);
        try {
          let innerStream: ReadableStream<Uint8Array>;
          if (received === 0) {
            const { stream: s, totalBytes } = await downloadFile(cryptifyUrl, uuid, timed);
            pipe.setTotal(totalBytes);
            innerStream = s;
          } else {
            innerStream = await downloadRange(cryptifyUrl, uuid, received, timed);
          }
          cleanup();

          const reader = innerStream.getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) {
              controller.close();
              return;
            }
            received += value.byteLength;
            pipe.report(received);
            controller.enqueue(value);
          }
        } catch (err) {
          cleanup();
          if (signal?.aborted) {
            controller.error(err);
            return;
          }
          if (attempt >= retry.maxAttempts) {
            controller.error(err);
            return;
          }
          if (classifyCryptifyError(err, signal) === 'fail') {
            controller.error(err);
            return;
          }
          const nextDelayMs = delayWithFullJitter(retry, attempt);
          retry.onRetry?.({
            attempt,
            maxAttempts: retry.maxAttempts,
            error: err,
            nextDelayMs,
          });
          try {
            await sleep(nextDelayMs, signal);
          } catch (sleepErr) {
            controller.error(sleepErr);
            return;
          }
          // Loop back: next iteration uses Range from `received`.
        }
      }
    },
    cancel(reason) {
      // Caller-driven cancel (consumer abandoned the stream). The
      // currently in-flight fetch is bound to `signal` already — we
      // can't directly cancel it from here, but consumer abandoning the
      // ReadableStream means they won't pull more. The fetch will
      // eventually error or complete; either way nothing reaches the
      // controller after cancel.
      void reason;
    },
  });

  return { stream, pipe };
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
    onUploadInit?: (info: { uuid: string; recoveryToken: string }) => void;
  }
): UploadStream {
  let state: FileState = { token: '', uuid: '', recoveryToken: '' };
  let processed = 0;
  const signal = options.abortSignal;
  const onProgress = options.onProgress;
  const onUploadInit = options.onUploadInit;
  const retry = resolveRetryOptions(options.retry);
  const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });

  const writable = new WritableStream<Uint8Array>(
    {
      async start(c) {
        try {
          state = await initUpload(cryptifyUrl, { ...options, signal });
          onUploadInit?.({ uuid: state.uuid, recoveryToken: state.recoveryToken });
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
