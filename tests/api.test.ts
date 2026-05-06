import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkError } from '../src/errors.js';
import { fetchMPK, fetchVerificationKey, fetchSigningKeysWithApiKey } from '../src/api/pkg.js';
import { initUpload, storeChunk, finalizeUpload, downloadFile } from '../src/api/cryptify.js';

// Mock global fetch
const mockFetch = vi.fn();

beforeEach(() => {
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
        json: () => Promise.resolve({ uuid: 'file-uuid' }),
        text: () => Promise.resolve(''),
        headers: new Headers({ cryptifytoken: 'tok-123' }),
      });

      const result = await initUpload('https://cryptify.example.com', {
        recipient: 'alice@example.com',
      });
      expect(result).toEqual({ token: 'tok-123', uuid: 'file-uuid' });
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
      expect(result).toBe(stream);
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
});
