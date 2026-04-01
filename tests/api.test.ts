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
