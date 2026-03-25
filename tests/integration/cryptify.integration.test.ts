import { describe, it, expect } from 'vitest';
import { initUpload, storeChunk, finalizeUpload, downloadFile } from '../../src/api/cryptify.js';

const CRYPTIFY_URL = process.env.CRYPTIFY_URL ?? 'http://localhost:8000';

describe('Cryptify API (integration)', () => {
  it('uploads and downloads a file', async () => {
    // 1. Initialize upload
    const initResult = await initUpload(CRYPTIFY_URL, {
      recipient: 'test@example.com',
    });
    expect(initResult.uuid).toBeTruthy();
    expect(initResult.token).toBeTruthy();

    // 2. Upload a chunk
    const data = new Uint8Array(256);
    for (let i = 0; i < data.length; i++) data[i] = i % 256;

    let state = initResult;
    state = await storeChunk(CRYPTIFY_URL, state, data, 0);
    expect(state.token).toBeTruthy();

    // 3. Finalize
    await finalizeUpload(CRYPTIFY_URL, state, data.length);

    // 4. Download and verify
    const stream = await downloadFile(CRYPTIFY_URL, initResult.uuid);
    expect(stream).toBeDefined();

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const downloaded = new Uint8Array(
      chunks.reduce((acc, c) => acc + c.length, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      downloaded.set(chunk, offset);
      offset += chunk.length;
    }

    expect(downloaded.length).toBe(data.length);
    expect(downloaded).toEqual(data);
  });

  it('uploads multiple chunks', async () => {
    const state = await initUpload(CRYPTIFY_URL, {
      recipient: 'multi@example.com',
    });

    const chunk1 = new Uint8Array(1024).fill(0xaa);
    const chunk2 = new Uint8Array(1024).fill(0xbb);

    let current = state;
    current = await storeChunk(CRYPTIFY_URL, current, chunk1, 0);
    current = await storeChunk(CRYPTIFY_URL, current, chunk2, chunk1.length);

    await finalizeUpload(CRYPTIFY_URL, current, chunk1.length + chunk2.length);

    // Download and verify total size
    const stream = await downloadFile(CRYPTIFY_URL, state.uuid);
    const reader = stream.getReader();
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
    }

    expect(totalSize).toBe(2048);
  });
});
