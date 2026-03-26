import { describe, it, expect } from 'vitest';
import { buildEncryptionPolicy } from '../src/recipients/builders.js';
import type { Recipient } from '../src/types.js';

describe('buildEncryptionPolicy', () => {
  const ts = 1700000000;

  it('builds policy for email recipients', () => {
    const recipients: Recipient[] = [{ type: 'email', email: 'alice@example.com' }];
    const policy = buildEncryptionPolicy(recipients, ts);

    expect(policy).toEqual({
      'alice@example.com': {
        ts,
        con: [{ t: 'pbdf.sidn-pbdf.email.email', v: 'alice@example.com' }],
      },
    });
  });

  it('builds policy for emailDomain recipients', () => {
    const recipients: Recipient[] = [{ type: 'emailDomain', email: 'bob@corp.com' }];
    const policy = buildEncryptionPolicy(recipients, ts);

    expect(policy).toEqual({
      'bob@corp.com': {
        ts,
        con: [{ t: 'pbdf.sidn-pbdf.email.domain', v: 'corp.com' }],
      },
    });
  });

  it('handles multiple recipients of mixed types', () => {
    const recipients: Recipient[] = [
      { type: 'email', email: 'alice@example.com' },
      { type: 'emailDomain', email: 'bob@corp.com' },
    ];
    const policy = buildEncryptionPolicy(recipients, ts);

    expect(Object.keys(policy)).toHaveLength(2);
    expect(policy['alice@example.com'].con[0].t).toBe('pbdf.sidn-pbdf.email.email');
    expect(policy['bob@corp.com'].con[0].t).toBe('pbdf.sidn-pbdf.email.domain');
  });

  it('returns empty policy for empty recipients', () => {
    expect(buildEncryptionPolicy([], ts)).toEqual({});
  });
});
