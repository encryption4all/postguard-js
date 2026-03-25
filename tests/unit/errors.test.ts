import { describe, it, expect } from 'vitest';
import {
  PostGuardError,
  NetworkError,
  YiviNotInstalledError,
  DecryptionError,
  IdentityMismatchError,
} from '../../src/errors.js';

describe('PostGuardError', () => {
  it('has correct name and message', () => {
    const err = new PostGuardError('something broke');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PostGuardError');
    expect(err.message).toBe('something broke');
  });

  it('supports cause via ErrorOptions', () => {
    const cause = new Error('root cause');
    const err = new PostGuardError('wrapper', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('NetworkError', () => {
  it('exposes status and body', () => {
    const err = new NetworkError('fetch failed', 404, 'Not Found');
    expect(err).toBeInstanceOf(PostGuardError);
    expect(err.name).toBe('NetworkError');
    expect(err.status).toBe(404);
    expect(err.body).toBe('Not Found');
  });
});

describe('YiviNotInstalledError', () => {
  it('has a helpful default message', () => {
    const err = new YiviNotInstalledError();
    expect(err).toBeInstanceOf(PostGuardError);
    expect(err.name).toBe('YiviNotInstalledError');
    expect(err.message).toContain('yivi-core');
  });
});

describe('DecryptionError', () => {
  it('extends PostGuardError', () => {
    const err = new DecryptionError('bad key');
    expect(err).toBeInstanceOf(PostGuardError);
    expect(err.name).toBe('DecryptionError');
    expect(err.message).toBe('bad key');
  });
});

describe('IdentityMismatchError', () => {
  it('extends DecryptionError with default message', () => {
    const err = new IdentityMismatchError();
    expect(err).toBeInstanceOf(DecryptionError);
    expect(err.name).toBe('IdentityMismatchError');
    expect(err.message).toContain('Identity mismatch');
  });
});
