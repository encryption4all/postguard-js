import type {
  BuildMimeOptions,
  CreateEnvelopeOptions,
  EnvelopeResult,
  ExtractCiphertextOptions,
} from '../types.js';
import { buildMime as buildMimeImpl, injectMimeHeaders as injectMimeHeadersImpl } from './mime.js';
import { createEnvelope as createEnvelopeImpl } from './envelope.js';
import { extractCiphertext as extractCiphertextImpl } from './extract.js';

/** Email helpers for PostGuard-encrypted email integration */
export class EmailHelpers {
  /** Build an inner MIME message for encryption */
  buildMime(options: BuildMimeOptions): Uint8Array {
    return buildMimeImpl(options);
  }

  /** Create an encrypted email envelope (placeholder HTML + attachment) */
  createEnvelope(options: CreateEnvelopeOptions): EnvelopeResult {
    return createEnvelopeImpl(options);
  }

  /** Extract ciphertext from a received email (attachment or armored body) */
  extractCiphertext(options: ExtractCiphertextOptions): Uint8Array | null {
    return extractCiphertextImpl(options);
  }

  /** Inject headers into a MIME message, optionally removing existing ones first */
  injectMimeHeaders(
    mime: string,
    headersToInject: Record<string, string>,
    headersToRemove?: string[]
  ): string {
    return injectMimeHeadersImpl(mime, headersToInject, headersToRemove);
  }
}
