export interface AttributeRequest {
  t: string;
  v: string;
}

export type AttributeCon = AttributeRequest[];

export type Policy = Record<string, AttributeCon>;

export interface Badge {
  value: string;
}

// --- Crypto popup messaging types ---

export interface CryptoPopupConfig {
  pkgUrl: string;
  cryptifyUrl?: string;
  headers?: Record<string, string>;
}

export interface SerializedRecipient {
  type: "email" | "emailDomain";
  email: string;
  policy?: { t: string; v: string }[];
}

export interface EncryptPopupData {
  operation: "encrypt";
  config: CryptoPopupConfig;
  mimeDataBase64: string;
  recipients: SerializedRecipient[];
  senderEmail: string;
  from: string;
  websiteUrl?: string;
  senderAttributes?: { t: string; v: string }[];
}

export interface DecryptPopupData {
  operation: "decrypt";
  config: CryptoPopupConfig;
  /** Tier 1/2 source — bytes extracted from the postguard.encrypted
   *  attachment. Mutually exclusive with `uuid`; exactly one of the two
   *  must be set. */
  ciphertextBase64?: string;
  /** Tier 3 source — Cryptify uuid extracted from the in-body decrypt
   *  link (the message ships no postguard.encrypted attachment). The
   *  popup will fetch + decrypt via `pg.open({ uuid })`. */
  uuid?: string;
  recipientEmail: string;
}

export type CryptoPopupInitData = EncryptPopupData | DecryptPopupData;

export interface EncryptPopupResult {
  operation: "encrypt";
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  /** null in tier 3 — pg-js decided the encrypted payload was too large
   *  for a local attachment; the body's Cryptify link carries it. */
  attachmentBase64: string | null;
  attachmentSize: number;
  tier: "tier1" | "tier2" | "tier3";
  uploadUuid: string | null;
}

export interface DecryptPopupResult {
  operation: "decrypt";
  plaintextBase64: string;
  sender: { email: string | null; attributes: { type: string; value?: string }[] } | null;
}

export type CryptoPopupResult = EncryptPopupResult | DecryptPopupResult;
