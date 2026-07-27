import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Recipient } from '../src/types.js';

// --- Mocks for the encrypt pipeline's external dependencies ---------------
//
// Factories are hoisted above the imports, so shared mock state is wrapped
// in vi.hoisted() and referenced from each factory.
const { fetchMPK, resolveSigningKeys, createUploadStream, createZipReadable, sealStream } =
  vi.hoisted(() => ({
    fetchMPK: vi.fn(),
    resolveSigningKeys: vi.fn(),
    createUploadStream: vi.fn(),
    createZipReadable: vi.fn(),
    sealStream: vi.fn(),
  }));

vi.mock('../src/api/pkg.js', () => ({ fetchMPK }));
vi.mock('../src/crypto/signing.js', () => ({ resolveSigningKeys }));
vi.mock('../src/api/cryptify.js', () => ({ createUploadStream }));
vi.mock('../src/util/zip.js', () => ({ createZipReadable }));
vi.mock('../src/util/wasm.js', () => ({ loadWasm: async () => ({ sealStream }) }));

import { encryptPipeline, sealRaw, awaitAllOrAbort } from '../src/crypto/encrypt.js';

const emailRecipient = (email: string): Recipient =>
  ({ email, _baseType: 'email', _extras: [] } as unknown as Recipient);

/** A readable that emits the given chunks then closes. */
function readableOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(chunk);
      c.close();
    },
  });
}

describe('awaitAllOrAbort', () => {
  it('resolves and never aborts when both promises resolve', async () => {
    const ac = new AbortController();
    const spy = vi.spyOn(ac, 'abort');
    await expect(
      awaitAllOrAbort(Promise.resolve(), Promise.resolve(), ac)
    ).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    expect(ac.signal.aborted).toBe(false);
  });

  it('aborts the controller and re-throws when the seal side fails first', async () => {
    const ac = new AbortController();
    const err = new Error('seal failed');
    // The pipe side is in flight and settles once the abort reaches it —
    // mirroring the real teardown where aborting tears down the loser.
    const pipe = new Promise<void>((resolve) => {
      ac.signal.addEventListener('abort', () => resolve());
    });
    await expect(awaitAllOrAbort(Promise.reject(err), pipe, ac)).rejects.toBe(err);
    expect(ac.signal.aborted).toBe(true);
    expect(ac.signal.reason).toBe(err);
  });

  it('aborts the controller and re-throws when the pipe side fails first', async () => {
    const ac = new AbortController();
    const err = new Error('upload failed');
    const seal = new Promise<void>((resolve) => {
      ac.signal.addEventListener('abort', () => resolve());
    });
    await expect(awaitAllOrAbort(seal, Promise.reject(err), ac)).rejects.toBe(err);
    expect(ac.signal.aborted).toBe(true);
    expect(ac.signal.reason).toBe(err);
  });

  it('re-throws only the FIRST error and swallows the loser rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const ac = new AbortController();
      const first = new Error('first');
      const second = new Error('second');
      // seal rejects immediately; pipe rejects a macrotask later (the loser).
      const pipe = new Promise<void>((_, reject) => setTimeout(() => reject(second), 0));
      await expect(awaitAllOrAbort(Promise.reject(first), pipe, ac)).rejects.toBe(first);
      // Let the loser's late rejection settle; awaitAllOrAbort must have
      // observed it so it never surfaces as an unhandled rejection.
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('falls back to a parameterless abort when abort(reason) throws', async () => {
    const ac = new AbortController();
    const err = new Error('boom');
    const spy = vi
      .spyOn(ac, 'abort')
      .mockImplementationOnce(() => {
        throw new Error('env rejects this reason');
      })
      .mockImplementationOnce(() => {});
    await expect(awaitAllOrAbort(Promise.reject(err), Promise.resolve(), ac)).rejects.toBe(err);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, err);
    expect(spy).toHaveBeenNthCalledWith(2);
  });
});

