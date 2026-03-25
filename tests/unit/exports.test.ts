import { describe, it, expect } from 'vitest';
import * as pgjs from '../../src/index.js';

describe('public API surface', () => {
  it('exports PostGuard class', () => {
    expect(pgjs.PostGuard).toBeDefined();
    expect(typeof pgjs.PostGuard).toBe('function');
  });

  it('exports all error classes', () => {
    expect(pgjs.PostGuardError).toBeDefined();
    expect(pgjs.NetworkError).toBeDefined();
    expect(pgjs.YiviNotInstalledError).toBeDefined();
    expect(pgjs.DecryptionError).toBeDefined();
    expect(pgjs.IdentityMismatchError).toBeDefined();
  });

  it('PostGuard is constructable with config', () => {
    const pg = new pgjs.PostGuard({
      pkgUrl: 'https://pkg.example.com',
      cryptifyUrl: 'https://cryptify.example.com',
    });
    expect(pg).toBeInstanceOf(pgjs.PostGuard);
  });
});
