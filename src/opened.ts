import type {
  PostGuardConfig,
  OpenInput,
  DecryptInput,
  DecryptFileResult,
  DecryptDataResult,
  SenderIdentity,
  InspectResult,
} from './types.js';
import { DecryptionError } from './errors.js';
import {
  inspectSealed,
  resolveRecipientKey,
  resolveUSK,
  unsealAndCollect,
} from './crypto/decrypt.js';
import { readZipFilenames } from './util/zip.js';
import { triggerBrowserDownload } from './util/download.js';
import { parseSender } from './util/identity.js';

/** Lazy decryption builder. Supports inspect-before-decrypt pattern. */
export class Opened {
  private unsealer: any = null;
  private cachedPolicies: Map<string, any> | null = null;
  private cachedSender: SenderIdentity | null = null;

  /** @internal */
  constructor(
    private readonly config: PostGuardConfig,
    private readonly options: OpenInput,
  ) {}

  /** Inspect the sealed header without decrypting.
   *  Returns recipient list, sender identity, and raw policies.
   *  The unsealer is cached so a subsequent decrypt() reuses it. */
  async inspect(): Promise<InspectResult> {
    if (this.cachedPolicies) {
      return {
        recipients: [...this.cachedPolicies.keys()],
        sender: parseSender(this.cachedSender),
        policies: this.cachedPolicies,
      };
    }

    const isUuid = 'uuid' in this.options;

    const { unsealer, policies, sender } = await inspectSealed({
      pkgUrl: this.config.pkgUrl,
      cryptifyUrl: isUuid ? this.config.cryptifyUrl : undefined,
      uuid: isUuid ? this.options.uuid : undefined,
      data: !isUuid ? this.options.data : undefined,
      signal: isUuid ? this.options.signal : undefined,
      headers: this.config.headers,
    });

    this.unsealer = unsealer;
    this.cachedPolicies = policies;
    this.cachedSender = sender;

    return {
      recipients: [...policies.keys()],
      sender: parseSender(sender),
      policies,
    };
  }

  /** Decrypt the sealed data. Calls inspect() first if not already done.
   *  Provide `element` for Yivi QR code, or `session` for custom callback. */
  async decrypt(opts: DecryptInput): Promise<DecryptFileResult | DecryptDataResult> {
    // Ensure we've inspected first
    if (!this.unsealer) {
      await this.inspect();
    }

    const policies = this.cachedPolicies!;
    const key = resolveRecipientKey(policies, opts.recipient);
    const policy = policies.get(key);

    const usk = await resolveUSK(
      this.config.pkgUrl,
      key,
      policy,
      opts.element,
      opts.session,
      this.config.headers,
    );

    const { chunks, sender } = await unsealAndCollect(
      this.unsealer,
      key,
      usk,
      this.cachedSender,
    );

    const isUuid = 'uuid' in this.options;

    if (isUuid) {
      // UUID-based: return files from ZIP
      const blob = new Blob(chunks as BlobPart[], { type: 'application/zip' });
      const files = await readZipFilenames(blob);
      return {
        files,
        sender: parseSender(sender),
        blob,
        download: (filename = 'files.zip') => triggerBrowserDownload(blob, filename),
      } as DecryptFileResult;
    }

    // Data-based: return plaintext bytes
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const plaintext = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      plaintext.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      plaintext,
      sender: parseSender(sender),
    } as DecryptDataResult;
  }
}
