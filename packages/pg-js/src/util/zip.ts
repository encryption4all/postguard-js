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

  // Feed every file into the ZIP writer, keeping each write's promise plus
  // the close promise. Conflux (and the underlying file reads) surface
  // failures through these promises; the previous fire-and-forget left them
  // unobserved, so a failing source or a conflux error became an unhandled
  // rejection instead of reaching the consumer of `readable`.
  const pending: Promise<void>[] = [];
  for (const f of files) {
    const s = createFileReadable(f);
    pending.push(writer.write({ name: f.name, lastModified: f.lastModified, stream: () => s }));
  }
  pending.push(writer.close());

  // Observe all the writer promises so their rejections can't escape as
  // unhandled. On failure, abort the writer, which errors the linked
  // `readable` so anything piping it (e.g. sealStream in encrypt.ts) sees
  // the failure instead of a silently truncated archive.
  Promise.all(pending).catch((err) => {
    writer.abort(err).catch(() => {
      // abort() rejects when the stream is already errored/closed; the
      // original error is already propagating through `readable`.
    });
  });

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

/** Max concurrent deflate decompressions. Each in-flight entry holds
 *  both its compressed slice and its inflated output in memory; an
 *  unbounded `Promise.all` over a multi-file archive can spike peak
 *  memory well past the archive size. Four is a small cap that still
 *  parallelises across cores for the common case. */
const EXTRACT_CONCURRENCY = 4;

/** Extract all entries from a ZIP blob, returning each as a named Blob.
 *  Directory entries (names ending with '/') are skipped. Supports method
 *  0 (stored) and method 8 (deflate). Reads the underlying buffer once
 *  and unpacks each entry from it. Concurrency is capped (see
 *  EXTRACT_CONCURRENCY) so peak memory scales with the cap, not the
 *  number of entries. */
export async function extractAllZipEntries(blob: Blob): Promise<Array<{ name: string; blob: Blob }>> {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const entries = readCentralDirectory(view, bytes).filter((e) => !e.name.endsWith('/'));

  async function extractOne(entry: typeof entries[number]): Promise<{ name: string; blob: Blob }> {
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
      const stream = new Blob([compressed]).stream().pipeThrough(ds);
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(`Unsupported ZIP compression method: ${entry.method}`);
    }

    // `data` from `arrayBuffer()` carries `Uint8Array<ArrayBufferLike>`,
    // which TS won't unify with `BlobPart` (ArrayBufferLike could be a
    // SharedArrayBuffer). The cast is sound — it can't be shared because
    // we just allocated it from a Response body.
    return { name: entry.name, blob: new Blob([data as BlobPart]) };
  }

  // Bounded worker pool: each worker pulls the next index off a shared
  // counter, so any worker that finishes early picks up the next entry
  // rather than waiting for its sibling slots. Preserves input order in
  // the result array.
  const results: Array<{ name: string; blob: Blob }> = new Array(entries.length);
  let cursor = 0;
  const workerCount = Math.min(EXTRACT_CONCURRENCY, entries.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= entries.length) return;
        results[i] = await extractOne(entries[i]);
      }
    }),
  );
  return results;
}
