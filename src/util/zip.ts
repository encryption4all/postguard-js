import { createFileReadable } from './file.js';

/** Create a ReadableStream of a ZIP archive from files using Conflux */
export async function createZipReadable(files: File[]): Promise<ReadableStream> {
  const { Writer: ConfluxWriter } = await import('@transcend-io/conflux');

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

/** Read filenames from a ZIP file's central directory (no decompression needed) */
export async function readZipFilenames(blob: Blob): Promise<string[]> {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // Find End of Central Directory signature (PK\x05\x06)
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
  const filenames: string[] = [];
  let pos = cdOffset;

  for (let i = 0; i < numEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const filenameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const filename = decoder.decode(bytes.slice(pos + 46, pos + 46 + filenameLen));
    if (!filename.endsWith('/')) filenames.push(filename);
    pos += 46 + filenameLen + extraLen + commentLen;
  }
  return filenames;
}
