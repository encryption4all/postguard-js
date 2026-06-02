import { describe, it, expect } from 'vitest';
import { unsealAndCollect } from '../src/crypto/decrypt.js';
import { IdentityMismatchError } from '../src/errors.js';

/** Minimal fake unsealer matching the shape `unsealAndCollect` uses. */
function fakeUnsealer(unsealImpl: () => Promise<void>) {
  return {
    unseal: unsealImpl,
    public_identity: () => null,
  };
}

describe('unsealAndCollect', () => {
  it('wraps a generic unseal failure as IdentityMismatchError with the original error as cause', async () => {
    const original = new TypeError('Network error');
    const unsealer = fakeUnsealer(() => Promise.reject(original));

    const err = await unsealAndCollect(unsealer, 'recipient@example.com', {}, null).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(IdentityMismatchError);
    expect((err as IdentityMismatchError).cause).toBe(original);
  });

  it('lets AbortError propagate unchanged instead of masking as IdentityMismatchError', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    const unsealer = fakeUnsealer(() => Promise.reject(abort));

    const err = await unsealAndCollect(unsealer, 'recipient@example.com', {}, null).catch(
      (e) => e
    );

    expect(err).toBe(abort);
    expect(err).not.toBeInstanceOf(IdentityMismatchError);
  });

  it('still throws IdentityMismatchError on an unspecified unseal failure', async () => {
    const unsealer = fakeUnsealer(() => Promise.reject(new Error('bad key')));

    const err = await unsealAndCollect(unsealer, 'recipient@example.com', {}, null).catch(
      (e) => e
    );

    expect(err).toBeInstanceOf(IdentityMismatchError);
  });
});
