import { describe, it, expect } from 'vitest';
import { unsealAndCollect } from '../src/crypto/decrypt.js';
import { IdentityMismatchError } from '../src/errors.js';
import type { SenderIdentity } from '../src/types.js';

/** Minimal fake unsealer matching the shape `unsealAndCollect` uses.
 *  `unsealImpl` may resolve to a SenderIdentity (the verified `{public,
 *  private}` policy that `StreamUnsealer.unseal` returns from
 *  pg-wasm). Callers that only care about the failure path return
 *  `void`/`undefined` — both are fine. */
function fakeUnsealer(
  unsealImpl: () => Promise<SenderIdentity | void>,
  publicIdentity: SenderIdentity | null = null,
) {
  return {
    unseal: unsealImpl,
    public_identity: () => publicIdentity,
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

  it('captures the verified private signing identity returned by unseal', async () => {
    const preUnseal: SenderIdentity = {
      public: { con: [{ t: 'pbdf.sidn-pbdf.email.email', v: 'pre-unseal@example.com' }] },
    };
    const verified: SenderIdentity = {
      public: { con: [{ t: 'pbdf.sidn-pbdf.email.email', v: 'verified@example.com' }] },
      private: {
        con: [
          { t: 'pbdf.gemeente.personalData.fullname', v: 'R.A. Hensen' },
          { t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber', v: '+31630222348' },
          { t: 'pbdf.gemeente.personalData.dateofbirth', v: '27-05-1996' },
        ],
      },
    };

    const unsealer = fakeUnsealer(() => Promise.resolve(verified));

    const { sender } = await unsealAndCollect(unsealer, 'recipient@example.com', {}, preUnseal);

    expect(sender?.public.con).toEqual(verified.public.con);
    expect(sender?.private?.con).toEqual(verified.private!.con);
  });
});
