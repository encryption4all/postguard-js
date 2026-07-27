import type { ExtractCiphertextOptions } from '../types.js';

/** Tier 1 cap (chars of base64). At/below this size the entire ciphertext
 *  fits in the recipient-side URL fragment so no Cryptify upload is needed. */
export const PG_MAX_URL_FRAGMENT_SIZE = 100_000;

/** Tier 2/3 boundary in *binary* bytes of ciphertext. At or below this we
 *  ship the encrypted bytes as a local message attachment. Above it the
 *  attachment is omitted and the recipient relies on the Cryptify link.
 *  10 MB is comfortably below typical 25 MB Exchange tenant message-size
 *  limits while keeping a reasonable amount of mail self-contained. */
export const PG_MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Extract ciphertext from a received email by looking for the
 *  `postguard.encrypted` attachment. Body-armor extraction is no longer
 *  supported — older messages with an armored block in the HTML body must
 *  also have shipped the matching attachment, and Tier 3 messages
 *  intentionally have no attachment (recipients use the Cryptify link
 *  in the body, surfaced via `extractUploadUuid`). */
export function extractCiphertext(options: ExtractCiphertextOptions): Uint8Array | null {
  if (options.attachments) {
    const pgAtt = options.attachments.find((att) => att.name === 'postguard.encrypted');
    if (pgAtt) {
      return new Uint8Array(pgAtt.data);
    }
  }
  return null;
}

/** Convert standard base64 to URL-safe base64 */
export function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Find a Cryptify UUID embedded in an email body. Looks for either of the
 *  recipient routes `<websiteUrl>/decrypt?uuid=…` or
 *  `<websiteUrl>/download?uuid=…` produced by createEnvelope's tier 2/3
 *  paths. Returns the UUID or null. */
export function extractUploadUuid(html: string): string | null {
  if (!html) return null;
  const match = html.match(/[?&]uuid=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}
