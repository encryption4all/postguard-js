export { PostGuard } from './postguard.js';

export type {
  PostGuardConfig,
  EmailRecipient,
  EmailDomainRecipient,
  Recipient,
  ApiKeySign,
  YiviSign,
  SignMethod,
  EncryptAndUploadOptions,
  EncryptAndDeliverOptions,
  DecryptOptions,
  DecryptResult,
  SenderIdentity,
  UploadResult,
  SigningKeys,
  PolicyEntry,
} from './types.js';

export {
  PostGuardError,
  NetworkError,
  YiviNotInstalledError,
  DecryptionError,
  IdentityMismatchError,
} from './errors.js';
