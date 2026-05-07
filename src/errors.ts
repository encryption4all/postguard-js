export class PostGuardError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PostGuardError';
  }
}

export class NetworkError extends PostGuardError {
  public readonly status: number;
  public readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'NetworkError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Thrown when Cryptify reports the upload session is no longer known to
 * the server — either it was idle past the configured TTL, the server
 * was restarted, or the path UUID is malformed. Distinct from
 * `NetworkError` so retry policies can short-circuit instead of burning
 * the budget on something that will never recover. The user must start
 * a new upload.
 *
 * `reason` mirrors Cryptify's structured 404 body
 * (`expired_or_unknown`, `invalid_uuid`, `file_missing`).
 */
export class UploadSessionExpiredError extends NetworkError {
  public readonly uuid: string;
  public readonly reason: string;
  constructor(uuid: string, reason: string, body: string) {
    super(`Upload session ${uuid} is no longer known to the server (${reason})`, 404, body);
    this.name = 'UploadSessionExpiredError';
    this.uuid = uuid;
    this.reason = reason;
  }
}

export class YiviNotInstalledError extends PostGuardError {
  constructor() {
    super(
      'Install @privacybydesign/yivi-core, @privacybydesign/yivi-web, and @privacybydesign/yivi-client to use Yivi features.'
    );
    this.name = 'YiviNotInstalledError';
  }
}

export class DecryptionError extends PostGuardError {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class IdentityMismatchError extends DecryptionError {
  constructor() {
    super('Identity mismatch: the Yivi attributes did not match the encryption policy.');
    this.name = 'IdentityMismatchError';
  }
}

/** Thrown when a Yivi session ends without a successful disclosure —
 *  user dismissed the QR widget, declined disclosure in the Yivi app,
 *  or the session timed out. The `reason` field carries the raw
 *  yivi-core final-state string (`"Cancelled"`, `"TimedOut"`,
 *  `"Aborted"`, …) for callers that want to distinguish. */
export class YiviSessionError extends PostGuardError {
  public readonly reason: string;
  constructor(reason: string) {
    super(`Yivi session ended without disclosure: ${reason}`);
    this.name = 'YiviSessionError';
    this.reason = reason;
  }
  /** Convenience: `reason === 'Cancelled'`. */
  get cancelled(): boolean {
    return this.reason === 'Cancelled';
  }
}
