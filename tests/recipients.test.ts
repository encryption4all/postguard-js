import { describe, it, expect } from 'vitest';
import { buildEncryptionPolicy } from '../src/recipients/builders.js';
import { RecipientBuilder } from '../src/recipients/builder.js';

describe('buildEncryptionPolicy', () => {
  const ts = 1700000000;

  it('builds policy for email recipients', () => {
    const recipients = [new RecipientBuilder('alice@example.com', 'email')];
    const policy = buildEncryptionPolicy(recipients, ts);

    expect(policy).toEqual({
      'alice@example.com': {
        ts,
        con: [{ t: 'pbdf.sidn-pbdf.email.email', v: 'alice@example.com' }],
      },
    });
  });

  it('builds policy for emailDomain recipients', () => {
    const recipients = [new RecipientBuilder('bob@corp.com', 'emailDomain')];
    const policy = buildEncryptionPolicy(recipients, ts);

    expect(policy).toEqual({
      'bob@corp.com': {
        ts,
        con: [{ t: 'pbdf.sidn-pbdf.email.domain', v: 'corp.com' }],
      },
    });
  });

  it('handles multiple recipients of mixed types', () => {
    const recipients = [
      new RecipientBuilder('alice@example.com', 'email'),
      new RecipientBuilder('bob@corp.com', 'emailDomain'),
    ];
    const policy = buildEncryptionPolicy(recipients, ts);

    expect(Object.keys(policy)).toHaveLength(2);
    expect(policy['alice@example.com'].con[0].t).toBe('pbdf.sidn-pbdf.email.email');
    expect(policy['bob@corp.com'].con[0].t).toBe('pbdf.sidn-pbdf.email.domain');
  });

  it('includes extra attributes in policy', () => {
    const r = new RecipientBuilder('alice@example.com', 'email')
      .extraAttribute('pbdf.gemeente.personalData.surname', 'Smith');
    const policy = buildEncryptionPolicy([r], ts);

    expect(policy['alice@example.com'].con).toEqual([
      { t: 'pbdf.sidn-pbdf.email.email', v: 'alice@example.com' },
      { t: 'pbdf.gemeente.personalData.surname', v: 'Smith' },
    ]);
  });

  it('returns empty policy for empty recipients', () => {
    expect(buildEncryptionPolicy([], ts)).toEqual({});
  });
});
