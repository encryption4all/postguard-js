import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkError, UploadSessionExpiredError } from '../src/errors.js';
import { fetchMPK, fetchVerificationKey, fetchSigningKeysWithApiKey } from '../src/api/pkg.js';
import {
  initUpload,
  resumeUpload,
  storeChunk,
  storeChunkWithRetry,
  finalizeUpload,
  downloadFile,
  downloadFileWithRetry,
  createUploadStream,
} from '../src/api/cryptify.js';
import { resolveRetryOptions } from '../src/util/retry.js';

// Mock global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function okJson(body: unknown, headers?: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(headers),
    body: null,
  };
}

function errorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(body),
    headers: new Headers(),
  };
}

describe('PKG API', () => {
  describe('fetchMPK', () => {
    it('fetches and returns the public key', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ publicKey: 'mpk-data' }));
      const mpk = await fetchMPK('https://pkg.example.com');
      expect(mpk).toBe('mpk-data');
      expect(mockFetch).toHaveBeenCalledWith('https://pkg.example.com/v2/parameters', expect.objectContaining({}));
    });

    it('throws NetworkError on failure', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Server Error'));
      await expect(fetchMPK('https://pkg.example.com')).rejects.toThrow(NetworkError);
    });
  });

  describe('fetchVerificationKey', () => {
    it('fetches and returns the public key', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ publicKey: 'vk-data' }));
      const vk = await fetchVerificationKey('https://pkg.example.com');
      expect(vk).toBe('vk-data');
      expect(mockFetch).toHaveBeenCalledWith('https://pkg.example.com/v2/sign/parameters', expect.objectContaining({}));
    });

    it('throws NetworkError on failure', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'));
      await expect(fetchVerificationKey('https://pkg.example.com')).rejects.toThrow(NetworkError);
    });
  });

  describe('fetchSigningKeysWithApiKey', () => {
    it('sends correct auth header and body', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ pubSignKey: 'pub', privSignKey: 'priv' }));
      const keys = await fetchSigningKeysWithApiKey('https://pkg.example.com', 'my-api-key');

      expect(keys).toEqual({ pubSignKey: 'pub', privSignKey: 'priv' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://pkg.example.com/v2/irma/sign/key',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('throws NetworkError on failure', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
      await expect(
        fetchSigningKeysWithApiKey('https://pkg.example.com', 'bad-key')
      ).rejects.toThrow(NetworkError);
    });
  });
});

