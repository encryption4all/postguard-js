import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sortPolicies, secondsTill4AM, buildKeyRequest } from '../src/yivi/decrypt-session.js';

describe('sortPolicies', () => {
  it('sorts by type alphabetically', () => {
    const input = [
      { t: 'pbdf.sidn-pbdf.email.email', v: 'a@b.com' },
      { t: 'pbdf.sidn-pbdf.email.domain', v: 'b.com' },
    ];
    const sorted = sortPolicies(input);
    expect(sorted[0].t).toBe('pbdf.sidn-pbdf.email.domain');
    expect(sorted[1].t).toBe('pbdf.sidn-pbdf.email.email');
  });

  it('does not mutate the original', () => {
    const input = [{ t: 'z' }, { t: 'a' }];
    sortPolicies(input);
    expect(input[0].t).toBe('z');
  });
});

describe('secondsTill4AM', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calculates remaining seconds until 4 AM', () => {
    // Set time to midnight -> 4 hours = 14400 seconds
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    expect(secondsTill4AM()).toBe(14400);
  });

  it('wraps to next day if past 4 AM', () => {
    // Set time to 5 AM -> 23 hours until next 4 AM = 82800 seconds
    vi.setSystemTime(new Date('2024-01-15T05:00:00'));
    expect(secondsTill4AM()).toBe(82800);
  });
});

describe('buildKeyRequest', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets email value to the key', () => {
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    const policy = {
      ts: 1700000000,
      con: [{ t: 'pbdf.sidn-pbdf.email.email', v: 'alice@example.com' }],
    };
    const req = buildKeyRequest('bob@example.com', policy);

    expect(req.con[0].v).toBe('bob@example.com');
    expect(req.validity).toBe(14400);
  });

  it('infers domain from key for domain attributes', () => {
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    const policy = {
      ts: 1700000000,
      con: [{ t: 'pbdf.sidn-pbdf.email.domain' }],
    };
    const req = buildKeyRequest('user@corp.com', policy);

    expect(req.con[0].v).toBe('corp.com');
  });

  it('strips values from unknown attribute types', () => {
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    const policy = {
      ts: 1700000000,
      con: [{ t: 'pbdf.some-other-attr', v: 'secret' }],
    };
    const req = buildKeyRequest('user@example.com', policy);

    expect(req.con[0].v).toBeUndefined();
  });
});
