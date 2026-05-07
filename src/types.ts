import type { FriendlySender } from './util/identity.js';

// --- Config ---

/** Configuration for the PostGuard client */
export interface PostGuardConfig {
  pkgUrl: string;
  cryptifyUrl?: string;
  headers?: HeadersInit;
  /** Size (in bytes) of each chunk sent during upload. Defaults to 5 000 000 (5 MB). */
  uploadChunkSize?: number;
  /**
   * Retry behaviour for Cryptify chunk uploads and downloads. Failed chunk
   * PUTs and download GETs are retried with exponential backoff + full
   * jitter. 4xx responses (including the structured `upload_session_not_found`
   * 404) and caller-driven aborts are not retried.
   */
  retry?: import('./util/retry.js').RetryOptions;
}

// --- Recipients ---

import { RecipientBuilder } from './recipients/builder.js';

export type Recipient = RecipientBuilder;

// --- Signing ---

/** Signing via API key (PostGuard for Business) */
export interface ApiKeySign {
  type: 'apiKey';
  apiKey: string;
}

/** Signing via Yivi session (peer-to-peer) */
export interface YiviSign {
  type: 'yivi';
  element: string;
  senderEmail?: string;
  /** Additional attributes to request in the Yivi session (e.g. name).
   *  Email is always included automatically. Mark as optional to let the user skip. */
  attributes?: { t: string; v?: string; optional?: boolean }[];
  includeSender?: boolean;
}

/** Signing via a custom session callback (email addons, etc.) */
export interface SessionSign {
  type: 'session';
  callback: SessionCallback;
  senderEmail: string;
}

export type SignMethod = ApiKeySign | YiviSign | SessionSign;

/** Callback for custom Yivi session handling */
export type SessionCallback = (request: SessionRequest) => Promise<string>;

/** Request passed to the session callback */
export interface SessionRequest {
  con: { t: string; v?: string }[];
  sort: 'Signing' | 'Decryption';
  hints?: { t: string; v?: string }[];
  senderId?: string;
}

// --- New API: Encrypt input ---

