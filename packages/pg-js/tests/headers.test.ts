import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pkgHeaders, cryptifyHeaders, CRYPTIFY_SOURCE_HEADER } from '../src/util/headers.js';
import { PostGuard } from '../src/postguard.js';

describe('pkgHeaders', () => {
  it('strips X-Cryptify-Source case-insensitively', () => {
    const result = pkgHeaders({ headers: { 'x-cryptify-source': 'outlook', 'X-Custom': 'y' } });
    expect(result).toEqual({ 'x-custom': 'y' });
  });

  it('leaves other headers untouched', () => {
    const result = pkgHeaders({ headers: { 'X-Custom': 'y', 'X-Other': 'z' } });
    expect(result).toEqual({ 'x-custom': 'y', 'x-other': 'z' });
  });

  it('returns undefined when the result would be empty', () => {
    expect(pkgHeaders({})).toBeUndefined();
    expect(pkgHeaders({ headers: undefined })).toBeUndefined();
    expect(pkgHeaders({ headers: { [CRYPTIFY_SOURCE_HEADER]: 'outlook' } })).toBeUndefined();
  });
});

describe('cryptifyHeaders', () => {
  it('adds X-Cryptify-Source from cryptifyChannel', () => {
    const result = cryptifyHeaders({ cryptifyChannel: 'outlook' });
    expect(result).toEqual({ [CRYPTIFY_SOURCE_HEADER.toLowerCase()]: 'outlook' });
  });

  it('cryptifyChannel takes precedence over a caller-supplied header (case-insensitive)', () => {
    const result = cryptifyHeaders({
      headers: { 'x-cryptify-source': 'stale', 'X-Custom': 'y' },
      cryptifyChannel: 'fresh',
    });
    expect(result).toEqual({ 'x-cryptify-source': 'fresh', 'x-custom': 'y' });
  });

  it('leaves a caller-supplied header alone when cryptifyChannel is unset', () => {
    const result = cryptifyHeaders({ headers: { 'X-Cryptify-Source': 'stale' } });
    expect(result).toEqual({ 'x-cryptify-source': 'stale' });
  });

  it('leaves other headers untouched', () => {
    const result = cryptifyHeaders({ headers: { 'X-Custom': 'y' }, cryptifyChannel: 'website' });
    expect(result).toEqual({ 'x-custom': 'y', 'x-cryptify-source': 'website' });
  });

  it('returns undefined when the result would be empty', () => {
    expect(cryptifyHeaders({})).toBeUndefined();
    expect(cryptifyHeaders({ headers: undefined, cryptifyChannel: undefined })).toBeUndefined();
  });
});

// --- End-to-end header audit -------------------------------------------
//
// Drives real PostGuard/Sealed/Opened/pipeline code against a mocked
// `fetch`, mocking only pg-wasm (sealStream / StreamUnsealer), so every
// endpoint the encrypt+upload and open+inspect flows hit is exercised by
// construction rather than by a hand-picked list of URLs.

const { sealStream, signChallenge, streamUnsealerNew } = vi.hoisted(() => ({
  sealStream: vi.fn(
    async (
      _mpk: unknown,
      _opts: unknown,
      readable: ReadableStream<Uint8Array>,
      writable: WritableStream<Uint8Array>
    ) => {
      const reader = readable.getReader();
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
      const writer = writable.getWriter();
      await writer.write(new Uint8Array([1, 2, 3]));
      await writer.close();
    }
  ),
  signChallenge: vi.fn(() => new Uint8Array()),
  streamUnsealerNew: vi.fn(async (readable: ReadableStream<Uint8Array>) => {
    // Read once so the underlying Cryptify download actually fires.
    await readable.getReader().read();
    return {
      inspect_header: () => new Map([['bob@example.com', { ts: 0, con: [] }]]),
      public_identity: () => null,
    };
  }),
}));

vi.mock('../src/util/wasm.js', () => ({
  loadWasm: async () => ({
    sealStream,
    signChallenge,
    StreamUnsealer: { new: streamUnsealerNew },
  }),
}));

interface RecordedCall {
  url: string;
  headers: Record<string, string>;
}

function jsonResponse(body: unknown, headers?: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(headers),
    body: null,
  };
}

function streamResponse(bytes: Uint8Array, headers?: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

describe('end-to-end header audit', () => {
  let calls: RecordedCall[];
  const mockFetch = vi.fn();

  beforeEach(() => {
    calls = [];
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers)) });

      if (url.endsWith('/v2/parameters')) return jsonResponse({ publicKey: 'mpk' });
      if (url.endsWith('/v2/sign/parameters')) return jsonResponse({ publicKey: 'vk' });
      if (url.endsWith('/v2/irma/sign/key')) {
        return jsonResponse({ pubSignKey: 'pub', privSignKey: 'priv' });
      }
      if (url.endsWith('/fileupload/init')) {
        return jsonResponse(
          { uuid: 'upload-uuid', recovery_token: 'rt' },
          { cryptifytoken: 'tok-0' }
        );
      }
      if (url.includes('/fileupload/finalize/')) {
        return jsonResponse({});
      }
      if (/\/fileupload\/[^/]+$/.test(url) && init?.method === 'PUT') {
        return jsonResponse({}, { cryptifytoken: 'tok-1' });
      }
      if (url.includes('/filedownload/')) {
        return streamResponse(new Uint8Array([9, 9, 9]), { 'content-length': '3' });
      }
      throw new Error(`headers.test.ts mockFetch: unhandled URL ${url}`);
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never sends X-Cryptify-Source to the PKG and always sends it to Cryptify', async () => {
    const pg = new PostGuard({
      pkgUrl: 'https://pkg.example.com',
      cryptifyUrl: 'https://cryptify.example.com',
      cryptifyChannel: 'test-channel',
      headers: { 'X-Cryptify-Source': 'stale', 'X-Custom': 'y' },
    });

    await pg
      .encrypt({
        files: [new File(['hello world'], 'hello.txt')],
        recipients: [pg.recipient.email('bob@example.com')],
        sign: pg.sign.apiKey('my-api-key'),
      })
      .upload({ notify: { recipients: false } });

    await pg.open({ uuid: 'upload-uuid' }).inspect();

    // Sanity: both services were actually exercised, so the assertions
    // below aren't vacuously true.
    const pkgCalls = calls.filter((c) => c.url.startsWith('https://pkg.example.com'));
    const cryptifyCalls = calls.filter((c) => c.url.startsWith('https://cryptify.example.com'));
    expect(pkgCalls.length).toBeGreaterThan(0);
    expect(cryptifyCalls.length).toBeGreaterThan(0);

    for (const call of pkgCalls) {
      expect(call.headers).not.toHaveProperty('x-cryptify-source');
    }
    for (const call of cryptifyCalls) {
      expect(call.headers['x-cryptify-source']).toBe('test-channel');
    }
    for (const call of calls) {
      expect(call.headers['x-postguard-client-version']).toBeTruthy();
      expect(call.headers['x-custom']).toBe('y');
    }
  });
});
