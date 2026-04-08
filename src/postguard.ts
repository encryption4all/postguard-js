import type { EncryptInput, OpenInput } from './types.js';
import { PostGuardBase } from './postguard-base.js';
import { Sealed } from './sealed.js';
import { Opened } from './opened.js';

export class PostGuard extends PostGuardBase {
  /** Prepare an encryption operation. Returns a lazy Sealed builder —
   *  nothing executes until you call .toBytes() or .upload(). */
  encrypt(options: EncryptInput): Sealed {
    return new Sealed(this.config, options);
  }

  /** Open encrypted data for inspection or decryption. Returns a lazy Opened builder —
   *  nothing executes until you call .inspect() or .decrypt(). */
  open(options: OpenInput): Opened {
    return new Opened(this.config, options);
  }
}
