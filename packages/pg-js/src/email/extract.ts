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

/** The attachment name every PostGuard envelope uses for the ciphertext, and
 *  the marker installed mail clients key on. `createEnvelope` writes it and
 *  every reader matches on it, so it is one constant rather than a literal
 *  repeated across the SDK and both add-ins. Renaming it is a breaking change
 *  for every message already delivered. */
export const POSTGUARD_ENCRYPTED_FILENAME = 'postguard.encrypted';

const ARMOR_BEGIN = '-----BEGIN POSTGUARD MESSAGE-----';
const ARMOR_END = '-----END POSTGUARD MESSAGE-----';

/** Extract ciphertext from a received email by looking for the
 *  `postguard.encrypted` attachment.
 *
 *  This does NOT look at the body. pg-js >= 1.1 stopped *emitting* the
 *  in-body armor block, and messages written before that also shipped the
 *  attachment, so the attachment is the only path a message this function is
 *  given needs. Tier 3 messages intentionally have no attachment at all —
 *  recipients use the Cryptify link, surfaced via `extractUploadUuid`.
 *
 *  For an archived message that carries *only* an armor block, use
 *  `extractArmoredCiphertext` on the body. That path is separate on purpose:
 *  it takes a string rather than attachments, and COMPATIBILITY.md's archival
 *  guarantee is why it still exists at all. */
export function extractCiphertext(options: ExtractCiphertextOptions): Uint8Array | null {
  if (options.attachments) {
    const pgAtt = options.attachments.find((att) => att.name === POSTGUARD_ENCRYPTED_FILENAME);
    if (pgAtt) {
      return new Uint8Array(pgAtt.data);
    }
  }
  return null;
}

/** Recover base64 ciphertext from an in-body ASCII armor block.
 *
 *  ARCHIVAL ONLY. Nothing has emitted this since pg-js 1.1 — it was dropped
 *  because it pushed bodies past Outlook's 1 M-char `setAsync` limit, and that
 *  drop is what broke Thunderbird detection in postguard-tb-addon#85. It stays
 *  readable because COMPATIBILITY.md's archival guarantee is unconditional:
 *  "read support for stored artifacts is not part of this window; it never
 *  drops, whatever happens to the SDK version that wrote the bytes."
 *
 *  Do not add a caller that produces armor. Removing this function silently is
 *  the same class of change as the one that caused tb#85, in the other
 *  direction.
 *
 *  Returns the base64 payload with whitespace and any wrapping HTML tags
 *  stripped, or null when no complete block is present. */
export function extractArmoredCiphertext(htmlOrText: string): string | null {
  if (!htmlOrText) return null;
  const begin = htmlOrText.indexOf(ARMOR_BEGIN);
  if (begin < 0) return null;
  const end = htmlOrText.indexOf(ARMOR_END, begin);
  if (end < 0) return null;
  const block = htmlOrText.slice(begin + ARMOR_BEGIN.length, end);
  return block.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
}

/** True when an armor BEGIN marker is present, whether or not a complete block
 *  follows. Lets a reader tell "this is a PostGuard message I cannot parse"
 *  from "this is not a PostGuard message" and report the difference, rather
 *  than failing silently. Archival only, as `extractArmoredCiphertext`. */
export function looksLikeArmoredPostGuard(htmlOrText: string): boolean {
  if (!htmlOrText) return false;
  return htmlOrText.indexOf(ARMOR_BEGIN) >= 0;
}

/** Convert standard base64 to URL-safe base64 */
export function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** What a host has to gather about a message before PostGuard can classify it.
 *  Both add-ins can produce this from their own API — `browser.messages
 *  .listAttachments` in Thunderbird, `Office.context.mailbox.item` in Outlook —
 *  and neither needs to know what makes a message PostGuard. */
export interface DetectPostGuardInput {
  /** Attachment names on the message, in any order. */
  attachmentNames?: string[];
  /** The message's HTML body, if the host can supply it cheaply. */
  htmlBody?: string;
}

/** Decide whether a message is a PostGuard envelope the recipient can act on.
 *
 *  The three tiers do not look alike, and every host has to handle all three:
 *  tier 1 and 2 carry the `postguard.encrypted` attachment, while tier 3 has
 *  no attachment at all and is recognisable only by the Cryptify link in the
 *  body. A host that checks the attachment alone silently fails to detect
 *  every tier-3 message — the asymmetry behind #39.
 *
 *  Archived messages carrying only an in-body armor block also count: see
 *  `extractArmoredCiphertext` for why that path is still supported. */
export function detectPostGuard(input: DetectPostGuardInput): boolean {
  if (input.attachmentNames?.some((name) => name === POSTGUARD_ENCRYPTED_FILENAME)) {
    return true;
  }
  if (input.htmlBody) {
    if (extractUploadUuid(input.htmlBody) !== null) return true;
    if (looksLikeArmoredPostGuard(input.htmlBody)) return true;
  }
  return false;
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
