import type {
  PostGuardConfig,
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
  /** @internal */
  constructor(private readonly config: PostGuardConfig) {}

  /** Build an inner MIME message for encryption */
  buildMime(options: BuildMimeOptions): Uint8Array {
    return buildMimeImpl(options);
  }

  /** Create an encrypted email envelope. Encrypts the Sealed data,
   *  builds placeholder HTML with fallback decrypt links, and creates the attachment.
   *  Auto-uploads to Cryptify if the payload is too large for email embedding. */
  async createEnvelope(options: CreateEnvelopeOptions): Promise<EnvelopeResult> {
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
