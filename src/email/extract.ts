import type { ExtractCiphertextOptions } from '../types.js';

export const PG_ARMOR_BEGIN = '-----BEGIN POSTGUARD MESSAGE-----';
export const PG_ARMOR_END = '-----END POSTGUARD MESSAGE-----';
export const PG_ARMOR_DIV_ID = 'postguard-armor';
export const PG_MAX_URL_FRAGMENT_SIZE = 100_000;

/** Extract ciphertext from a received email (attachment or armored payload in HTML body) */
export function extractCiphertext(options: ExtractCiphertextOptions): Uint8Array | null {
  // Primary: look for postguard.encrypted attachment
  if (options.attachments) {
    const pgAtt = options.attachments.find((att) => att.name === 'postguard.encrypted');
    if (pgAtt) {
      return new Uint8Array(pgAtt.data);
    }
  }

  // Fallback: extract armored payload from HTML body
  if (options.htmlBody) {
    const base64 = extractArmoredPayload(options.htmlBody);
    if (base64) {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  }

  return null;
}

/** Extract base64-encoded payload from PostGuard armor block in HTML */
export function extractArmoredPayload(html: string): string | null {
  const regex = new RegExp(
    PG_ARMOR_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '\\s*([A-Za-z0-9+/=\\s]+?)\\s*' +
      PG_ARMOR_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const match = html.match(regex);
  if (!match) return null;
  return match[1].replace(/\s/g, '');
}

/** Wrap base64 in PostGuard armor block */
export function armorBase64(base64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.substring(i, i + 76));
  }
  return `${PG_ARMOR_BEGIN}\n${lines.join('\n')}\n${PG_ARMOR_END}`;
}

/** Convert standard base64 to URL-safe base64 */
export function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