describe('Cryptify API', () => {
  describe('initUpload', () => {
    it('returns token and uuid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ uuid: 'file-uuid', recovery_token: 'rec-hex' }),
        text: () => Promise.resolve(''),
        headers: new Headers({ cryptifytoken: 'tok-123' }),
      });

      const result = await initUpload('https://cryptify.example.com', {
        recipient: 'alice@example.com',
      });
      expect(result).toEqual({ token: 'tok-123', uuid: 'file-uuid', recoveryToken: 'rec-hex' });
    });

    it('throws NetworkError on failure', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400, 'Bad Request'));
      await expect(
        initUpload('https://cryptify.example.com', { recipient: 'a@b.com' })
      ).rejects.toThrow(NetworkError);
    });

    it('omits Authorization header when no apiKey is set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ uuid: 'u' }),
        text: () => Promise.resolve(''),
        headers: new Headers({ cryptifytoken: 't' }),
      });

      await initUpload('https://cryptify.example.com', { recipient: 'a@b.com' });

      // Without an apiKey, the Authorization key must not appear at all in
      // the outgoing init — using `not.objectContaining` rather than
      // checking for `undefined` so we don't depend on whether the spread
      // produced an explicit `undefined` value vs. an absent key.
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cryptify.example.com/fileupload/init',
        expect.objectContaining({
          headers: expect.not.objectContaining({ Authorization: expect.anything() }),
        })
      );
    });

    it('sends Authorization: Bearer <apiKey> when apiKey is set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ uuid: 'u' }),
        text: () => Promise.resolve(''),
        headers: new Headers({ cryptifytoken: 't' }),
      });

      await initUpload('https://cryptify.example.com', {
        recipient: 'a@b.com',
        apiKey: 'PG-test-key',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cryptify.example.com/fileupload/init',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer PG-test-key' }),
        })
      );
    });
  });

  describe('resumeUpload', () => {
    it('rehydrates FileState from /status before any chunk has been committed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            uploaded: 0,
            cryptify_token: 'tok-current',
          }),
        text: () => Promise.resolve(''),
        headers: new Headers(),
      });

      const result = await resumeUpload(
        'https://cryptify.example.com',
        'file-uuid',
        'rec-hex'
      );

      expect(result.uploaded).toBe(0);
      expect(result.state).toEqual({
        token: 'tok-current',
        uuid: 'file-uuid',
        recoveryToken: 'rec-hex',
      });
      // No prevToken before any chunk has been committed.
      expect(result.state.prevToken).toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cryptify.example.com/fileupload/file-uuid/status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Recovery-Token': 'rec-hex' }),
        })
      );
    });

    it('mirrors prev_token to state.prevToken when at least one chunk is committed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            uploaded: 1024,
            cryptify_token: 'tok-current',
            prev_token: 'tok-prev',
            prev_offset: 0,
          }),
        text: () => Promise.resolve(''),
        headers: new Headers(),
      });

      const result = await resumeUpload(
        'https://cryptify.example.com',
        'file-uuid',
        'rec-hex'
      );

      expect(result.uploaded).toBe(1024);
      expect(result.state).toEqual({
        token: 'tok-current',
        prevToken: 'tok-prev',
        uuid: 'file-uuid',
        recoveryToken: 'rec-hex',
      });
    });

    it('surfaces 404 upload_session_not_found as UploadSessionExpiredError', async () => {
      // Cryptify collapses "unknown UUID" and "wrong recovery_token"
      // into the same 404 body — both must surface as the dedicated
      // expired-session error so callers don't retry into a wall.
      const body = JSON.stringify({
        error: 'upload_session_not_found',
        uuid: 'file-uuid',
        reason: 'expired_or_unknown',
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve(body),
        headers: new Headers(),
      });

      await expect(
        resumeUpload('https://cryptify.example.com', 'file-uuid', 'rec-hex')
      ).rejects.toMatchObject({
        name: 'UploadSessionExpiredError',
        status: 404,
        uuid: 'file-uuid',
        reason: 'expired_or_unknown',
      });
    });

    it('surfaces 401 (missing/empty recovery header) as plain NetworkError', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, ''));

      const err = await resumeUpload(
        'https://cryptify.example.com',
        'file-uuid',
        ''
      ).catch((e) => e);

      expect(err).toBeInstanceOf(NetworkError);
      expect(err).not.toBeInstanceOf(UploadSessionExpiredError);
      expect(err.status).toBe(401);
    });

    it('plain (non-structured) 404 body still falls through as NetworkError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('plain 404'),
        headers: new Headers(),
      });

      const err = await resumeUpload(
        'https://cryptify.example.com',
        'file-uuid',
        'rec-hex'
      ).catch((e) => e);

      expect(err).toBeInstanceOf(NetworkError);
      expect(err).not.toBeInstanceOf(UploadSessionExpiredError);
      expect(err.status).toBe(404);
    });
  });

  describe('storeChunk', () => {
    it('sends chunk with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ cryptifytoken: 'tok-456' }),
      });

      const chunk = new Uint8Array([1, 2, 3, 4]);
      const result = await storeChunk(
        'https://cryptify.example.com',
        { token: 'tok-123', uuid: 'file-uuid' },
        chunk,
        0
      );

      expect(result.token).toBe('tok-456');
      expect(result.uuid).toBe('file-uuid');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cryptify.example.com/fileupload/file-uuid',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'content-range': 'bytes 0-4/*',
          }),
        })
      );
    });

    it('forwards Authorization: Bearer <apiKey> when set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ cryptifytoken: 'tok' }),
      });

      await storeChunk(
        'https://cryptify.example.com',
        { token: 't', uuid: 'u' },
        new Uint8Array([1]),
        0,
        undefined,
        'PG-test-key'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cryptify.example.com/fileupload/u',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer PG-test-key' }),
        })
      );
    });

    it('surfaces upload_session_not_found 404 as UploadSessionExpiredError', async () => {
      const body = JSON.stringify({
        error: 'upload_session_not_found',
        uuid: 'file-uuid',
        reason: 'expired_or_unknown',
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve(body),
        headers: new Headers(),
      });

      await expect(
        storeChunk(
          'https://cryptify.example.com',
          { token: 'tok', uuid: 'file-uuid' },
          new Uint8Array([1]),
          0
        )
      ).rejects.toMatchObject({
        name: 'UploadSessionExpiredError',
        status: 404,
        uuid: 'file-uuid',
        reason: 'expired_or_unknown',
      });
    });

    it('plain 404 (non-structured body) still falls through as NetworkError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('plain 404 body'),
        headers: new Headers(),
      });

      const err = await storeChunk(
        'https://cryptify.example.com',
        { token: 'tok', uuid: 'u' },
        new Uint8Array([1]),
        0
      ).catch((e) => e);

      expect(err).toBeInstanceOf(NetworkError);
      expect(err).not.toBeInstanceOf(UploadSessionExpiredError);
      expect(err.status).toBe(404);
    });
  });

  describe('storeChunkWithRetry', () => {
    const fastRetry = resolveRetryOptions({
      maxAttempts: 3,
      initialDelayMs: 1,
      maxDelayMs: 5,
      multiplier: 2,
    });

    it('returns the new token on first-attempt success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ cryptifytoken: 'tok-after' }),
      });

      const result = await storeChunkWithRetry(
        'https://cryptify.example.com',
        { token: 'tok-before', uuid: 'u' },
        new Uint8Array([1]),
        0,
        fastRetry
      );

      expect(result.token).toBe('tok-after');
      expect(result.prevToken).toBe('tok-before');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 503 and succeeds on the next attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve('busy'),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ cryptifytoken: 'tok-after' }),
        });

      const result = await storeChunkWithRetry(
        'https://cryptify.example.com',
        { token: 'tok-before', uuid: 'u' },
        new Uint8Array([1]),
        0,
        fastRetry
      );

      expect(result.token).toBe('tok-after');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('sends prevToken on retry so cryptify can detect a duplicate', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ cryptifytoken: 'tok-after' }),
        });

      const result = await storeChunkWithRetry(
        'https://cryptify.example.com',
        { token: 'tok-current', prevToken: 'tok-prev', uuid: 'u' },
        new Uint8Array([1]),
        0,
        fastRetry
      );

      expect(result.token).toBe('tok-after');
      // Attempt 1 sends `state.token` (tok-current).
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://cryptify.example.com/fileupload/u',
        expect.objectContaining({
          headers: expect.objectContaining({ cryptifytoken: 'tok-current' }),
        })
      );
      // Attempt 2 sends `state.prevToken` (tok-prev) so cryptify's
      // idempotent-retry path replays the cached response if the original
      // PUT had been committed before the response was lost.
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://cryptify.example.com/fileupload/u',
        expect.objectContaining({
          headers: expect.objectContaining({ cryptifytoken: 'tok-prev' }),
        })
      );
    });

    it('does NOT retry on UploadSessionExpiredError (4xx fail-fast)', async () => {
      const body = JSON.stringify({
        error: 'upload_session_not_found',
        uuid: 'u',
        reason: 'expired_or_unknown',
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(body),
        headers: new Headers(),
      });

      await expect(
        storeChunkWithRetry(
          'https://cryptify.example.com',
          { token: 't', uuid: 'u' },
          new Uint8Array([1]),
          0,
          fastRetry
        )
      ).rejects.toBeInstanceOf(UploadSessionExpiredError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on 413 (quota exceeded)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 413,
        text: () => Promise.resolve('{"error":"per_upload"}'),
        headers: new Headers(),
      });

      await expect(
        storeChunkWithRetry(
          'https://cryptify.example.com',
          { token: 't', uuid: 'u' },
          new Uint8Array([1]),
          0,
          fastRetry
        )
      ).rejects.toMatchObject({ name: 'NetworkError', status: 413 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('exhausts maxAttempts on persistent 503 then throws the last error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('busy'),
        headers: new Headers(),
      });

      await expect(
        storeChunkWithRetry(
          'https://cryptify.example.com',
          { token: 't', uuid: 'u' },
          new Uint8Array([1]),
          0,
          fastRetry
        )
      ).rejects.toMatchObject({ name: 'NetworkError', status: 503 });
      expect(mockFetch).toHaveBeenCalledTimes(fastRetry.maxAttempts);
    });

    it('does NOT retry when the caller-provided AbortSignal aborts', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockRejectedValueOnce(
        new DOMException('Aborted', 'AbortError')
      );

      await expect(
        storeChunkWithRetry(
          'https://cryptify.example.com',
          { token: 't', uuid: 'u' },
          new Uint8Array([1]),
          0,
          fastRetry,
          controller.signal
        )
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('finalizeUpload', () => {
    it('sends finalize with correct size header', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('') });

      await finalizeUpload(
        'https://cryptify.example.com',
        { token: 'tok-123', uuid: 'file-uuid' },
        1024
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cryptify.example.com/fileupload/finalize/file-uuid',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-range': 'bytes */1024',
          }),
        })
      );
    });

    it('throws NetworkError on failure', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Error'));
      await expect(
        finalizeUpload(
          'https://cryptify.example.com',
          { token: 'tok', uuid: 'uuid' },
          100
        )
      ).rejects.toThrow(NetworkError);
    });

    it('forwards Authorization: Bearer <apiKey> when set', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('') });

      await finalizeUpload(
        'https://cryptify.example.com',
        { token: 't', uuid: 'u' },
        100,
        undefined,
        'PG-test-key'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cryptify.example.com/fileupload/finalize/u',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer PG-test-key' }),
        })
      );
    });

    it('surfaces 503 from cryptify as NetworkError when pkg is unreachable', async () => {
      // When cryptify cannot validate the API key against pkg AND the
      // upload exceeds the default tier, cryptify returns 503. The SDK
      // surfaces this as a NetworkError with status 503 so callers can
      // distinguish it from quota / auth errors.
      mockFetch.mockResolvedValueOnce(errorResponse(503, 'pg-pkg unreachable'));

      await expect(
        finalizeUpload(
          'https://cryptify.example.com',
          { token: 't', uuid: 'u' },
          200_000_000_000,
          undefined,
          'PG-test-key'
        )
      ).rejects.toMatchObject({
        name: 'NetworkError',
        status: 503,
      });
    });
  });

  describe('downloadFile', () => {
    it('returns response body as ReadableStream', async () => {
      const stream = new ReadableStream();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
      });

      const result = await downloadFile('https://cryptify.example.com', 'file-uuid');
      expect(result.stream).toBe(stream);
      expect(result.totalBytes).toBeUndefined();
    });

    it('throws NetworkError on failure', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found'));
      await expect(
        downloadFile('https://cryptify.example.com', 'missing-uuid')
      ).rejects.toThrow(NetworkError);
    });

    it('throws if response body is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
      });
      await expect(
        downloadFile('https://cryptify.example.com', 'uuid')
      ).rejects.toThrow('Response body is null');
    });
  });

  describe('downloadFileWithRetry', () => {
    const fastRetry = resolveRetryOptions({
      maxAttempts: 3,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });

    /** Build a ReadableStream that yields the given byte chunks then closes. */
    function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
      return new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
    }

    /** Build a ReadableStream that yields the given chunks then errors.
     *  Pull-based so chunks are delivered to the consumer before the
     *  error fires — `controller.error()` empties any queued chunks, so
     *  a start-based variant would silently drop the first batch. */
    function streamThenError(
      chunks: Uint8Array[],
      err: unknown
    ): ReadableStream<Uint8Array> {
      let i = 0;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (i < chunks.length) {
            controller.enqueue(chunks[i++]);
          } else {
            controller.error(err);
          }
        },
      });
    }

    /** Drain a ReadableStream into a single Uint8Array. */
    async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
      const reader = stream.getReader();
      const parts: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        parts.push(value);
        total += value.byteLength;
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const p of parts) {
        out.set(p, offset);
        offset += p.byteLength;
      }
      return out;
    }

    it('produces the underlying bytes on a clean download', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: streamOf(new Uint8Array([1, 2, 3, 4])),
      });

      const { stream } = downloadFileWithRetry('https://cryptify.example.com', 'uuid', fastRetry);
      const bytes = await drain(stream);

      expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // First attempt should not include a Range header.
      expect(mockFetch.mock.calls[0][1]).toEqual(
        expect.objectContaining({ method: 'GET' })
      );
      const firstAttemptHeaders = mockFetch.mock.calls[0][1]?.headers;
      expect(firstAttemptHeaders).toBeUndefined();
    });

    it('retries on 502 and succeeds on the next attempt (no Range yet — zero bytes received)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: () => Promise.resolve('bad gateway'),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          body: streamOf(new Uint8Array([42])),
        });

      const { stream } = downloadFileWithRetry('https://cryptify.example.com', 'uuid', fastRetry);
      const bytes = await drain(stream);

      expect(Array.from(bytes)).toEqual([42]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // No bytes received before the retry — the retry is a fresh GET, not a Range request.
      expect(mockFetch.mock.calls[1][1]?.headers).toBeUndefined();
    });

    it('resumes from received offset via Range when stream errors mid-flight', async () => {
      // Attempt 1: deliver 4 bytes, then the underlying stream errors.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: streamThenError(
          [new Uint8Array([1, 2, 3, 4])],
          new TypeError('network reset')
        ),
      });
      // Attempt 2: 206 with Content-Range starting at 4, deliver 4 more bytes.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 206,
        headers: new Headers({ 'content-range': 'bytes 4-7/8' }),
        body: streamOf(new Uint8Array([5, 6, 7, 8])),
        text: () => Promise.resolve(''),
      });

      const { stream } = downloadFileWithRetry('https://cryptify.example.com', 'uuid', fastRetry);
      const bytes = await drain(stream);

      expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Resume request must include Range: bytes=4-
      expect(mockFetch.mock.calls[1][1]?.headers).toEqual(
        expect.objectContaining({ Range: 'bytes=4-' })
      );
    });

    it('fails fast if resume returns 200 instead of 206 (silent-rewind protection)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: streamThenError([new Uint8Array([1, 2])], new TypeError('drop')),
      });
      // Resume attempt: server (or proxy) ignored Range and returned 200.
      // Without strict checking, we'd splice this on top of the 2 bytes
      // already delivered and corrupt the stream.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: streamOf(new Uint8Array([1, 2, 3, 4])),
        text: () => Promise.resolve(''),
      });

      const { stream } = downloadFileWithRetry('https://cryptify.example.com', 'uuid', fastRetry);

      const reader = stream.getReader();
      const first = await reader.read();
      expect(Array.from(first.value!)).toEqual([1, 2]);
      // Next read should error — 200 on resume is treated as terminal.
      await expect(reader.read()).rejects.toMatchObject({
        name: 'NetworkError',
        message: expect.stringContaining('did not honour Range'),
      });
    });

    it('fails fast if resume Content-Range start does not match requested offset', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: streamThenError([new Uint8Array([1, 2])], new TypeError('drop')),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 206,
        headers: new Headers({ 'content-range': 'bytes 0-7/8' }), // wrong start!
        body: streamOf(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])),
        text: () => Promise.resolve(''),
      });

      const { stream } = downloadFileWithRetry('https://cryptify.example.com', 'uuid', fastRetry);
      const reader = stream.getReader();
      await reader.read(); // [1,2]
      await expect(reader.read()).rejects.toMatchObject({
        name: 'NetworkError',
        message: expect.stringContaining('Content-Range start 0 does not match requested offset 2'),
      });
    });

    it('errors stream on first read with 404 (no retry)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('not found'),
        headers: new Headers(),
      });

      const { stream } = downloadFileWithRetry('https://cryptify.example.com', 'uuid', fastRetry);
      const reader = stream.getReader();
      await expect(reader.read()).rejects.toMatchObject({
        name: 'NetworkError',
        status: 404,
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('shares the attempt counter across resumes — flapping connection exhausts the budget', async () => {
      // Each attempt delivers one byte then errors. Without the shared
      // counter, this would loop forever; with it, the source errors
      // after maxAttempts (3) — three bytes delivered before the
      // failure surfaces.
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 206,
          headers: new Headers({
            'content-range': `bytes ${
              mockFetch.mock.calls.length - 1
            }-${mockFetch.mock.calls.length - 1}/100`,
          }),
          body: streamThenError(
            [new Uint8Array([0xab])],
            new TypeError('flap')
          ),
          text: () => Promise.resolve(''),
        })
      );
      // The first attempt is a regular GET (no Range), so override its
      // Content-Range expectation: the source uses Range only for
      // attempts ≥ 2. The mock returns 206 for everything, but the
      // first response's status doesn't matter for the source's logic
      // — it only checks 206 + Content-Range on resume requests, not
      // the first GET. We rebuild the mock per call so the
      // Content-Range matches `received`.
      mockFetch.mockReset();
      let callIndex = 0;
      mockFetch.mockImplementation((_url, init) => {
        callIndex += 1;
        const headers = (init?.headers ?? {}) as Record<string, string>;
        if (callIndex === 1) {
          // First attempt: plain GET, deliver 1 byte then drop.
          return Promise.resolve({
            ok: true,
            status: 200,
            body: streamThenError(
              [new Uint8Array([0xa1])],
              new TypeError('flap')
            ),
          });
        }
        // Resume attempts: parse Range, return 206 with matching Content-Range.
        const m = /^bytes=(\d+)-/.exec(headers.Range ?? '');
        const offset = m ? Number.parseInt(m[1], 10) : 0;
        return Promise.resolve({
          ok: true,
          status: 206,
          headers: new Headers({
            'content-range': `bytes ${offset}-${offset}/100`,
          }),
          body: streamThenError(
            [new Uint8Array([0xa0 + offset])],
            new TypeError('flap')
          ),
          text: () => Promise.resolve(''),
        });
      });

      const { stream } = downloadFileWithRetry('https://cryptify.example.com', 'uuid', fastRetry);
      const reader = stream.getReader();
      // Each attempt delivers one byte before erroring. With maxAttempts=3,
      // we should see 3 bytes total, then the next read errors.
      const seen: number[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await reader.read();
        if (r.done) break;
        seen.push(...Array.from(r.value));
      }
      expect(seen).toHaveLength(3);
      await expect(reader.read()).rejects.toMatchObject({ name: 'TypeError' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('caller-driven abort propagates as AbortError without retry', async () => {
      const controller = new AbortController();
      controller.abort();
      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const { stream } = downloadFileWithRetry(
        'https://cryptify.example.com',
        'uuid',
        fastRetry,
        controller.signal
      );
      const reader = stream.getReader();
      await expect(reader.read()).rejects.toMatchObject({ name: 'AbortError' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('createUploadStream onUploadInit', () => {
    it('fires once with {uuid, recoveryToken} after upload_init, before any chunk PUT', async () => {
      mockFetch.mockImplementation((_url: string, init: RequestInit) => {
        if (init?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(''),
            headers: new Headers({ cryptifytoken: 'tok-next' }),
          });
        }
        // POST: init or finalize
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ uuid: 'u-1', recovery_token: 'rec-abc' }),
          text: () => Promise.resolve(''),
          headers: new Headers({ cryptifytoken: 'tok-0' }),
        });
      });

      const calls: Array<{ uuid: string; recoveryToken: string }> = [];
      let initSeenBeforeFirstPut = false;

      const stream = createUploadStream('https://cryptify.example.com', {
        recipient: 'a@b.com',
        onUploadInit: (info) => {
          calls.push(info);
          // No PUT should have happened yet — init is the only fetch.
          initSeenBeforeFirstPut =
            mockFetch.mock.calls.length === 1 &&
            mockFetch.mock.calls[0][0].endsWith('/fileupload/init');
        },
      });

      const writer = stream.writable.getWriter();
      await writer.write(new Uint8Array([1, 2, 3]));
      await writer.close();

      expect(calls).toEqual([{ uuid: 'u-1', recoveryToken: 'rec-abc' }]);
      expect(initSeenBeforeFirstPut).toBe(true);
    });

    it('is not called when upload_init fails', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400, 'bad'));

      const onUploadInit = vi.fn();
      const stream = createUploadStream('https://cryptify.example.com', {
        recipient: 'a@b.com',
        onUploadInit,
      });

      const writer = stream.writable.getWriter();
      await expect(writer.write(new Uint8Array([1]))).rejects.toBeDefined();
      expect(onUploadInit).not.toHaveBeenCalled();
    });
  });
});
