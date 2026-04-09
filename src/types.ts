import type { FriendlySender } from './util/identity.js';

// --- Config ---

/** Configuration for the PostGuard client */
export interface PostGuardConfig {
  pkgUrl: string;
  cryptifyUrl?: string;
  headers?: HeadersInit;
}

// --- Recipients ---

/** A recipient identified by exact email address (citizen) */
export interface EmailRecipient {
  type: 'email';
  email: string;
}

/** A recipient identified by email domain (organisation) */
export interface EmailDomainRecipient {
  type: 'emailDomain';
  email: string;
}

/** A recipient with a custom attribute policy */
export interface CustomPolicyRecipient {
  type: 'customPolicy';
  email: string;
  policy: { t: string; v: string }[];
}

export type Recipient = EmailRecipient | EmailDomainRecipient | CustomPolicyRecipient;

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
   *  Email is always included automatically. */
  attributes?: { t: string; v?: string }[];
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
  /** If provided, Cryptify sends email notifications to recipients */
  notify?: {
    message?: string;
    language?: 'EN' | 'NL';
    confirmToSender?: boolean;
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
}

/** Result of creating an encrypted email envelope */
export interface EnvelopeResult {
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  attachment: File;
}

/** Options for extracting ciphertext from a received email */
export interface ExtractCiphertextOptions {
  htmlBody?: string;
  attachments?: Array<{ name: string; data: ArrayBuffer }>;
}
