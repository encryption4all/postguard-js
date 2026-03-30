import { describe, it, expect } from 'vitest';
import { readZipFilenames } from '../src/util/zip.js';

// Minimal valid ZIP with one file "hello.txt" (empty content)
// Built by hand: local file header + central directory + EOCD
function createMinimalZip(filenames: string[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const name of filenames) {
    const nameBytes = encoder.encode(name);

    // Local file header (30 + name length)
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // signature
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(26, nameBytes.length, true); // filename length
    local.set(nameBytes, 30);
    parts.push(local);

    // Central directory entry (46 + name length)
    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); // signature
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(28, nameBytes.length, true); // filename length
    centralView.setUint32(42, localOffset, true); // relative offset
    central.set(nameBytes, 46);
    centralParts.push(central);

    localOffset += local.length;
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
  eocdView.setUint16(8, filenames.length, true); // entries on this disk
  eocdView.setUint16(10, filenames.length, true); // total entries
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
    const zip = createMinimalZip(['hello.txt', 'world.txt']);
    const names = await readZipFilenames(zip);
    expect(names).toEqual(['hello.txt', 'world.txt']);
  });

  it('skips directory entries', async () => {
    const zip = createMinimalZip(['dir/', 'dir/file.txt']);
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
