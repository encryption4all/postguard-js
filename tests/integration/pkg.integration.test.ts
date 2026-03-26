import { describe, it, expect } from 'vitest';
import { fetchMPK, fetchVerificationKey } from '../../src/api/pkg.js';

const PKG_URL = process.env.PKG_URL ?? 'http://localhost:8087';

describe('PKG API (integration)', () => {
  it('fetches the master public key', async () => {
    const mpk = await fetchMPK(PKG_URL);
    expect(mpk).toBeDefined();
    expect(mpk).not.toBeNull();
  });

  it('fetches the verification key', async () => {
    const vk = await fetchVerificationKey(PKG_URL);
    expect(vk).toBeDefined();
    expect(vk).not.toBeNull();
  });
});
