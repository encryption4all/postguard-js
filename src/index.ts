export { PostGuard } from './postguard.js';

export type {
  WasmModule,
  PostGuardConfig,
  EmailRecipient,
  EmailDomainRecipient,
  CustomPolicyRecipient,
  Recipient,
  ApiKeySign,
  YiviSign,
  SessionSign,
  SignMethod,
  SessionCallback,
  SessionRequest,
  EncryptAndUploadOptions,
  EncryptAndDeliverOptions,
  EncryptOptions,
  DecryptOptions,
  DecryptUuidOptions,
  DecryptDataOptions,
  DecryptFileResult,
  DecryptDataResult,
  SenderIdentity,
  UploadResult,
  SigningKeys,
  PolicyEntry,
  SessionStartResult,
  AttributeCon,
  BuildMimeOptions,
  CreateEnvelopeOptions,
  EnvelopeResult,
  ExtractCiphertextOptions,
} from './types.js';

export {
  PostGuardError,
  NetworkError,
  YiviNotInstalledError,
  DecryptionError,
  IdentityMismatchError,
} from './errors.js';

// PKG API functions (for custom startup checks, caching, etc.)
export { fetchMPK, fetchVerificationKey } from './api/pkg.js';

// Policy utilities
export { buildKeyRequest, sortPolicies, secondsTill4AM } from './util/policy.js';
export { buildEncryptionPolicy } from './recipients/builders.js';

// Email helpers (also available via PostGuard.email)
export { buildMime, injectMimeHeaders } from './email/mime.js';
export { createEnvelope } from './email/envelope.js';
export { extractCiphertext, extractArmoredPayload, armorBase64 } from './email/extract.js';
