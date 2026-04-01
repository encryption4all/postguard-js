/** Configuration for the PostGuard client */
export interface PostGuardConfig {
  pkgUrl: string;
  cryptifyUrl?: string;
  headers?: HeadersInit;
}

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

/** Signing via API key (PostGuard for Business) */
export interface ApiKeySign {
  type: 'apiKey';
  apiKey: string;
}

/** Signing via Yivi session (peer-to-peer) */
export interface YiviSign {
  type: 'yivi';
  element: string;
  senderEmail: string;
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

/** Options for encrypt + upload (no email delivery) */
export interface EncryptAndUploadOptions {
  sign: SignMethod;
  files: File[] | FileList;
  recipients: Recipient[];
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
}

/** Options for encrypt + upload + email delivery via Cryptify */
export interface EncryptAndDeliverOptions extends EncryptAndUploadOptions {
  delivery: {
    message?: string;
    language?: 'EN' | 'NL';
    confirmToSender?: boolean;
  };
}

/** Options for encrypting raw data (no Cryptify upload) */
export interface EncryptOptions {
  sign: SignMethod;
  recipients: Recipient[];
  data: Uint8Array | ReadableStream<Uint8Array>;
}

/** Options for decryption from Cryptify UUID */
export interface DecryptUuidOptions {
  uuid: string;
  element?: string;
  session?: SessionCallback;
  recipient?: string;
  signal?: AbortSignal;
}

/** Options for decryption from raw data */
export interface DecryptDataOptions {
  data: Uint8Array | ReadableStream<Uint8Array>;
  element?: string;
  session?: SessionCallback;
  recipient?: string;
  signal?: AbortSignal;
}

/** Unified decrypt options */
export type DecryptOptions = DecryptUuidOptions | DecryptDataOptions;

/** Result of a successful decryption from Cryptify (files) */
export interface DecryptFileResult {
  files: string[];
  sender: SenderIdentity | null;
  blob: Blob;
  download: (filename?: string) => void;
}

/** Result of a successful decryption from raw data */
export interface DecryptDataResult {
  plaintext: Uint8Array;
  sender: SenderIdentity | null;
}

/** Sender identity extracted from sealed file */
export interface SenderIdentity {
  public: { con: { t: string; v?: string }[] };
  private?: { con: { t: string; v?: string }[] };
}

/** Encryption policy entry */
export interface PolicyEntry {
  ts: number;
  con: { t: string; v?: string }[];
}

/** Upload result */
export interface UploadResult {
  uuid: string;
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
  encrypted: Uint8Array;
  from: string;
  websiteUrl?: string;
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
