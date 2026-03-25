const DEFAULT_CHUNK_SIZE = 1024 * 1024;

/** Create a ReadableStream from a File, reading in chunks */
export function createFileReadable(file: File, chunkSize = DEFAULT_CHUNK_SIZE): ReadableStream<Uint8Array> {
  let offset = 0;
  const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });

  return new ReadableStream(
    {
      async pull(cntrl) {
        if (cntrl.desiredSize !== null && cntrl.desiredSize <= 0) return;
        const read = await file.slice(offset, offset + chunkSize).arrayBuffer();
        if (read.byteLength === 0) return cntrl.close();
        offset += chunkSize;
        cntrl.enqueue(new Uint8Array(read));
      },
    },
    queuingStrategy
  );
}
