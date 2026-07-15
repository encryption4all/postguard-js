// Main class
export { PostGuard } from './postguard.js';

// Lazy builders
export { Sealed } from './sealed.js';
export { Opened } from './opened.js';

// Recipient builder
export { RecipientBuilder } from './recipients/builder.js';

// Types consumers need
export type {
  PostGuardConfig,
  // Recipients
  Recipient,
  // Signing
  SignMethod,
  ApiKeySign,
  YiviSign,
  SessionSign,
  SessionCallback,
  SessionRequest,
  // Pre-warmed signing (pg.prepareSign)
  PrepareSignOptions,
  PreparedSign,
  SigningKeys,
  // New API input/output
  EncryptInput,
  UploadOptions,
  OpenInput,
  DecryptInput,
  InspectResult,
  DecryptResult,
  DecryptFileResult,
  DecryptDataResult,
  UploadResult,
  // Attribute types
  AttributeCon,
  AttrReq,
  AttrDiscon,
  AttrConItem,
  // Email
  BuildMimeOptions,
  CreateEnvelopeOptions,
  EnvelopeResult,
  EnvelopeTier,
  ExtractCiphertextOptions,
} from './types.js';

// Friendly sender identity
export type { FriendlySender } from './util/identity.js';

// Standalone email helpers (no PostGuard instance needed)
export { buildMime, injectMimeHeaders } from './email/mime.js';
export {
  extractCiphertext,
  extractUploadUuid,
  PG_MAX_URL_FRAGMENT_SIZE,
  PG_MAX_ATTACHMENT_SIZE,
} from './email/extract.js';
export { createEnvelope } from './email/envelope.js';

// Errors
export {
  PostGuardError,
  NetworkError,
  UploadSessionExpiredError,
  YiviNotInstalledError,
  YiviSessionError,
  DecryptionError,
  IdentityMismatchError,
} from './errors.js';

// Retry types for callers configuring transient-failure behaviour
export type { RetryOptions, RetryEvent } from './util/retry.js';

// Cross-restart upload resume — consumers persist {uuid, recoveryToken}
// from the initial upload and call resumeUpload to rehydrate state after
// a page refresh, tab crash, or process restart.
export { resumeUpload } from './api/cryptify.js';
export type { FileState } from './api/cryptify.js';

// ZIP utility — exposed for advanced callers and the cross-runtime smoke
// script that needs to exercise the conflux+self path without going
// through the full encrypt pipeline.
export { createZipReadable } from './util/zip.js';
