import { createFileReadable } from './file.js';

/** Conflux's bigint.js does `if (!self.BigInt && !self.JSBI)` at module
 *  load. `self` is browser-only; Bun and Deno alias it to globalThis, but
 *  Node doesn't, so importing conflux on Node throws "self is not
 *  defined". Set `self` only for the duration of the import and restore
 *  the prior state afterwards so we don't permanently rewrite a global
 *  that other libraries use as a browser-detection heuristic. The check
 *  runs once per module-evaluation; after the module is cached the
 *  runtime no longer references the bare `self`. */
async function importConfluxWithSelfShim(): Promise<typeof import('@transcend-io/conflux')> {
  const g = globalThis as Record<string, unknown>;
  const had = Object.prototype.hasOwnProperty.call(g, 'self');
  const prior = g.self;
  if (!had || prior === undefined) g.self = globalThis;
  try {
    return await import('@transcend-io/conflux');
  } finally {
    if (!had) delete g.self;
    else g.self = prior;
  }
}

/** Create a ReadableStream of a ZIP archive from files using Conflux */
export async function createZipReadable(files: File[]): Promise<ReadableStream> {
  const { Writer: ConfluxWriter } = await importConfluxWithSelfShim();

  const zipTransform = new ConfluxWriter();
  const readable = zipTransform.readable as ReadableStream;
  const writable = zipTransform.writable;
  const writer = writable.getWriter();

  for (const f of files) {
    const s = createFileReadable(f);
    writer.write({ name: f.name, lastModified: f.lastModified, stream: () => s });
  }
  writer.close();

  return readable;
}

interface CentralDirEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  lfhOffset: number;
}

function readCentralDirectory(view: DataView, bytes: Uint8Array): CentralDirEntry[] {
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return [];

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const numEntries = view.getUint16(eocdOffset + 10, true);
  const decoder = new TextDecoder('utf-8');
  const entries: CentralDirEntry[] = [];
  let pos = cdOffset;

  for (let i = 0; i < numEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const filenameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const lfhOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.slice(pos + 46, pos + 46 + filenameLen));
    entries.push({ name, method, compressedSize, uncompressedSize, lfhOffset });
    pos += 46 + filenameLen + extraLen + commentLen;
  }
  return entries;
}

/** Read filenames from a ZIP file's central directory (no decompression needed) */
export async function readZipFilenames(blob: Blob): Promise<string[]> {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  return readCentralDirectory(view, bytes)
    .filter((e) => !e.name.endsWith('/'))
    .map((e) => e.name);
}

/** Extract a single named entry from a ZIP blob, returning the uncompressed bytes.
 *  Uses the central directory for sizes (conflux's streaming writer leaves
 *  `compressedSize: 0` in the LFH, so LFH-only walking won't work). Supports
 *  method 0 (stored) and method 8 (deflate). */
export async function extractZipEntry(blob: Blob, name: string): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const entry = readCentralDirectory(view, bytes).find((e) => e.name === name);
  if (!entry) throw new Error(`ZIP entry not found: ${name}`);

  // Local file header: 30 bytes + filenameLen + extraLen, then file data.
  // LFH filename/extra lengths can differ from the CDR's, so re-read them here.
  const lfh = entry.lfhOffset;
  if (view.getUint32(lfh, true) !== 0x04034b50) {
    throw new Error(`Invalid local file header at offset ${lfh}`);
  }
  const lfhFilenameLen = view.getUint16(lfh + 26, true);
  const lfhExtraLen = view.getUint16(lfh + 28, true);
  const dataStart = lfh + 30 + lfhFilenameLen + lfhExtraLen;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) {
    return compressed;
  }
  if (entry.method === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([compressed]).stream().pipeThrough(ds);
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return out;
  }
  throw new Error(`Unsupported ZIP compression method: ${entry.method}`);
}

/** Extract all entries from a ZIP blob, returning each as a named Blob.
 *  Directory entries (names ending with '/') are skipped. Supports method
 *  0 (stored) and method 8 (deflate). Reads the underlying buffer once
 *  and unpacks each entry from it. */
export async function extractAllZipEntries(blob: Blob): Promise<Array<{ name: string; blob: Blob }>> {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const entries = readCentralDirectory(view, bytes).filter((e) => !e.name.endsWith('/'));

  return Promise.all(
    entries.map(async (entry) => {
      const lfh = entry.lfhOffset;
      if (view.getUint32(lfh, true) !== 0x04034b50) {
        throw new Error(`Invalid local file header at offset ${lfh}`);
      }
      const lfhFilenameLen = view.getUint16(lfh + 26, true);
      const lfhExtraLen = view.getUint16(lfh + 28, true);
      const dataStart = lfh + 30 + lfhFilenameLen + lfhExtraLen;
      const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);

      let data: Uint8Array;
      if (entry.method === 0) {
        data = compressed;
      } else if (entry.method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(ds);
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error(`Unsupported ZIP compression method: ${entry.method}`);
      }

      return { name: entry.name, blob: new Blob([data as BlobPart]) };
    }),
  );
}