describe('encryptPipeline', () => {
  const baseOptions = () => ({
    pkgUrl: 'https://pkg.example.com',
    cryptifyUrl: 'https://cryptify.example.com',
    sign: { type: 'apiKey' as const, apiKey: 'PG-test' },
    files: [new File([new Uint8Array([1, 2, 3])], 'a.bin')],
    recipients: [emailRecipient('alice@example.com')],
    // Pre-supply keys so resolveSigningKeys isn't required.
    signingKeys: { pubSignKey: 'PUB', privSignKey: 'PRIV', senderEmail: 'me@example.com' },
  });

  beforeEach(() => {
    fetchMPK.mockResolvedValue('MPK');
    createZipReadable.mockImplementation(async () =>
      readableOf([new Uint8Array([9, 9])])
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('seals, chunks and uploads on the happy path and returns the upload uuid', async () => {
    const uploaded: Uint8Array[] = [];
    // Upload sink collects every chunk it receives.
    createUploadStream.mockImplementation(() => ({
      writable: new WritableStream<Uint8Array>({
        write(chunk) {
          uploaded.push(chunk);
        },
      }),
      getUuid: () => 'uuid-123',
    }));

    // The real sealStream pipes plaintext -> ciphertext into `writable`;
    // the mock forwards its readable straight through then closes.
    sealStream.mockImplementation(
      async (
        _mpk: unknown,
        _opts: unknown,
        readable: ReadableStream<Uint8Array>,
        writable: WritableStream<Uint8Array>
      ) => {
        await readable.pipeTo(writable);
      }
    );

    const result = await encryptPipeline(baseOptions());

    expect(result).toEqual({ uuid: 'uuid-123' });
    // seal -> chunk -> upload actually carried the ZIP bytes through.
    expect(sealStream).toHaveBeenCalledTimes(1);
    expect(sealStream.mock.calls[0][0]).toBe('MPK');
    const merged = Buffer.concat(uploaded.map((c) => Buffer.from(c)));
    expect([...merged]).toEqual([9, 9]);
  });

  it('propagates an upload-sink failure and aborts the shared signal driving the stream graph', async () => {
    const uploadErr = new Error('cryptify write failed');
    let capturedSignal: AbortSignal | undefined;

    // Upload sink errors on the first chunk it is asked to write, and
    // records the abort signal the pipeline wires through to it.
    createUploadStream.mockImplementation((_url: string, opts: { abortSignal?: AbortSignal }) => {
      capturedSignal = opts.abortSignal;
      return {
        writable: new WritableStream<Uint8Array>({
          write() {
            throw uploadErr;
          },
        }),
        getUuid: () => 'uuid-abort',
      };
    });

    sealStream.mockImplementation(
      async (
        _mpk: unknown,
        _opts: unknown,
        readable: ReadableStream<Uint8Array>,
        writable: WritableStream<Uint8Array>
      ) => {
        // The downstream failure propagates back through the chunker, so
        // this either rejects or resolves before the pipe side reports
        // the error; both are valid — the pipeline re-throws the first.
        await readable.pipeTo(writable).catch(() => {});
      }
    );

    await expect(encryptPipeline(baseOptions())).rejects.toThrow('cryptify write failed');
    // awaitAllOrAbort aborted the controller on the first failure, so the
    // signal feeding the upload / stream graph (the "other" side) is torn down.
    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe('sealRaw', () => {
  beforeEach(() => {
    fetchMPK.mockResolvedValue('MPK');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('seals a Uint8Array payload and returns the concatenated ciphertext', async () => {
    // The mock "encrypts" by writing two fixed chunks, ignoring the input.
    sealStream.mockImplementation(
      async (
        _mpk: unknown,
        _opts: unknown,
        _readable: ReadableStream<Uint8Array>,
        writable: WritableStream<Uint8Array>
      ) => {
        const w = writable.getWriter();
        await w.write(new Uint8Array([1, 2]));
        await w.write(new Uint8Array([3]));
        await w.close();
      }
    );

    const out = await sealRaw({
      pkgUrl: 'https://pkg.example.com',
      sign: { type: 'apiKey', apiKey: 'PG-test' },
      recipients: [emailRecipient('alice@example.com')],
      data: new Uint8Array([42]),
      signingKeys: { pubSignKey: 'PUB', privSignKey: 'PRIV', senderEmail: 'me@example.com' },
    });

    expect(out).toBeInstanceOf(Uint8Array);
    expect([...out]).toEqual([1, 2, 3]);
    expect(sealStream).toHaveBeenCalledTimes(1);
    expect(sealStream.mock.calls[0][0]).toBe('MPK');
  });
});
