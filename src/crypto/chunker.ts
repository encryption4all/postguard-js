const DEFAULT_CHUNK_SIZE = 1024 * 1024;

export default class Chunker extends TransformStream<Uint8Array, Uint8Array> {
  constructor(chunkSize: number = DEFAULT_CHUNK_SIZE, offset?: number) {
    let buf = new ArrayBuffer(chunkSize);
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
            new Uint8Array(buf).set(
              chunk.slice(chunkOffset, chunkOffset + remainingBuffer),
              bufOffset
            );
            const copy = new Uint8Array(chunkSize);
            copy.set(new Uint8Array(buf));
            controller.enqueue(copy);
            chunkOffset += remainingBuffer;
            bufOffset = 0;
          } else {
            new Uint8Array(buf).set(chunk.slice(chunkOffset), bufOffset);
            chunkOffset += remainingChunk;
            bufOffset += remainingChunk;
          }
        }
      },
      flush(controller: TransformStreamDefaultController) {
        controller.enqueue(new Uint8Array(buf, 0, bufOffset));
      },
    });
  }
}

export function withTransform(
  writable: WritableStream<Uint8Array>,
  transform: TransformStream<Uint8Array, Uint8Array>,
  signal: AbortSignal
): WritableStream<Uint8Array> {
  transform.readable.pipeTo(writable, { signal }).catch((err) => {
    console.error('Error in withTransform pipe:', err);
  });
  return transform.writable;
}
