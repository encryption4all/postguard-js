import { describe, it, expect } from 'vitest';
import Chunker from '../src/crypto/chunker.js';

async function pipeAndCollect(
  chunker: Chunker,
  inputs: Uint8Array[]
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];

  // Read and write concurrently to avoid backpressure deadlock
  const readPromise = (async () => {
    const reader = chunker.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();

  const writer = chunker.writable.getWriter();
  for (const input of inputs) {
    await writer.write(input);
  }
  await writer.close();

  await readPromise;
  return chunks;
}

describe('Chunker', () => {
  it('splits data into fixed-size chunks', async () => {
    const chunker = new Chunker(4);
    const chunks = await pipeAndCollect(chunker, [
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ]);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(chunks[1]).toEqual(new Uint8Array([5, 6, 7, 8]));
    expect(chunks[2]).toEqual(new Uint8Array([9, 10]));
  });

  it('handles input smaller than chunk size', async () => {
    const chunker = new Chunker(16);
    const chunks = await pipeAndCollect(chunker, [new Uint8Array([1, 2, 3])]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('handles exact chunk size input', async () => {
    const chunker = new Chunker(4);
    const chunks = await pipeAndCollect(chunker, [new Uint8Array([1, 2, 3, 4])]);

    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('accumulates multiple small writes', async () => {
    const chunker = new Chunker(4);
    const chunks = await pipeAndCollect(chunker, [
      new Uint8Array([1, 2]),
      new Uint8Array([3, 4]),
      new Uint8Array([5]),
    ]);

    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(chunks[1]).toEqual(new Uint8Array([5]));
  });

  it('fills a chunk from data spanning multiple transform calls', async () => {
    // Each output chunk is assembled from bytes delivered across several
    // writes, and individual writes straddle the chunk boundary.
    const chunker = new Chunker(4);
    const chunks = await pipeAndCollect(chunker, [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6, 7, 8]),
      new Uint8Array([9, 10]),
    ]);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(chunks[1]).toEqual(new Uint8Array([5, 6, 7, 8]));
    expect(chunks[2]).toEqual(new Uint8Array([9, 10]));
  });

  it('does not alias buffers across emitted chunks', async () => {
    // Regression guard: emitted chunks must be independent allocations, so a
    // later fill can never mutate an already-enqueued chunk.
    const chunker = new Chunker(2);
    const chunks = await pipeAndCollect(chunker, [
      new Uint8Array([1, 2, 3, 4]),
    ]);

    expect(chunks[0]).toEqual(new Uint8Array([1, 2]));
    expect(chunks[1]).toEqual(new Uint8Array([3, 4]));
    // Mutating the second chunk must not touch the first.
    chunks[1].set([9, 9]);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2]));
  });

  it('respects offset on first chunk', async () => {
    const chunker = new Chunker(4, 2);
    const chunks = await pipeAndCollect(chunker, [
      new Uint8Array([1, 2, 3, 4, 5, 6]),
    ]);

    // Offset=2 skips first 2 bytes of first write, so [3,4,5,6] fills one chunk
    expect(chunks[0]).toEqual(new Uint8Array([3, 4, 5, 6]));
  });
});
