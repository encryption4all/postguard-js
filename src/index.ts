// Main class
export { PostGuard } from './postguard.js';

// Lazy builders
export { Sealed } from './sealed.js';
export { Opened } from './opened.js';

// Types consumers need
export type {
  PostGuardConfig,
  // Recipients
  Recipient,
  EmailRecipient,
  EmailDomainRecipient,
  CustomPolicyRecipient,
  // Signing
  SignMethod,
  ApiKeySign,
  YiviSign,
  SessionSign,
  SessionCallback,
  SessionRequest,
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
  // Email
  BuildMimeOptions,
  CreateEnvelopeOptions,
  EnvelopeResult,
  ExtractCiphertextOptions,
} from './types.js';

// Friendly sender identity
export type { FriendlySender } from './util/identity.js';

// Errors
export {
  PostGuardError,
  NetworkError,
  YiviNotInstalledError,
  DecryptionError,
  IdentityMismatchError,
} from './errors.js';
