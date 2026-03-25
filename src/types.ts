/** Configuration for the PostGuard client */
export interface PostGuardConfig {
  pkgUrl: string;
  cryptifyUrl: string;
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

export type Recipient = EmailRecipient | EmailDomainRecipient;

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

export type SignMethod = ApiKeySign | YiviSign;

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

/** Options for decryption */
export interface DecryptOptions {
  uuid: string;
  element: string;
  recipient?: string;
  signal?: AbortSignal;
}

/** Result of a successful decryption */
export interface DecryptResult {
  files: string[];
  sender: SenderIdentity | null;
  blob: Blob;
  download: (filename?: string) => void;
}

/** Sender identity extracted from sealed file */
export interface SenderIdentity {
  con: { t: string; v?: string }[];
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