/** Input for pg.encrypt() — provide either files (zipped) or data (raw) */
export interface EncryptInput {
  /** Files to encrypt (will be zipped). Mutually exclusive with `data`. */
  files?: File[] | FileList;
  /** Raw data to encrypt (no zipping). Mutually exclusive with `files`. */
  data?: Uint8Array | ReadableStream<Uint8Array>;
  /** Recipients who can decrypt */
  recipients: Recipient[];
  /** Signing method */
  sign: SignMethod;
  /** Progress callback (0-100) for upload operations */
  onProgress?: (percentage: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/** Options for sealed.upload() */
export interface UploadOptions {
  /** Cryptify notification settings. Both recipient and sender mails
   *  are opt-in: omit `notify` (or omit the `recipients` / `sender`
   *  fields) and the upload is silent. Use this when the encrypted
   *  payload is being delivered through another channel (e.g. an email
   *  client) — pass an explicit toggle when Cryptify itself should
   *  email anyone. */
  notify?: {
    /** Send a notification email to each recipient with a download
     *  link. Default false. */
    recipients?: boolean;
    /** Send a confirmation email back to the sender. Default false.
     *  Independent of `recipients`. */
    sender?: boolean;
    /** Optional unencrypted message body included in any notification
     *  email(s) sent — both the per-recipient mail and the sender
     *  confirmation, when those are enabled. */
    message?: string;
    /** Notification email template language. Default 'EN'. */
    language?: 'EN' | 'NL';
  };
}

// --- New API: Open/decrypt input ---

/** Input for pg.open() — provide either a UUID or raw encrypted data */
export type OpenInput =
  | { uuid: string; signal?: AbortSignal }
  | { data: Uint8Array | ReadableStream<Uint8Array> };

/** Options for opened.decrypt() */
export interface DecryptInput {
  /** DOM selector for Yivi QR code (web browser) */
  element?: string;
  /** Custom session callback (email addons) */
  session?: SessionCallback;
  /** Hint: which recipient to decrypt for (required if multiple recipients) */
  recipient?: string;
  /** Enable JWT caching to avoid re-scanning QR for repeated decryptions */
  enableCache?: boolean;
}

// --- Results ---

/** Result of opened.inspect() */
export interface InspectResult {
  /** Email addresses of all recipients who can decrypt */
  recipients: string[];
  /** Sender identity (if available before decryption) */
  sender: FriendlySender | null;
  /** Raw policy map for power users */
  policies: Map<string, any>;
}

/** Result of decrypting files (from UUID) */
export interface DecryptFileResult {
  files: string[];
  sender: FriendlySender | null;
  blob: Blob;
  download: (filename?: string) => void;
}

/** Result of decrypting raw data */
export interface DecryptDataResult {
  plaintext: Uint8Array;
  sender: FriendlySender | null;
}

/** Unified decrypt result */
export type DecryptResult = DecryptFileResult | DecryptDataResult;

/** Upload result */
export interface UploadResult {
  uuid: string;
}

// --- Internal types (used by SDK internals, not exported from index.ts) ---

/** Sender identity extracted from sealed file (raw format from pg-wasm) */
export interface SenderIdentity {
  public: { con: { t: string; v?: string }[] };
  private?: { con: { t: string; v?: string }[] };
}

/** Encryption policy entry */
export interface PolicyEntry {
  ts: number;
  con: { t: string; v?: string }[];
}

/** Internal signing keys resolved from either API key or Yivi */
export interface SigningKeys {
  pubSignKey: unknown;
  privSignKey?: unknown;
  /** Email address of the sender, extracted from the Yivi session JWT */
  senderEmail?: string;
}

/** PKG session start result */
export interface SessionStartResult {
  sessionPtr: {
    u: string;
    irmaqr: string;
  };
  token: string;
}

/** Attribute constraint list */
export type AttributeCon = { t: string; v?: string }[];

// --- Email helper types ---

/** Options for building an inner MIME message */
export interface BuildMimeOptions {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody?: string;
  plainTextBody?: string;
  date?: Date;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{
    name: string;
    type: string;
    data: ArrayBuffer;
  }>;
}

/** Options for creating an encrypted email envelope */
export interface CreateEnvelopeOptions {
  /** Sealed encryption builder — will be encrypted via toBytes() internally */
  sealed: import('./sealed.js').Sealed;
  /** Sender email address */
  from: string;
  /** PostGuard website URL for decrypt links */
  websiteUrl?: string;
  /** Optional unencrypted message to show in the envelope */
  unencryptedMessage?: string;
  /** Verified sender attributes to display (e.g. name, phone number) */
  senderAttributes?: string[];
  /** Set false to keep the encrypted bytes purely as a local attachment and
   *  skip the Cryptify upload + body link. Default true. Only applies to
   *  Tier 2; Tier 3 (over `PG_MAX_ATTACHMENT_SIZE`) always uploads because
   *  there is no attachment fallback. */
  uploadToCryptify?: boolean;
  /** Notification settings for the underlying Cryptify upload. Same
   *  shape as `Sealed.upload`'s `notify`. Silent by default — set
   *  `notify.recipients = true` to opt into per-recipient mails, etc.
   *  Has no effect on Tier 1 (no upload happens) or when
   *  `uploadToCryptify: false` already skipped the upload. */
  notify?: UploadOptions['notify'];
}

/** Which tier the envelope falls into based on encrypted payload size.
 *  - tier1: very small. Whole ciphertext fits in a URL fragment, no upload.
 *  - tier2: small/medium. Local attachment plus optional Cryptify upload.
 *  - tier3: large. Cryptify upload only; no local attachment. */
export type EnvelopeTier = 'tier1' | 'tier2' | 'tier3';

/** Result of creating an encrypted email envelope */
export interface EnvelopeResult {
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  /** Encrypted attachment to include locally on the message. Null in tier3
   *  (the payload is too large to attach; recipients use the Cryptify link
   *  in the body instead). Always non-null in tier1 and tier2. */
  attachment: File | null;
  /** Which size tier was selected. */
  tier: EnvelopeTier;
  /** Cryptify UUID if the payload was uploaded; null otherwise. */
  uploadUuid: string | null;
}

/** Options for extracting ciphertext from a received email */
export interface ExtractCiphertextOptions {
  htmlBody?: string;
  attachments?: Array<{ name: string; data: ArrayBuffer }>;
}
