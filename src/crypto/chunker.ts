const DEFAULT_CHUNK_SIZE = 5_000_000;

export default class Chunker extends TransformStream<Uint8Array, Uint8Array> {
  constructor(chunkSize: number = DEFAULT_CHUNK_SIZE, offset?: number) {
    let buf = new Uint8Array(chunkSize);
    let bufOffset = 0;
    let firstChunk = true;

    super({
      transform(chunk: Uint8Array, controller: TransformStreamDefaultController) {
        let chunkOffset = 0;
        if (firstChunk) {
          chunkOffset = offset || 0;
          firstChunk = false;
        }
        while (chunkOffset !== chunk.byteLength) {
          const remainingChunk = chunk.byteLength - chunkOffset;
          const remainingBuffer = chunkSize - bufOffset;
          if (remainingChunk >= remainingBuffer) {
            // Fill the current buffer from a view into the chunk (no copy of
            // the slice), enqueue it, then start a fresh buffer. The enqueued
            // buffer is never written to again, so this is a single copy.
            buf.set(chunk.subarray(chunkOffset, chunkOffset + remainingBuffer), bufOffset);
            controller.enqueue(buf);
            buf = new Uint8Array(chunkSize);
            chunkOffset += remainingBuffer;
            bufOffset = 0;
          } else {
            buf.set(chunk.subarray(chunkOffset), bufOffset);
            chunkOffset += remainingChunk;
            bufOffset += remainingChunk;
          }
        }
      },
      flush(controller: TransformStreamDefaultController) {
        controller.enqueue(buf.subarray(0, bufOffset));
      },
    });
  }
}

export interface TransformResult {
  writable: WritableStream<Uint8Array>;
  pipeDone: Promise<void>;
}

export function withTransform(
  writable: WritableStream<Uint8Array>,
  transform: TransformStream<Uint8Array, Uint8Array>,
  signal: AbortSignal
): TransformResult {
  const pipeDone = transform.readable.pipeTo(writable, { signal });
  return { writable: transform.writable, pipeDone };
}
