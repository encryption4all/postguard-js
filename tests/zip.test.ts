import { describe, it, expect } from 'vitest';
import { readZipFilenames, extractZipEntry } from '../src/util/zip.js';

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Build a single-entry ZIP with method=8 (deflate). Mirrors the streaming-mode
// shape conflux produces: LFH carries compressedSize=0 and uncompressedSize=0,
// while the CDR holds the real sizes (extractZipEntry must read from the CDR).
async function createStreamingDeflateZip(name: string, content: Uint8Array): Promise<Blob> {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name);
  const compressed = await deflateRaw(content);

  // Local file header — streaming-mode: sizes left at 0, bit 3 set in flags.
  const local = new Uint8Array(30 + nameBytes.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(6, 0x0008, true); // bit 3: sizes in data descriptor
  localView.setUint16(8, 8, true); // method = deflate
  localView.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);

  const localOffset = 0;
  const cdOffset = local.length + compressed.length;

  // Central directory — sizes populated here.
  const central = new Uint8Array(46 + nameBytes.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(8, 0x0008, true);
  centralView.setUint16(10, 8, true);
  centralView.setUint32(20, compressed.length, true);
  centralView.setUint32(24, content.length, true);
  centralView.setUint16(28, nameBytes.length, true);
  centralView.setUint32(42, localOffset, true);
  central.set(nameBytes, 46);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, 1, true);
  eocdView.setUint16(10, 1, true);
  eocdView.setUint32(12, central.length, true);
  eocdView.setUint32(16, cdOffset, true);

  return new Blob([local, compressed, central, eocd]);
}

// Minimal valid ZIP with stored (method 0) entries.
// Built by hand: local file header + data + central directory + EOCD
function createMinimalZip(entries: Array<{ name: string; content?: Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const { name, content } of entries) {
    const nameBytes = encoder.encode(name);
    const data = content ?? new Uint8Array(0);

    // Local file header (30 + name length)
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // signature
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(8, 0, true); // method = stored
    localView.setUint32(18, data.length, true); // compressed size
    localView.setUint32(22, data.length, true); // uncompressed size
    localView.setUint16(26, nameBytes.length, true); // filename length
    local.set(nameBytes, 30);
    parts.push(local);
    parts.push(data);

    // Central directory entry (46 + name length)
    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); // signature
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(10, 0, true); // method = stored
    centralView.setUint32(20, data.length, true); // compressed size
    centralView.setUint32(24, data.length, true); // uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // filename length
    centralView.setUint32(42, localOffset, true); // relative offset
    central.set(nameBytes, 46);
    centralParts.push(central);

    localOffset += local.length + data.length;
  }

  const cdOffset = localOffset;
  let cdSize = 0;
  for (const c of centralParts) {
    parts.push(c);
    cdSize += c.length;
  }

  // End of central directory (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // signature
  eocdView.setUint16(8, entries.length, true); // entries on this disk
  eocdView.setUint16(10, entries.length, true); // total entries
  eocdView.setUint32(12, cdSize, true); // size of central dir
  eocdView.setUint32(16, cdOffset, true); // offset of central dir
  parts.push(eocd);

  const totalLength = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }

  return new Blob([result]);
}

describe('readZipFilenames', () => {
  it('extracts filenames from a valid ZIP', async () => {
    const zip = createMinimalZip([{ name: 'hello.txt' }, { name: 'world.txt' }]);
    const names = await readZipFilenames(zip);
    expect(names).toEqual(['hello.txt', 'world.txt']);
  });

  it('skips directory entries', async () => {
    const zip = createMinimalZip([{ name: 'dir/' }, { name: 'dir/file.txt' }]);
    const names = await readZipFilenames(zip);
    expect(names).toEqual(['dir/file.txt']);
  });

  it('returns empty array for invalid data', async () => {
    const blob = new Blob([new Uint8Array([0, 0, 0, 0])]);
    const names = await readZipFilenames(blob);
    expect(names).toEqual([]);
  });

  it('returns empty array for empty blob', async () => {
    const blob = new Blob([]);
    const names = await readZipFilenames(blob);
    expect(names).toEqual([]);
  });
});

describe('extractZipEntry', () => {
  it('returns the exact bytes of a stored entry', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const zip = createMinimalZip([{ name: 'data.bin', content: payload }]);
    const out = await extractZipEntry(zip, 'data.bin');
    expect(out).toEqual(payload);
  });

  it('round-trips bytes through a streaming-mode deflate zip (conflux-shape)', async () => {
    const payload = new Uint8Array(4096);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 37 + (i % 13)) & 0xff;

    const blob = await createStreamingDeflateZip('data.bin', payload);
    expect(await readZipFilenames(blob)).toEqual(['data.bin']);

    const out = await extractZipEntry(blob, 'data.bin');
    expect(out).toEqual(payload);
  });

  it('throws when the named entry is absent', async () => {
    const zip = createMinimalZip([{ name: 'data.bin', content: new Uint8Array([1]) }]);
    await expect(extractZipEntry(zip, 'missing.bin')).rejects.toThrow(/not found/);
  });
});
