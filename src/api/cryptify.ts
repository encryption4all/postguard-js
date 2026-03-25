import { NetworkError } from '../errors.js';

interface FileState {
  token: string;
  uuid: string;
}

export interface InitUploadOptions {
  recipient: string;
  mailContent?: string;
  mailLang?: 'EN' | 'NL';
  confirm?: boolean;
  signal?: AbortSignal;
}

/** Initialize a file upload, returns token and uuid */
export async function initUpload(
  cryptifyUrl: string,
  options: InitUploadOptions
): Promise<FileState> {
  const response = await fetch(`${cryptifyUrl}/fileupload/init`, {
    signal: options.signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm: options.confirm ?? false,
      recipient: options.recipient,
      mailContent: options.mailContent ?? '',
      mailLang: options.mailLang ?? 'EN',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error initializing file upload`, response.status, body);
  }

  const resJson = await response.json();
  const token = response.headers.get('cryptifytoken') as string;
  return { token, uuid: resJson['uuid'] };
}

/** Upload a single chunk */
export async function storeChunk(
  cryptifyUrl: string,
  state: FileState,
  chunk: Uint8Array,
  offset: number,
  signal?: AbortSignal
): Promise<FileState> {
  const response = await fetch(`${cryptifyUrl}/fileupload/${state.uuid}`, {
    signal,
    method: 'PUT',
    headers: {
      cryptifytoken: state.token,
      'Content-Type': 'application/octet-stream',
      'content-range': `bytes ${offset}-${offset + chunk.length}/*`,
    },
    body: new Blob([chunk as BlobPart]),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error uploading chunk`, response.status, body);
  }

  const token = response.headers.get('cryptifytoken') as string;
  return { token, uuid: state.uuid };
}

/** Finalize the upload */
export async function finalizeUpload(
  cryptifyUrl: string,
  state: FileState,
  size: number,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${cryptifyUrl}/fileupload/finalize/${state.uuid}`, {
    signal,
    method: 'POST',
    headers: {
      cryptifytoken: state.token,
      'content-range': `bytes */${size}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error finalizing upload`, response.status, body);
  }
}

/** Download an encrypted file as a ReadableStream */
export async function downloadFile(
  cryptifyUrl: string,
  uuid: string,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${cryptifyUrl}/filedownload/${uuid}`, {
    signal,
    method: 'GET',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new NetworkError(`Error downloading file`, response.status, body);
  }

  if (!response.body) throw new Error('Response body is null');
  return response.body as ReadableStream<Uint8Array>;
}

export interface UploadStream {
  writable: WritableStream<Uint8Array>;
  getUuid: () => string;
}

/** Create a WritableStream that uploads chunks to Cryptify, exposing the UUID */
export function createUploadStream(
  cryptifyUrl: string,
  options: InitUploadOptions & {
    onProgress?: (uploaded: number, last: boolean) => void;
    abortSignal?: AbortSignal;
  }
): UploadStream {
  let state: FileState = { token: '', uuid: '' };
  let processed = 0;
  const signal = options.abortSignal;
  const onProgress = options.onProgress;
  const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });

  const writable = new WritableStream<Uint8Array>(
    {
      async start(c) {
        try {
          state = await initUpload(cryptifyUrl, { ...options, signal });
          onProgress?.(processed, false);
          if (signal?.aborted) throw new Error('Abort signaled during initFile.');
        } catch (e) {
          c.error(e);
        }
      },
      async write(chunk, c) {
        try {
          state = await storeChunk(cryptifyUrl, state, chunk, processed, signal);
          processed += chunk.length;
          onProgress?.(processed, false);
          if (signal?.aborted) throw new Error('Abort signaled during storeChunk.');
        } catch (e) {
          c.error(e);
        }
      },
      async close() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        const combinedSignal = signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal;
        await finalizeUpload(cryptifyUrl, state, processed, combinedSignal);
        onProgress?.(processed, true);
        clearTimeout(timeoutId);
        if (signal?.aborted) throw new Error('Abort signaled during finalize.');
      },
      async abort() {
        // nothing to clean up server-side
      },
    },
    queuingStrategy
  );

  return {
    writable,
    getUuid: () => state.uuid,
  };
}
