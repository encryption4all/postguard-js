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
