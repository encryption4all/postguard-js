import { NetworkError, UploadSessionExpiredError } from '../errors.js';

export interface RetryOptions {
  /** Total attempts including the first one. Default 5. */
  maxAttempts?: number;
  /** Delay before the first retry, in ms. Default 500. */
  initialDelayMs?: number;
  /** Cap on the (pre-jitter) exponential delay. Default 30 000. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay between attempts. Default 2. */
  multiplier?: number;
  /** Per-attempt timeout for chunk PUT. Default 60 000. */
  chunkTimeoutMs?: number;
  /** Per-attempt timeout for finalize. Default 120 000. */
  finalizeTimeoutMs?: number;
  /**
   * Per-attempt timeout for the download GET. Default disabled — let the
   * retry budget bound it instead. Note this only bounds the request
   * handshake (until the response headers + body stream are returned);
   * stream consumption happens after the call returns and is *not*
   * affected by this timeout. If you need to cap mid-stream stalls,
   * implement that at the stream-reader level.
   */
  downloadTimeoutMs?: number;
  /** Notification fired when a retry is about to be attempted (after a failure, before the delay). */
  onRetry?: (info: RetryEvent) => void;
}

export interface RetryEvent {
  /** 1-indexed attempt that just failed. The next attempt will be `attempt + 1`. */
  attempt: number;
  maxAttempts: number;
  /** The error that caused this retry. */
  error: unknown;
  /** Delay (ms) the SDK will wait before the next attempt. */
  nextDelayMs: number;
}

export interface ResolvedRetryOptions extends Required<Omit<RetryOptions, 'onRetry' | 'downloadTimeoutMs'>> {
  onRetry?: (info: RetryEvent) => void;
  /** 0 means "no per-attempt timeout". */
  downloadTimeoutMs: number;
}

export function resolveRetryOptions(opts?: RetryOptions): ResolvedRetryOptions {
  return {
    maxAttempts: opts?.maxAttempts ?? 5,
    initialDelayMs: opts?.initialDelayMs ?? 500,
    maxDelayMs: opts?.maxDelayMs ?? 30_000,
    multiplier: opts?.multiplier ?? 2,
    chunkTimeoutMs: opts?.chunkTimeoutMs ?? 60_000,
    finalizeTimeoutMs: opts?.finalizeTimeoutMs ?? 120_000,
    downloadTimeoutMs: opts?.downloadTimeoutMs ?? 0,
    onRetry: opts?.onRetry,
  };
}

/** Outcome of inspecting an error from a retriable operation. */
export type RetryClassification = 'retry' | 'fail';

/**
 * Decide whether an error from a Cryptify request should trigger a retry.
 * Caller-driven aborts always fail (preserve user intent). Internal-timeout
 * aborts retry (that's the whole point of having a timeout). 5xx and
 * fetch-level network errors retry. 4xx fail — including the structured
 * `upload_session_not_found` 404 surfaced as `UploadSessionExpiredError`.
 */
export function classifyCryptifyError(err: unknown, callerSignal?: AbortSignal): RetryClassification {
  if (err instanceof UploadSessionExpiredError) return 'fail';
  if (err instanceof NetworkError) {
    return err.status >= 500 ? 'retry' : 'fail';
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return callerSignal?.aborted ? 'fail' : 'retry';
  }
  // TypeError covers fetch's "Failed to fetch" / network unreachable.
  if (err instanceof TypeError) return 'retry';
  return 'fail';
}

function delayWithFullJitter(opts: ResolvedRetryOptions, attempt: number): number {
  const base = Math.min(opts.initialDelayMs * Math.pow(opts.multiplier, attempt - 1), opts.maxDelayMs);
  return Math.floor(Math.random() * base);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Run `fn` up to `opts.maxAttempts` times, retrying on retriable failures
 * with exponential backoff and full jitter. The caller's `signal` aborts
 * the loop synchronously and propagates as an AbortError.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: ResolvedRetryOptions,
  classify: (err: unknown) => RetryClassification = classifyCryptifyError,
  callerSignal?: AbortSignal
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (callerSignal?.aborted) throw err;
      if (attempt >= opts.maxAttempts) break;
      if (classify(err) === 'fail') break;
      const nextDelayMs = delayWithFullJitter(opts, attempt);
      opts.onRetry?.({ attempt, maxAttempts: opts.maxAttempts, error: err, nextDelayMs });
      await sleep(nextDelayMs, callerSignal);
    }
  }
  throw lastError;
}

/**
 * Combine a caller-provided AbortSignal with a per-attempt timeout. Returns
 * `{ signal, cleanup }` — call `cleanup()` after the awaited operation
 * resolves to release the timer.
 */
export function withTimeout(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (timeoutMs <= 0) {
    return { signal: callerSignal, cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, controller.signal])
    : controller.signal;
  return { signal, cleanup: () => clearTimeout(timer) };
}
